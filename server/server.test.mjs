import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { ConfigStore } from './config-store.mjs';
import { RaffleStore, isPrime } from './raffle.mjs';
import { createApp } from './server.mjs';

const dir = mkdtempSync(join(tmpdir(), 'hat-raffle-'));
const file = join(dir, 'scans.json');
const configFile = join(dir, 'config.json');
const KEY = { 'X-Api-Key': 'secret' };
let server;
let base;

before(async () => {
  server = createApp(new RaffleStore(file), new ConfigStore(configFile), {
    apiKey: 'secret',
    staticDir: join(dir, 'none'),
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const api = (path, { method = 'GET', body, headers = {} } = {}) =>
  fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...KEY, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const post = (code, extra = {}) =>
  api('/api/scans', { method: 'POST', body: { code, station: 'test', ...extra } });

/** Collects Server-Sent Events until `count` events of the given types arrived. */
async function collectEvents(types, count, trigger) {
  const controller = new AbortController();
  const res = await fetch(`${base}/api/events?key=secret`, { signal: controller.signal });
  const reader = res.body.getReader();
  const events = [];
  let buffer = '';
  let triggered = false;
  while (events.length < count) {
    const { value } = await reader.read();
    buffer += new TextDecoder().decode(value);
    let idx;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const event = /^event: (.*)$/m.exec(chunk)?.[1];
      const data = /^data: (.*)$/m.exec(chunk)?.[1];
      if (event === 'hello' && !triggered) {
        triggered = true;
        await trigger();
      }
      if (types.includes(event)) events.push({ event, data: JSON.parse(data) });
    }
  }
  controller.abort();
  return events;
}

test('isPrime', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9, 11, 97, 100].map(isPrime), [
    false,
    true,
    true,
    false,
    true,
    false,
    true,
    true,
    false,
  ]);
});

test('healthz', async () => {
  const res = await fetch(`${base}/healthz`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).app, 'hat-raffle');
});

test('api key is required', async () => {
  assert.equal((await api('/api/stats', { headers: { 'X-Api-Key': '' } })).status, 401);
});

test('registers scans, detects duplicates and persists them', async () => {
  const first = await post('badge-1');
  assert.equal(first.status, 201);
  assert.equal((await first.json()).record.winner, false);

  const second = await (await post('badge-2')).json();
  assert.equal(second.record.number, 2);
  assert.equal(second.record.winner, true);

  const dup = await post('badge-2');
  assert.equal(dup.status, 200);
  assert.equal((await dup.json()).status, 'duplicate');

  const list = await (await api('/api/scans')).json();
  assert.equal(list.total, 2);
  assert.equal(list.winners, 1);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).length, 2);
});

test('rejects empty codes', async () => {
  assert.equal((await post('   ')).status, 400);
});

test('many stations at once never get the same number', async () => {
  const before = (await (await api('/api/stats')).json()).total;
  const codes = Array.from({ length: 60 }, (_, i) => `parallel-${i % 50}`); // 10 duplicates
  const results = await Promise.all(
    codes.map((code, i) => post(code, { station: `station-${i % 4}` }).then((r) => r.json())),
  );
  const numbers = results.filter((r) => r.status === 'new').map((r) => r.record.number);
  assert.equal(numbers.length, 50);
  assert.equal(new Set(numbers).size, 50);
  assert.deepEqual(
    [...numbers].sort((a, b) => a - b),
    Array.from({ length: 50 }, (_, i) => before + i + 1),
  );
  assert.equal(new RaffleStore(file).scans.length, before + 50);
});

test('the rules come from the shared config, not from the station', async () => {
  await api('/api/config', {
    method: 'PUT',
    body: { config: { winnerRule: 'random', hatsPer100: 0 } },
  });
  const res = await (await post('rule-check', { rule: 'counter' })).json();
  assert.equal(res.record.winner, false);
  await api('/api/config', { method: 'PUT', body: { config: { winnerRule: 'counter' } } });
});

test('config changes and new scans are pushed to all stations', async () => {
  const events = await collectEvents(['scan', 'config'], 2, async () => {
    await api('/api/config', {
      method: 'PUT',
      body: { config: { idleCta: 'Hallo', hatsTotal: 99 } },
    });
    await post('live-1', { clientId: 'phone-1' });
  });
  const config = events.find((e) => e.event === 'config').data;
  assert.equal(config.idleCta, 'Hallo');
  assert.equal(config.hatsTotal, 99);
  const scan = events.find((e) => e.event === 'scan').data;
  assert.equal(scan.clientId, 'phone-1');
  assert.equal(scan.record.code, undefined, 'codes must not be broadcast');
  assert.ok(scan.stats.total > 0);
});

test('a PIN protects the config and the scan list', async () => {
  await api('/api/config', { method: 'PUT', body: { config: {}, newPin: '1234' } });

  const publicConfig = await (await api('/api/config')).json();
  assert.equal(publicConfig.pinSet, true);
  assert.equal(JSON.stringify(publicConfig).includes('hash'), false);
  assert.equal(readFileSync(configFile, 'utf8').includes('1234'), false, 'PIN is stored hashed');

  assert.equal((await api('/api/scans')).status, 403);
  assert.equal((await api('/api/config', { method: 'PUT', body: { config: {} } })).status, 403);
  assert.equal(
    (await api('/api/config/unlock', { method: 'POST', body: { pin: 'wrong' } })).status,
    403,
  );
  assert.equal(
    (await api('/api/config/unlock', { method: 'POST', body: { pin: '1234' } })).status,
    200,
  );
  assert.equal((await api('/api/scans', { headers: { 'X-Config-Pin': '1234' } })).status, 200);

  // Scanning keeps working without the PIN.
  assert.equal((await post('after-pin')).status, 201);

  // Removing the PIN.
  const res = await api('/api/config', {
    method: 'PUT',
    headers: { 'X-Config-Pin': '1234' },
    body: { config: {}, newPin: null },
  });
  assert.equal((await res.json()).pinSet, false);
  assert.equal((await api('/api/scans')).status, 200);
});

test('too many wrong PINs lock the client out for a while', async () => {
  await api('/api/config', { method: 'PUT', body: { config: {}, newPin: 'abcd' } });
  const unlock = (pin) => api('/api/config/unlock', { method: 'POST', body: { pin } });
  for (let i = 0; i < 5; i++) assert.equal((await unlock('nope')).status, 403);
  assert.equal((await unlock('abcd')).status, 429);
});

test('random rule hands out exactly hatsPer100 hats per 100 scans', async () => {
  const store = new RaffleStore(join(dir, 'random.json'));
  for (let i = 1; i <= 200; i++) await store.register(`r-${i}`, { rule: 'random', hatsPer100: 7 });
  assert.equal(store.scans.slice(0, 100).filter((s) => s.winner).length, 7);
  assert.equal(store.scans.slice(100).filter((s) => s.winner).length, 7);
});

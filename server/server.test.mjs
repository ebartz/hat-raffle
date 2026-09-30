import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { RaffleStore, isPrime } from './raffle.mjs';
import { createApp } from './server.mjs';

const dir = mkdtempSync(join(tmpdir(), 'hat-raffle-'));
const file = join(dir, 'scans.json');
let server;
let base;

before(async () => {
  server = createApp(new RaffleStore(file), { apiKey: 'secret', staticDir: join(dir, 'none') });
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const post = (code, headers = { 'X-Api-Key': 'secret' }) =>
  fetch(`${base}/api/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ code, rule: 'counter', hatsTotal: 0, station: 'test' }),
  });

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
  assert.equal((await fetch(`${base}/healthz`)).status, 200);
});

test('api key is required', async () => {
  assert.equal((await post('x', {})).status, 401);
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

  const list = await (
    await fetch(`${base}/api/scans`, { headers: { 'X-Api-Key': 'secret' } })
  ).json();
  assert.equal(list.total, 2);
  assert.equal(list.winners, 1);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).length, 2);
  assert.equal(new RaffleStore(file).scans.length, 2);
});

test('rejects empty codes', async () => {
  assert.equal((await post('   ')).status, 400);
});

test('random rule hands out exactly hatsPer100 hats per 100 scans', async () => {
  const store = new RaffleStore(join(dir, 'random.json'));
  for (let i = 1; i <= 200; i++) await store.register(`r-${i}`, { rule: 'random', hatsPer100: 7 });
  assert.equal(store.scans.slice(0, 100).filter((s) => s.winner).length, 7);
  assert.equal(store.scans.slice(100).filter((s) => s.winner).length, 7);
});

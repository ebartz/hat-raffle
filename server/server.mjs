#!/usr/bin/env node
// Dependency-free backend for the Hat Raffle. One backend serves any number of scan stations:
// it hands out the participant numbers, stores all scans, keeps the shared configuration and
// pushes new results and config changes live to every station (Server-Sent Events).
//
//   PORT          port to listen on (default 3000)
//   DATA_FILE     JSON file for all scans (default ./data/scans.json)
//   CONFIG_FILE   JSON file for the shared config (default ./data/config.json)
//   API_KEY       if set, every /api request needs the header X-Api-Key (or ?key= for events)
//   CORS_ORIGIN   allowed origin for the browser app (default *)
//   STATIC_DIR    serve the built Angular app from here (default ../dist/hat-raffle/browser)
//   TLS_CERT      path to a certificate (PEM) – enables HTTPS, needed for the phone camera
//   TLS_KEY       path to the matching private key (PEM)
//   TRUST_PROXY   set to 1 behind a reverse proxy to use X-Forwarded-For as client address
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigStore } from './config-store.mjs';
import { RaffleStore, normalizeCode } from './raffle.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const env = process.env;
const PORT = Number(env.PORT ?? 3000);
const DATA_FILE = resolve(env.DATA_FILE ?? join(here, 'data', 'scans.json'));
const CONFIG_FILE = resolve(env.CONFIG_FILE ?? join(dirname(DATA_FILE), 'config.json'));
const API_KEY = env.API_KEY ?? '';
const TRUST_PROXY = env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true';
const CORS_ORIGIN = env.CORS_ORIGIN ?? '*';
const STATIC_DIR = resolve(env.STATIC_DIR ?? join(here, '..', 'dist', 'hat-raffle', 'browser'));
const MAX_BODY = 16 * 1024;
const MAX_CODE_LENGTH = 1024;
const PIN_MAX_FAILS = 5;
const PIN_LOCK_MS = 30_000;
const HEARTBEAT_MS = 25_000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.json': 'application/json',
};

/** Builds the request handler. Exported for tests. */
export function createHandler(
  store,
  config,
  {
    apiKey = API_KEY,
    corsOrigin = CORS_ORIGIN,
    staticDir = STATIC_DIR,
    trustProxy = TRUST_PROXY,
  } = {},
) {
  const clients = new Set();
  const pinFails = new Map(); // ip -> { count, until }

  const broadcast = (event, data) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) res.write(payload);
  };

  const heartbeat = setInterval(() => {
    for (const res of clients) res.write(': ping\n\n');
  }, HEARTBEAT_MS);
  heartbeat.unref();

  /** Admin endpoints need the config PIN once one is set. Brute force is slowed down per IP. */
  const requirePin = (req, res, pin = req.headers['x-config-pin']) => {
    const forwarded = trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0] : '';
    const ip = forwarded.trim() || req.socket.remoteAddress || '';
    const fails = pinFails.get(ip);
    if (fails && fails.until > Date.now()) {
      send(res, 429, { error: 'too many attempts, try again later' });
      return false;
    }
    if (config.checkPin(pin)) {
      pinFails.delete(ip);
      return true;
    }
    const count = (fails?.count ?? 0) + 1;
    pinFails.set(
      ip,
      count >= PIN_MAX_FAILS ? { count: 0, until: Date.now() + PIN_LOCK_MS } : { count, until: 0 },
    );
    send(res, 403, { error: 'invalid pin' });
    return false;
  };

  const handler = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key, X-Config-Pin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    if (req.method === 'OPTIONS') return send(res, 204);

    const url = new URL(req.url ?? '/', 'http://localhost');
    const route = `${req.method} ${url.pathname}`;
    try {
      if (route === 'GET /healthz') {
        return send(res, 200, { status: 'ok', app: 'hat-raffle' });
      }

      if (!url.pathname.startsWith('/api/')) {
        if (req.method === 'GET') return serveStatic(res, staticDir, url.pathname);
        return send(res, 405, { error: 'method not allowed' });
      }

      const key = req.headers['x-api-key'] ?? url.searchParams.get('key');
      if (apiKey && key !== apiKey) return send(res, 401, { error: 'invalid api key' });

      switch (route) {
        case 'POST /api/scans': {
          const body = await readJson(req);
          const code = normalizeCode(body.code);
          if (!code || code.length > MAX_CODE_LENGTH)
            return send(res, 400, { error: 'invalid code' });
          // The rules always come from the shared config, never from the station.
          const { winnerRule, hatsTotal, hatsPer100 } = config.value;
          const result = await store.register(code, {
            rule: winnerRule,
            hatsTotal,
            hatsPer100,
            station: body.station,
          });
          console.log(
            `[scan] #${result.record.number} ${result.status}${result.record.winner ? ' WINNER' : ''} (${result.record.station || '-'})`,
          );
          if (result.status === 'new') {
            // Codes are personal data and are not broadcast to other stations.
            const { code: _code, ...record } = result.record;
            broadcast('scan', {
              status: result.status,
              soldOut: result.soldOut,
              record,
              clientId: String(body.clientId ?? '').slice(0, 64),
              stats: store.stats,
            });
          }
          return send(res, result.status === 'new' ? 201 : 200, result);
        }
        case 'GET /api/stats':
          return send(res, 200, store.stats);
        case 'GET /api/config':
          return send(res, 200, config.publicValue);
        case 'POST /api/config/unlock': {
          const body = await readJson(req);
          if (!requirePin(req, res, body.pin)) return;
          return send(res, 200, { ok: true });
        }
        case 'PUT /api/config': {
          if (!requirePin(req, res)) return;
          const body = await readJson(req);
          const value = await config.update(body.config, { newPin: body.newPin });
          broadcast('config', value);
          console.log('[config] updated');
          return send(res, 200, value);
        }
        case 'GET /api/scans':
          if (!requirePin(req, res)) return;
          return send(res, 200, { scans: store.scans, ...store.stats });
        case 'GET /api/scans.csv':
          if (!requirePin(req, res, req.headers['x-config-pin'] ?? url.searchParams.get('pin')))
            return;
          return sendCsv(res, store.scans);
        case 'GET /api/events': {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
          });
          res.write('retry: 3000\n\n');
          res.write(
            `event: hello\ndata: ${JSON.stringify({ config: config.publicValue, stats: store.stats })}\n\n`,
          );
          clients.add(res);
          req.on('close', () => clients.delete(res));
          return;
        }
        default:
          return send(res, 404, { error: 'not found' });
      }
    } catch (err) {
      const status = err.status ?? 500;
      if (status === 500) console.error(err);
      return send(res, status, { error: err.expose ? err.message : 'internal error' });
    }
  };
  handler.close = () => {
    clearInterval(heartbeat);
    for (const res of clients) res.end();
    clients.clear();
  };
  return handler;
}

/** Creates an HTTP server, or an HTTPS server when `tls` ({ cert, key }) is given. */
export function createApp(store, config, options = {}) {
  const handler = createHandler(store, config, options);
  const server = options.tls ? createHttpsServer(options.tls, handler) : createHttpServer(handler);
  const close = server.close.bind(server);
  server.close = (cb) => {
    handler.close();
    return close(cb);
  };
  return server;
}

function send(res, status, body) {
  if (body === undefined) {
    res.writeHead(status).end();
    return;
  }
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
}

function sendCsv(res, scans) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['number', 'code', 'winner', 'station', 'timestamp'].join(';')];
  for (const s of scans) {
    lines.push([s.number, s.code, s.winner, s.station, s.timestamp].map(esc).join(';'));
  }
  res
    .writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="hat-raffle.csv"',
    })
    .end('﻿' + lines.join('\n'));
}

function readJson(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('payload too large'), { status: 413, expose: true }));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('invalid json'), { status: 400, expose: true }));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(res, root, pathname) {
  if (!existsSync(root)) {
    return send(res, 404, { error: 'frontend not built – run "npm run build"' });
  }
  let file = normalize(join(root, decodeURIComponent(pathname)));
  if (file !== root && !file.startsWith(root + sep)) return send(res, 403, { error: 'forbidden' });
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const store = new RaffleStore(DATA_FILE);
  const config = new ConfigStore(CONFIG_FILE);
  const tls =
    env.TLS_CERT && env.TLS_KEY
      ? { cert: readFileSync(env.TLS_CERT), key: readFileSync(env.TLS_KEY) }
      : undefined;
  createApp(store, config, { tls }).listen(PORT, () => {
    console.log(`Hat Raffle backend listening on ${tls ? 'https' : 'http'}://localhost:${PORT}`);
    console.log(`  data file:   ${DATA_FILE} (${store.scans.length} scans)`);
    console.log(`  config file: ${CONFIG_FILE} (PIN ${config.pinSet ? 'set' : 'not set'})`);
    console.log(`  api key:     ${API_KEY ? 'required' : 'not required'}`);
    if (existsSync(STATIC_DIR)) console.log(`  frontend:    ${STATIC_DIR}`);
  });
}

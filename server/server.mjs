#!/usr/bin/env node
// Minimal, dependency-free backend for the Hat Raffle.
//
//   PORT        port to listen on (default 3000)
//   DATA_FILE   JSON file for all scans (default ./data/scans.json)
//   API_KEY     if set, every /api request needs the header X-Api-Key
//   CORS_ORIGIN allowed origin for the browser app (default *)
//   STATIC_DIR  serve the built Angular app from here (default ../dist/hat-raffle/browser)
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RaffleStore, normalizeCode } from './raffle.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
const DATA_FILE = resolve(process.env.DATA_FILE ?? join(here, 'data', 'scans.json'));
const API_KEY = process.env.API_KEY ?? '';
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';
const STATIC_DIR = resolve(
  process.env.STATIC_DIR ?? join(here, '..', 'dist', 'hat-raffle', 'browser'),
);
const MAX_BODY = 16 * 1024;
const MAX_CODE_LENGTH = 1024;

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

export function createApp(
  store,
  { apiKey = API_KEY, corsOrigin = CORS_ORIGIN, staticDir = STATIC_DIR } = {},
) {
  return createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return send(res, 204);

    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      if (url.pathname === '/healthz' && req.method === 'GET') {
        return send(res, 200, { status: 'ok' });
      }

      if (url.pathname.startsWith('/api/')) {
        if (apiKey && req.headers['x-api-key'] !== apiKey)
          return send(res, 401, { error: 'invalid api key' });

        if (url.pathname === '/api/scans' && req.method === 'POST') {
          const body = await readJson(req);
          const code = normalizeCode(body.code);
          if (!code || code.length > MAX_CODE_LENGTH)
            return send(res, 400, { error: 'invalid code' });
          const result = await store.register(code, body);
          console.log(
            `[scan] #${result.record.number} ${result.status}${result.record.winner ? ' WINNER' : ''}`,
          );
          return send(res, result.status === 'new' ? 201 : 200, result);
        }
        if (url.pathname === '/api/scans' && req.method === 'GET') {
          return send(res, 200, { scans: store.scans, ...store.stats });
        }
        if (url.pathname === '/api/scans.csv' && req.method === 'GET') {
          return sendCsv(res, store.scans);
        }
        if (url.pathname === '/api/stats' && req.method === 'GET') {
          return send(res, 200, store.stats);
        }
        return send(res, 404, { error: 'not found' });
      }

      if (req.method === 'GET') return serveStatic(res, staticDir, url.pathname);
      return send(res, 405, { error: 'method not allowed' });
    } catch (err) {
      const status = err.status ?? 500;
      if (status === 500) console.error(err);
      return send(res, status, { error: err.expose ? err.message : 'internal error' });
    }
  });
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
  for (const s of scans)
    lines.push([s.number, s.code, s.winner, s.station, s.timestamp].map(esc).join(';'));
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
  if (!existsSync(root))
    return send(res, 404, { error: 'frontend not built – run "npm run build"' });
  let file = normalize(join(root, decodeURIComponent(pathname)));
  if (file !== root && !file.startsWith(root + sep)) return send(res, 403, { error: 'forbidden' });
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const store = new RaffleStore(DATA_FILE);
  createApp(store).listen(PORT, () => {
    console.log(`Hat Raffle backend listening on http://localhost:${PORT}`);
    console.log(`  data file: ${DATA_FILE} (${store.scans.length} scans)`);
    console.log(`  api key:   ${API_KEY ? 'required' : 'not required'}`);
    if (existsSync(STATIC_DIR)) console.log(`  frontend:  ${STATIC_DIR}`);
  });
}

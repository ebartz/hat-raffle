// Raffle logic of the backend. Keep isWinningScan in sync with src/app/core/winner.ts.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const SMALL_PRIMES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n];

function modPow(base, exp, mod) {
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

export function isPrime(value) {
  const n = BigInt(value);
  if (n < 2n) return false;
  for (const p of SMALL_PRIMES) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let d = n - 1n;
  let r = 0;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    r++;
  }
  witness: for (const a of SMALL_PRIMES) {
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let i = 1; i < r; i++) {
      x = (x * x) % n;
      if (x === n - 1n) continue witness;
    }
    return false;
  }
  return true;
}

export const RANDOM_BLOCK_SIZE = 100;

export function isWinningScan(
  rule,
  number,
  code,
  { previous = [], hatsPer100 = 0, random = Math.random } = {},
) {
  if (rule === 'code') {
    const digits = code.replace(/\D/g, '');
    return digits.length > 0 && isPrime(BigInt(digits));
  }
  if (rule === 'random') {
    // Exactly `hatsPer100` random winners within every block of 100 scans.
    const perBlock = Math.min(RANDOM_BLOCK_SIZE, Math.max(0, Math.round(Number(hatsPer100) || 0)));
    const blockStart = Math.floor((number - 1) / RANDOM_BLOCK_SIZE) * RANDOM_BLOCK_SIZE + 1;
    const wonInBlock = previous.filter((s) => s.number >= blockStart && s.winner).length;
    const hatsLeft = perBlock - wonInBlock;
    const scansLeft = blockStart + RANDOM_BLOCK_SIZE - number;
    return hatsLeft > 0 && random() * scansLeft < hatsLeft;
  }
  return isPrime(number);
}

export function normalizeCode(raw) {
  // eslint-disable-next-line no-control-regex
  return String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
}

/** Stores all scans in a JSON file. Writes are atomic (temp file + rename) and serialized. */
export class RaffleStore {
  constructor(file) {
    this.file = file;
    this.scans = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    this.byCode = new Map(this.scans.map((s) => [s.code, s]));
    this.writeChain = Promise.resolve();
    mkdirSync(dirname(file), { recursive: true });
  }

  get stats() {
    return { total: this.scans.length, winners: this.scans.filter((s) => s.winner).length };
  }

  /** Registers a scan. Synchronous bookkeeping guarantees unique, gap-free numbers. */
  async register(rawCode, { rule = 'counter', hatsTotal = 0, hatsPer100 = 0, station = '' } = {}) {
    const code = normalizeCode(rawCode);
    const existing = this.byCode.get(code);
    if (existing) return { status: 'duplicate', record: existing, soldOut: false };

    const number = this.scans.length + 1;
    const safeRule = ['code', 'random'].includes(rule) ? rule : 'counter';
    const wouldWin = isWinningScan(safeRule, number, code, { previous: this.scans, hatsPer100 });
    const limit = Math.max(0, Number(hatsTotal) || 0);
    const soldOut = wouldWin && limit > 0 && this.stats.winners >= limit;
    const record = {
      code,
      number,
      winner: wouldWin && !soldOut,
      station: String(station ?? '').slice(0, 100),
      timestamp: new Date().toISOString(),
    };
    this.scans.push(record);
    this.byCode.set(code, record);
    await this.persist();
    return { status: 'new', record, soldOut };
  }

  persist() {
    const data = JSON.stringify(this.scans, null, 2);
    this.writeChain = this.writeChain.then(async () => {
      const tmp = `${this.file}.tmp`;
      await writeFile(tmp, data);
      await rename(tmp, this.file);
    });
    return this.writeChain;
  }
}

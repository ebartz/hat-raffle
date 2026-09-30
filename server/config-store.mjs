// Shared raffle configuration: every station connected to this backend uses the same values.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const DEFAULT_CONFIG = {
  winnerRule: 'counter',
  hatsPer100: 10,
  hatsTotal: 0,
  idleSeconds: 30,
  resultSeconds: 8,
  language: 'de',
  idleHeadlines: [],
  idleSubline: '',
  idleCta: '',
  showRemoteResults: true,
};

const int = (v, min, max, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const text = (v, max = 200) => String(v ?? '').slice(0, max);

/** Keeps only known keys with sane values. */
export function sanitizeConfig(input, base = DEFAULT_CONFIG) {
  const c = { ...base, ...(input && typeof input === 'object' ? input : {}) };
  return {
    winnerRule: ['counter', 'code', 'random'].includes(c.winnerRule) ? c.winnerRule : 'counter',
    hatsPer100: int(c.hatsPer100, 0, 100, DEFAULT_CONFIG.hatsPer100),
    hatsTotal: int(c.hatsTotal, 0, 1_000_000, 0),
    idleSeconds: int(c.idleSeconds, 0, 86_400, DEFAULT_CONFIG.idleSeconds),
    resultSeconds: int(c.resultSeconds, 1, 600, DEFAULT_CONFIG.resultSeconds),
    language: c.language === 'en' ? 'en' : 'de',
    idleHeadlines: (Array.isArray(c.idleHeadlines) ? c.idleHeadlines : [])
      .map((h) => text(h).trim())
      .filter(Boolean)
      .slice(0, 20),
    idleSubline: text(c.idleSubline, 300),
    idleCta: text(c.idleCta),
    showRemoteResults: c.showRemoteResults !== false,
  };
}

export class ConfigStore {
  constructor(file) {
    this.file = file;
    const stored = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    this.value = sanitizeConfig(stored.config);
    this.pin = stored.pin ?? null; // { salt, hash }
    this.writeChain = Promise.resolve();
    mkdirSync(dirname(file), { recursive: true });
  }

  get pinSet() {
    return !!this.pin;
  }

  /** Public view of the config – never contains the PIN hash. */
  get publicValue() {
    return { ...this.value, pinSet: this.pinSet };
  }

  checkPin(pin) {
    if (!this.pin) return true;
    if (typeof pin !== 'string' || !pin) return false;
    const hash = scryptSync(pin, Buffer.from(this.pin.salt, 'hex'), 32);
    return timingSafeEqual(hash, Buffer.from(this.pin.hash, 'hex'));
  }

  async update(input, { newPin } = {}) {
    this.value = sanitizeConfig(input, this.value);
    if (newPin === null || newPin === '') {
      this.pin = null;
    } else if (typeof newPin === 'string') {
      const salt = randomBytes(16);
      this.pin = { salt: salt.toString('hex'), hash: scryptSync(newPin, salt, 32).toString('hex') };
    }
    await this.persist();
    return this.publicValue;
  }

  persist() {
    const data = JSON.stringify({ config: this.value, pin: this.pin }, null, 2);
    this.writeChain = this.writeChain.then(async () => {
      const tmp = `${this.file}.tmp`;
      await writeFile(tmp, data);
      await rename(tmp, this.file);
    });
    return this.writeChain;
  }
}

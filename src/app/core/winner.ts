import { isPrime, numericPart } from './prime';
import { WinnerRule } from './settings.service';

/** Decides whether a participant wins. Must stay in sync with server/raffle.mjs. */
export function isWinningScan(rule: WinnerRule, number: number, code: string): boolean {
  if (rule === 'code') {
    const n = numericPart(code);
    return n !== null && isPrime(n);
  }
  return isPrime(number);
}

/** Removes whitespace and control characters that scanners sometimes add. */
export function normalizeCode(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f]/g, '').trim();
}

import { isPrime, numericPart } from './prime';
import { WinnerRule } from './settings.service';

export const RANDOM_BLOCK_SIZE = 100;

export interface WinnerContext {
  /** All scans registered before this one. */
  previous: readonly { number: number; winner: boolean }[];
  hatsPer100: number;
  random?: () => number;
}

/** Decides whether a participant wins. Must stay in sync with server/raffle.mjs. */
export function isWinningScan(
  rule: WinnerRule,
  number: number,
  code: string,
  ctx: WinnerContext,
): boolean {
  if (rule === 'code') {
    const n = numericPart(code);
    return n !== null && isPrime(n);
  }
  if (rule === 'random') {
    return isRandomWinner(number, ctx);
  }
  return isPrime(number);
}

/**
 * Draws exactly `hatsPer100` winners at random positions within every block of 100 scans:
 * each scan wins with probability (hats still to hand out in this block) / (scans left in this block).
 */
function isRandomWinner(
  number: number,
  { previous, hatsPer100, random = Math.random }: WinnerContext,
): boolean {
  const perBlock = Math.min(RANDOM_BLOCK_SIZE, Math.max(0, Math.round(hatsPer100)));
  const blockStart = Math.floor((number - 1) / RANDOM_BLOCK_SIZE) * RANDOM_BLOCK_SIZE + 1;
  const wonInBlock = previous.filter((s) => s.number >= blockStart && s.winner).length;
  const hatsLeft = perBlock - wonInBlock;
  const scansLeft = blockStart + RANDOM_BLOCK_SIZE - number;
  return hatsLeft > 0 && random() * scansLeft < hatsLeft;
}

/** Removes whitespace and control characters that scanners sometimes add. */
export function normalizeCode(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f]/g, '').trim();
}

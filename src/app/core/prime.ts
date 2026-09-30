const SMALL_PRIMES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n];

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

/**
 * Miller-Rabin primality test. Deterministic for n < 3.3 * 10^24, which covers
 * every realistic participant counter and badge number.
 */
export function isPrime(value: number | bigint): boolean {
  const n = typeof value === 'bigint' ? value : BigInt(Math.trunc(value));
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

/** Extracts all digits of a scanned code as one number, e.g. "AB-0017" -> 17n. */
export function numericPart(code: string): bigint | null {
  const digits = code.replace(/\D/g, '');
  return digits.length ? BigInt(digits) : null;
}

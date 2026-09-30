import { isPrime, numericPart } from './prime';

describe('isPrime', () => {
  it('handles small numbers', () => {
    const primes = [
      2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89,
      97,
    ];
    for (let n = -5; n <= 100; n++) {
      expect(isPrime(n)).toBe(primes.includes(n));
    }
  });

  it('handles large numbers', () => {
    expect(isPrime(2147483647n)).toBe(true); // Mersenne prime 2^31-1
    expect(isPrime(2305843009213693951n)).toBe(true); // 2^61-1
    expect(isPrime(3215031751n)).toBe(false); // strong pseudoprime to bases 2,3,5,7
    expect(isPrime(1000000000000n)).toBe(false);
  });
});

describe('numericPart', () => {
  it('extracts digits', () => {
    expect(numericPart('AB-0017')).toBe(17n);
    expect(numericPart('no digits')).toBeNull();
  });
});

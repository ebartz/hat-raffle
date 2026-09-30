import { RANDOM_BLOCK_SIZE, isWinningScan } from './winner';

function simulate(scans: number, hatsPer100: number) {
  const previous: { number: number; winner: boolean }[] = [];
  for (let number = 1; number <= scans; number++) {
    previous.push({
      number,
      winner: isWinningScan('random', number, `c${number}`, { previous, hatsPer100 }),
    });
  }
  return previous;
}

describe('isWinningScan (random)', () => {
  it('draws exactly hatsPer100 winners in every block of 100', () => {
    for (const hatsPer100 of [0, 1, 10, 37, 100]) {
      const scans = simulate(3 * RANDOM_BLOCK_SIZE, hatsPer100);
      for (let block = 0; block < 3; block++) {
        const winners = scans.slice(block * 100, block * 100 + 100).filter((s) => s.winner).length;
        expect(winners).toBe(hatsPer100);
      }
    }
  });

  it('spreads winners randomly', () => {
    const a = simulate(100, 10).map((s) => s.winner);
    const b = simulate(100, 10).map((s) => s.winner);
    const c = simulate(100, 10).map((s) => s.winner);
    expect(a.join() === b.join() && b.join() === c.join()).toBe(false);
  });

  it('uses the injected random source', () => {
    expect(isWinningScan('random', 1, 'x', { previous: [], hatsPer100: 10, random: () => 0 })).toBe(
      true,
    );
    expect(
      isWinningScan('random', 1, 'x', { previous: [], hatsPer100: 10, random: () => 0.99 }),
    ).toBe(false);
  });
});

import { SeededRandom } from './seeded-random';

describe('SeededRandom', () => {
  const draws = (seed: number, count: number) => {
    const random = new SeededRandom(seed);

    return Array.from({ length: count }, () => random.next());
  };

  it('repeats the same sequence for the same seed', () => {
    expect(draws(42, 20)).toEqual(draws(42, 20));
  });

  it('gives a different sequence for another seed', () => {
    expect(draws(42, 20)).not.toEqual(draws(43, 20));
  });

  it('stays within [0, 1)', () => {
    for (const value of draws(7, 1000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('draws integers within both bounds and reaches each of them', () => {
    const random = new SeededRandom(1);
    const values = new Set(Array.from({ length: 500 }, () => random.int(1, 5)));

    expect([...values].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('picks an element of the list', () => {
    const random = new SeededRandom(3);
    const items = ['a', 'b', 'c'];

    expect(items).toContain(random.pick(items));
  });

  it('shuffles into a permutation without touching the input', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = new SeededRandom(9).shuffle(items);

    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    expect(shuffled).not.toEqual(items);
  });
});

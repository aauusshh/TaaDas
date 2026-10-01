// Seeded, serializable random numbers (mulberry32). The only randomness allowed in the engine.
export interface Rng {
  /** float in [0, 1) */
  next(): number;
  /** integer in [0, maxExclusive) */
  int(maxExclusive: number): number;
  /** integer in [min, max] inclusive */
  range(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** Fisher-Yates; returns a new array */
  shuffle<T>(items: readonly T[]): T[];
  /** serializable state, pass to restoreRng */
  getState(): number;
}

function hashSeed(seed: number | string): number {
  if (typeof seed === 'number') return seed >>> 0;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function restoreRng(state: number): Rng {
  let a = state >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  return {
    next,
    int,
    range: (min, max) => min + int(max - min + 1),
    pick: (items) => items[int(items.length)],
    shuffle: (items) => {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    getState: () => a,
  };
}

export function createRng(seed: number | string): Rng {
  return restoreRng(hashSeed(seed));
}

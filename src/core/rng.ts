/**
 * Deterministic RNG. The sim must replay from (seed + event log), so nothing
 * else may call Math.random().
 */
export interface Rng {
  next(): number;
}

export function makeRng(seed: number): Rng {
  let s = seed >>> 0 || 0x9e3779b9;
  return {
    next() {
      // mulberry32
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Weighted pick. Weights must be positive; returns undefined for an empty list. */
export function pickWeighted<T>(rng: Rng, items: readonly T[], weight: (item: T) => number): T | undefined {
  const weights = items.map(weight);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return undefined;
  let roll = rng.next() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

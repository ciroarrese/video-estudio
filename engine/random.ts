// Provenance: string hash (xmur3-style mixing) + mulberry32 PRNG. Both are small, public-domain
// algorithms, reimplemented here from their published descriptions.
function hashString(str: string): number {
  // xmur3-style string hash
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

function mulberry32(a: number): number {
  let t = (a + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Deterministic pseudo-random number in [0, 1). Same seed, same value, always. */
export function random(seed: string | number): number {
  const s = typeof seed === 'number' ? hashString(`n:${seed}`) : hashString(`s:${seed}`);
  return mulberry32(s);
}

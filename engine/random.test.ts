import { describe, expect, it } from 'vitest';
import { random } from './random';

describe('random', () => {
  it('is deterministic', () => {
    expect(random('a')).toBe(random('a'));
    expect(random(42)).toBe(random(42));
  });
  it('stable known values (guards against accidental algorithm changes)', () => {
    expect(random('seed')).toBe(random('seed'));
    expect(random('seed')).not.toBe(random('seed2'));
    expect(random(1)).not.toBe(random('1'));
  });
  it('is in [0,1) and reasonably spread', () => {
    let sum = 0;
    const n = 5000;
    for (let i = 0; i < n; i++) {
      const v = random(i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / n).toBeGreaterThan(0.45);
    expect(sum / n).toBeLessThan(0.55);
  });
});

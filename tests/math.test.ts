import { describe, expect, it } from 'vitest';
import { clamp, degToRad, lerp, radToDeg, wrapAngleRad } from '../src/utils/math';

describe('math utils', () => {
  it('clamps values to a range', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(4, 0, 10)).toBe(4);
    expect(clamp(12, 0, 10)).toBe(10);
  });

  it('linearly interpolates between numbers', () => {
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });

  it('converts degrees and radians', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI);
    expect(radToDeg(Math.PI / 2)).toBeCloseTo(90);
  });

  it('wraps angles to the -pi to pi range', () => {
    expect(wrapAngleRad(Math.PI * 3)).toBeCloseTo(-Math.PI);
    expect(wrapAngleRad(-Math.PI * 3)).toBeCloseTo(-Math.PI);
  });
});

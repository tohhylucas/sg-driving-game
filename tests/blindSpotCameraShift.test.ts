import { describe, expect, it } from 'vitest';
import { BlindSpotCameraShift } from '../src/camera/BlindSpotCameraShift';

describe('BlindSpotCameraShift', () => {
  const instantConfig = {
    maxShiftM: 0.7,
    smoothingRatePerSec: 100
  };

  it('shifts left for A-style look input and right for D-style look input', () => {
    const shift = new BlindSpotCameraShift(instantConfig);

    const left = shift.update({ look: -1 }, 1);
    const right = shift.update({ look: 1 }, 1);

    expect(left).toBe(-instantConfig.maxShiftM);
    expect(right).toBe(instantConfig.maxShiftM);
  });

  it('returns smoothly toward the normal viewpoint when look input is released', () => {
    const shift = new BlindSpotCameraShift({
      maxShiftM: 0.8,
      smoothingRatePerSec: 2
    });

    const lookedRight = shift.update({ look: 1 }, 0.5);
    const released = shift.update({ look: 0 }, 0.25);

    expect(lookedRight).toBeGreaterThan(0);
    expect(released).toBeGreaterThan(0);
    expect(released).toBeLessThan(lookedRight);
  });

  it('clamps look input before converting it to camera offset', () => {
    const shift = new BlindSpotCameraShift(instantConfig);

    expect(shift.update({ look: 4 }, 1)).toBe(instantConfig.maxShiftM);
    expect(shift.update({ look: -4 }, 1)).toBe(-instantConfig.maxShiftM);
  });
});

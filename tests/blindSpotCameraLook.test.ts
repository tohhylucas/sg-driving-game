import { describe, expect, it } from 'vitest';
import { BlindSpotCameraLook } from '../src/camera/BlindSpotCameraLook';

describe('BlindSpotCameraLook', () => {
  const instantConfig = {
    maxYawRad: Math.PI / 2,
    smoothingRatePerSec: 100
  };

  it('turns left for A-style look input and right for D-style look input', () => {
    const look = new BlindSpotCameraLook(instantConfig);

    const left = look.update({ look: -1 }, 1);
    const right = look.update({ look: 1 }, 1);

    expect(left).toBe(-instantConfig.maxYawRad);
    expect(right).toBe(instantConfig.maxYawRad);
  });

  it('returns smoothly toward the forward view when look input is released', () => {
    const look = new BlindSpotCameraLook({
      maxYawRad: Math.PI / 2,
      smoothingRatePerSec: 2
    });

    const lookedRight = look.update({ look: 1 }, 0.5);
    const released = look.update({ look: 0 }, 0.25);

    expect(lookedRight).toBeGreaterThan(0);
    expect(released).toBeGreaterThan(0);
    expect(released).toBeLessThan(lookedRight);
  });

  it('clamps look input before converting it to camera yaw', () => {
    const look = new BlindSpotCameraLook(instantConfig);

    expect(look.update({ look: 4 }, 1)).toBe(instantConfig.maxYawRad);
    expect(look.update({ look: -4 }, 1)).toBe(-instantConfig.maxYawRad);
  });
});

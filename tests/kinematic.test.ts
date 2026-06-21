import { describe, expect, it } from 'vitest';
import { VEHICLE_CONFIG } from '../src/config/constants';
import type { CarState, InputState } from '../src/types';
import { KinematicModel } from '../src/vehicle/KinematicModel';

describe('KinematicModel', () => {
  const stoppedAtOrigin: CarState = {
    position: { x: 0, y: 0, z: 0 },
    headingRad: 0,
    speedMps: 0
  };

  const noInput: InputState = {
    throttle: 0,
    brake: 0,
    steer: 0
  };

  it('accelerates forward and moves toward -Z from the forward heading', () => {
    const model = new KinematicModel();

    const next = model.step(stoppedAtOrigin, { ...noInput, throttle: 1 }, 1);

    expect(next.speedMps).toBeGreaterThan(0);
    expect(next.speedMps).toBeLessThanOrEqual(VEHICLE_CONFIG.maxForwardSpeedMps);
    expect(next.position.x).toBeCloseTo(0);
    expect(next.position.z).toBeLessThan(0);
  });

  it('brakes a forward-moving car toward zero speed', () => {
    const model = new KinematicModel();
    const movingForward: CarState = {
      ...stoppedAtOrigin,
      speedMps: 5
    };

    const next = model.step(movingForward, { ...noInput, brake: 1 }, 0.5);

    expect(next.speedMps).toBeLessThan(movingForward.speedMps);
    expect(next.speedMps).toBeGreaterThanOrEqual(0);
  });

  it('starts reversing after braking reaches zero speed', () => {
    const model = new KinematicModel();

    const next = model.step(stoppedAtOrigin, { ...noInput, brake: 1 }, 1);

    expect(next.speedMps).toBeLessThan(0);
    expect(next.position.z).toBeGreaterThan(0);
  });

  it('caps forward and reverse speed', () => {
    const model = new KinematicModel();
    const almostAtForwardCap: CarState = {
      ...stoppedAtOrigin,
      speedMps: VEHICLE_CONFIG.maxForwardSpeedMps - 1
    };
    const almostAtReverseCap: CarState = {
      ...stoppedAtOrigin,
      speedMps: -VEHICLE_CONFIG.maxReverseSpeedMps + 1
    };

    const forward = model.step(
      almostAtForwardCap,
      { ...noInput, throttle: 1 },
      10
    );
    const reverse = model.step(
      almostAtReverseCap,
      { ...noInput, brake: 1 },
      10
    );

    expect(forward.speedMps).toBe(VEHICLE_CONFIG.maxForwardSpeedMps);
    expect(reverse.speedMps).toBe(-VEHICLE_CONFIG.maxReverseSpeedMps);
  });

  it('turns toward -X for positive steer while driving forward', () => {
    const model = new KinematicModel();
    const movingForward: CarState = {
      ...stoppedAtOrigin,
      speedMps: 6
    };

    const next = model.step(movingForward, { ...noInput, steer: 1 }, 1);

    expect(next.headingRad).toBeGreaterThan(movingForward.headingRad);
    expect(next.position.x).toBeLessThan(movingForward.position.x);
    expect(next.position.z).toBeLessThan(movingForward.position.z);
  });
});

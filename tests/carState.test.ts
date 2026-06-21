import { describe, expect, it } from 'vitest';
import { CAR_CONFIG, ROAD_CONFIG } from '../src/config/constants';
import { Car } from '../src/vehicle/Car';
import { createInitialCarState } from '../src/vehicle/carState';

describe('initial car state', () => {
  it('spawns stopped in the Singapore keep-left lane facing forward', () => {
    const state = createInitialCarState();

    expect(state.position.x).toBeCloseTo(ROAD_CONFIG.leftLaneCenterXM);
    expect(state.position.y).toBe(CAR_CONFIG.spawnHeightM);
    expect(state.position.z).toBe(0);
    expect(state.headingRad).toBe(0);
    expect(state.speedMps).toBe(0);
  });

  it('initializes the rendered car with the same parked state', () => {
    const car = new Car();
    const state = createInitialCarState();

    expect(car.state).toEqual(state);
    expect(car.object.position.x).toBeCloseTo(state.position.x);
    expect(car.object.position.y).toBeCloseTo(state.position.y);
    expect(car.object.position.z).toBeCloseTo(state.position.z);
    expect(car.object.rotation.y).toBeCloseTo(state.headingRad);
  });
});

import { describe, expect, it } from 'vitest';
import { CarController } from '../src/vehicle/CarController';
import { Car } from '../src/vehicle/Car';
import { KinematicModel } from '../src/vehicle/KinematicModel';

describe('CarController', () => {
  it('applies kinematic updates to the car state and transform', () => {
    const car = new Car();
    const controller = new CarController(car);

    controller.update({ throttle: 1, brake: 0, steer: 0 }, 1);

    expect(car.state.speedMps).toBeGreaterThan(0);
    expect(car.object.position.x).toBeCloseTo(car.state.position.x);
    expect(car.object.position.y).toBeCloseTo(car.state.position.y);
    expect(car.object.position.z).toBeCloseTo(car.state.position.z);
    expect(car.object.rotation.y).toBeCloseTo(car.state.headingRad);
  });

  it('smooths steering before applying it to the model', () => {
    const car = new Car();
    const controller = new CarController(car);
    const movingState = {
      ...car.state,
      speedMps: 6
    };
    const input = { throttle: 0, brake: 0, steer: 1 };
    const dtSec = 1 / 60;
    const rawSteerState = new KinematicModel().step(movingState, input, dtSec);

    car.applyState(movingState);
    controller.update(input, dtSec);

    expect(car.state.headingRad).toBeGreaterThan(movingState.headingRad);
    expect(car.state.headingRad).toBeLessThan(rawSteerState.headingRad);
  });
});

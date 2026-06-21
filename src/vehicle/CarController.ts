import { VEHICLE_CONFIG } from '../config/constants';
import type { InputState } from '../types';
import { clamp, lerp } from '../utils/math';
import type { Car } from './Car';
import { KinematicModel } from './KinematicModel';

export class CarController {
  private readonly model = new KinematicModel();
  private smoothedSteer = 0;

  constructor(private readonly car: Car) {}

  /** Applies player input to the car through the kinematic model. */
  update(input: InputState, dtSec: number): void {
    this.smoothedSteer = lerp(
      this.smoothedSteer,
      input.steer,
      clamp(dtSec * VEHICLE_CONFIG.steerSmoothingRatePerSec, 0, 1)
    );

    this.car.applyState(
      this.model.step(
        this.car.state,
        {
          throttle: input.throttle,
          brake: input.brake,
          steer: this.smoothedSteer
        },
        dtSec
      )
    );
  }
}

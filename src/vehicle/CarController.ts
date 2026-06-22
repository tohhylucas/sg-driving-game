import { VEHICLE_CONFIG } from '../config/constants';
import type { DriveInputState } from '../types';
import { clamp, lerp } from '../utils/math';
import type { Car } from './Car';
import { KinematicModel } from './KinematicModel';

export class CarController {
  private readonly model = new KinematicModel();
  private smoothedSteer = 0;

  constructor(private readonly car: Car) {}

  /** Current smoothed steering amount for cockpit instruments. */
  get steerAmount(): number {
    return this.smoothedSteer;
  }

  /** Applies player input to the car through the kinematic model. */
  update(input: DriveInputState, dtSec: number): void {
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

  /** Clears smoothed steering state after a session reset. */
  reset(): void {
    this.smoothedSteer = 0;
  }
}

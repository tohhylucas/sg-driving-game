import { VEHICLE_CONFIG } from '../config/constants';
import type { CarState, DriveInputState } from '../types';
import { clamp, wrapAngleRad } from '../utils/math';

export class KinematicModel {
  /** Advances the car state using Phase 1 kinematic controls. */
  step(state: CarState, input: DriveInputState, dtSec: number): CarState {
    let speedMps = state.speedMps;

    if (input.brake > 0 && speedMps > 0) {
      speedMps = Math.max(
        0,
        speedMps - input.brake * VEHICLE_CONFIG.brakeDecelerationMps2 * dtSec
      );
    } else if (input.brake > 0) {
      speedMps -=
        input.brake * VEHICLE_CONFIG.reverseAccelerationMps2 * dtSec;
    } else if (input.throttle > 0) {
      speedMps += input.throttle * VEHICLE_CONFIG.accelerationMps2 * dtSec;
    } else if (speedMps > 0) {
      speedMps = Math.max(
        0,
        speedMps - VEHICLE_CONFIG.coastDecelerationMps2 * dtSec
      );
    } else if (speedMps < 0) {
      speedMps = Math.min(
        0,
        speedMps + VEHICLE_CONFIG.coastDecelerationMps2 * dtSec
      );
    }

    speedMps = clamp(
      speedMps,
      -VEHICLE_CONFIG.maxReverseSpeedMps,
      VEHICLE_CONFIG.maxForwardSpeedMps
    );

    const steerRad =
      clamp(input.steer, -1, 1) * VEHICLE_CONFIG.maxSteerRad;
    const headingRad = wrapAngleRad(
      state.headingRad +
        (speedMps / VEHICLE_CONFIG.wheelBaseM) * Math.tan(steerRad) * dtSec
    );
    const forwardXM = -Math.sin(headingRad);
    const forwardZM = -Math.cos(headingRad);

    return {
      position: {
        x: state.position.x + forwardXM * speedMps * dtSec,
        y: state.position.y,
        z: state.position.z + forwardZM * speedMps * dtSec
      },
      headingRad,
      speedMps
    };
  }
}

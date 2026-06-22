import { COCKPIT_UI_CONFIG } from '../config/constants';
import { clamp } from '../utils/math';

const KMH_PER_MPS = 3.6;

/** Converts car speed in metres per second to speedometer km/h. */
export function metersPerSecondToKmh(speedMps: number): number {
  return Math.abs(speedMps) * KMH_PER_MPS;
}

/** Formats a speedometer value as a whole km/h number. */
export function formatSpeedKmh(speedKmh: number): string {
  return Math.round(speedKmh).toString();
}

/** Maps normalized steering input to cockpit wheel rotation in degrees. */
export function steerToWheelRotationDeg(steer: number): number {
  const boundedSteer = clamp(steer, -1, 1);

  if (boundedSteer === 0) {
    return 0;
  }

  return -boundedSteer * COCKPIT_UI_CONFIG.steeringWheel.maxRotationDeg;
}

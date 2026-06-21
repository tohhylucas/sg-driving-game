import { CAR_CONFIG, ROAD_CONFIG } from '../config/constants';
import type { CarState } from '../types';

/** Creates the parked M2 car state at the Singapore keep-left spawn. */
export function createInitialCarState(): CarState {
  return {
    position: {
      x: ROAD_CONFIG.leftLaneCenterXM,
      y: CAR_CONFIG.spawnHeightM,
      z: CAR_CONFIG.spawnZM
    },
    headingRad: CAR_CONFIG.forwardHeadingRad,
    speedMps: CAR_CONFIG.initialSpeedMps
  };
}

import { COCKPIT_CAMERA_CONFIG } from '../config/constants';
import { clamp, lerp } from '../utils/math';

interface BlindSpotCameraShiftConfig {
  maxShiftM: number;
  smoothingRatePerSec: number;
}

interface BlindSpotCameraLookInput {
  look: number;
}

export class BlindSpotCameraShift {
  private readonly config: BlindSpotCameraShiftConfig;
  private shiftM = 0;

  constructor(config: Partial<BlindSpotCameraShiftConfig> = {}) {
    this.config = {
      maxShiftM: COCKPIT_CAMERA_CONFIG.blindSpotMaxShiftM,
      smoothingRatePerSec: COCKPIT_CAMERA_CONFIG.blindSpotSmoothingRatePerSec,
      ...config
    };
  }

  /** Current lateral camera shift in local car metres; negative is left. */
  get currentShiftM(): number {
    return this.shiftM;
  }

  /** Smoothly updates the blind-spot camera shift from look input. */
  update(input: BlindSpotCameraLookInput, dtSec: number): number {
    const targetShiftM =
      clamp(input.look, -1, 1) * this.config.maxShiftM;
    this.shiftM = lerp(
      this.shiftM,
      targetShiftM,
      clamp(dtSec * this.config.smoothingRatePerSec, 0, 1)
    );

    return this.shiftM;
  }
}

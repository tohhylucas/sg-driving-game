import { COCKPIT_CAMERA_CONFIG } from '../config/constants';
import { clamp, lerp } from '../utils/math';

interface BlindSpotCameraLookConfig {
  maxYawRad: number;
  smoothingRatePerSec: number;
}

interface BlindSpotCameraLookInput {
  look: number;
}

export class BlindSpotCameraLook {
  private readonly config: BlindSpotCameraLookConfig;
  private yawRad = 0;

  constructor(config: Partial<BlindSpotCameraLookConfig> = {}) {
    this.config = {
      maxYawRad: COCKPIT_CAMERA_CONFIG.blindSpotMaxYawRad,
      smoothingRatePerSec: COCKPIT_CAMERA_CONFIG.blindSpotSmoothingRatePerSec,
      ...config
    };
  }

  /** Current camera yaw offset in local car radians; negative is left. */
  get currentYawRad(): number {
    return this.yawRad;
  }

  /** Smoothly updates the blind-spot camera yaw from look input. */
  update(input: BlindSpotCameraLookInput, dtSec: number): number {
    const targetYawRad = clamp(input.look, -1, 1) * this.config.maxYawRad;
    this.yawRad = lerp(
      this.yawRad,
      targetYawRad,
      clamp(dtSec * this.config.smoothingRatePerSec, 0, 1)
    );

    return this.yawRad;
  }
}

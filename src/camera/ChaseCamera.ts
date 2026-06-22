import * as THREE from 'three';
import { CHASE_CAMERA_CONFIG, RENDER_CONFIG } from '../config/constants';
import type { CarState } from '../types';

interface ChaseCameraConfig {
  distanceM: number;
  heightM: number;
  lateralOffsetM: number;
  lookAheadM: number;
  lookAtHeightM: number;
  viewLateralOffsetM: number;
}

interface ChaseCameraRuntimeOffset {
  lookYawRad?: number;
}

export class ChaseCamera {
  readonly camera = new THREE.PerspectiveCamera(
    RENDER_CONFIG.cameraFovDeg,
    1,
    RENDER_CONFIG.cameraNear,
    RENDER_CONFIG.cameraFar
  );

  private readonly config: ChaseCameraConfig;

  constructor(config: Partial<ChaseCameraConfig> = {}) {
    this.config = {
      ...CHASE_CAMERA_CONFIG,
      ...config
    };
  }

  /** Positions the driving camera from the configured car-relative viewpoint. */
  update(state: CarState, offset: ChaseCameraRuntimeOffset = {}): void {
    const forwardX = -Math.sin(state.headingRad);
    const forwardZ = -Math.cos(state.headingRad);
    const rightX = Math.cos(state.headingRad);
    const rightZ = -Math.sin(state.headingRad);
    const lookYawRad = offset.lookYawRad ?? 0;
    const lookDirectionX =
      forwardX * Math.cos(lookYawRad) + rightX * Math.sin(lookYawRad);
    const lookDirectionZ =
      forwardZ * Math.cos(lookYawRad) + rightZ * Math.sin(lookYawRad);

    this.camera.position.set(
      state.position.x -
        forwardX * this.config.distanceM +
        rightX * this.config.lateralOffsetM,
      state.position.y + this.config.heightM,
      state.position.z -
        forwardZ * this.config.distanceM +
        rightZ * this.config.lateralOffsetM
    );

    this.camera.lookAt(
      state.position.x +
        lookDirectionX * this.config.lookAheadM +
        rightX * this.config.viewLateralOffsetM,
      state.position.y + this.config.lookAtHeightM,
      state.position.z +
        lookDirectionZ * this.config.lookAheadM +
        rightZ * this.config.viewLateralOffsetM
    );
  }
}

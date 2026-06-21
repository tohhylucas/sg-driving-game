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

  /** Positions the camera behind the car and points it toward the road ahead. */
  update(state: CarState): void {
    const forwardX = -Math.sin(state.headingRad);
    const forwardZ = -Math.cos(state.headingRad);
    const rightX = Math.cos(state.headingRad);
    const rightZ = -Math.sin(state.headingRad);

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
        forwardX * this.config.lookAheadM +
        rightX * this.config.viewLateralOffsetM,
      state.position.y + this.config.lookAtHeightM,
      state.position.z +
        forwardZ * this.config.lookAheadM +
        rightZ * this.config.viewLateralOffsetM
    );
  }
}

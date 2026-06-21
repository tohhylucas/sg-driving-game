import * as THREE from 'three';
import { RENDER_CONFIG } from '../config/constants';
import type { CarState } from '../types';

interface MirrorCameraConfig {
  fovDeg: number;
  renderTargetWidthPx: number;
  renderTargetHeightPx: number;
  mountRightOffsetM: number;
  mountUpOffsetM: number;
  mountForwardOffsetM: number;
  targetRightOffsetM: number;
  targetUpOffsetM: number;
  targetForwardOffsetM: number;
}

export class MirrorCamera {
  readonly camera: THREE.PerspectiveCamera;
  readonly renderTarget: THREE.WebGLRenderTarget;

  constructor(private readonly config: MirrorCameraConfig) {
    this.camera = new THREE.PerspectiveCamera(
      config.fovDeg,
      config.renderTargetWidthPx / config.renderTargetHeightPx,
      RENDER_CONFIG.cameraNear,
      RENDER_CONFIG.cameraFar
    );
    this.renderTarget = new THREE.WebGLRenderTarget(
      config.renderTargetWidthPx,
      config.renderTargetHeightPx,
      {
        magFilter: THREE.LinearFilter,
        minFilter: THREE.LinearFilter
      }
    );
  }

  /** Mounts the mirror camera on the car and points it toward its mirror view. */
  update(state: CarState): void {
    const forwardX = -Math.sin(state.headingRad);
    const forwardZ = -Math.cos(state.headingRad);
    const rightX = Math.cos(state.headingRad);
    const rightZ = -Math.sin(state.headingRad);

    this.camera.position.set(
      state.position.x +
        rightX * this.config.mountRightOffsetM +
        forwardX * this.config.mountForwardOffsetM,
      state.position.y + this.config.mountUpOffsetM,
      state.position.z +
        rightZ * this.config.mountRightOffsetM +
        forwardZ * this.config.mountForwardOffsetM
    );

    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(
      state.position.x +
        rightX * this.config.targetRightOffsetM +
        forwardX * this.config.targetForwardOffsetM,
      state.position.y + this.config.targetUpOffsetM,
      state.position.z +
        rightZ * this.config.targetRightOffsetM +
        forwardZ * this.config.targetForwardOffsetM
    );
  }

  dispose(): void {
    this.renderTarget.dispose();
  }
}

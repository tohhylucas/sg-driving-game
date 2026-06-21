import * as THREE from 'three';
import { RENDER_CONFIG } from '../config/constants';

export class MirrorCamera {
  readonly camera = new THREE.PerspectiveCamera(
    RENDER_CONFIG.cameraFovDeg,
    1,
    RENDER_CONFIG.cameraNear,
    RENDER_CONFIG.cameraFar
  );

  readonly renderTarget = new THREE.WebGLRenderTarget(1, 1);

  dispose(): void {
    this.renderTarget.dispose();
  }
}

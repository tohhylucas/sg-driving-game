import * as THREE from 'three';
import { RENDER_CONFIG } from '../config/constants';

export class Engine {
  readonly scene: THREE.Scene;
  readonly clock: THREE.Clock;

  private readonly renderer: THREE.WebGLRenderer;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setClearColor(RENDER_CONFIG.clearColor, 1);
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, RENDER_CONFIG.maxDevicePixelRatio)
    );
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}

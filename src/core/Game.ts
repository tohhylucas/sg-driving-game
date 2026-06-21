import * as THREE from 'three';
import { RENDER_CONFIG } from '../config/constants';
import { Engine } from './Engine';
import { Loop } from './Loop';

interface GameOptions {
  canvas: HTMLCanvasElement;
  uiRoot: HTMLElement;
}

export class Game {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly engine: Engine;
  private readonly loop = new Loop();
  private readonly resizeObserver: ResizeObserver;

  constructor({ canvas, uiRoot }: GameOptions) {
    this.engine = new Engine(canvas);
    this.camera = new THREE.PerspectiveCamera(
      RENDER_CONFIG.cameraFovDeg,
      1,
      RENDER_CONFIG.cameraNear,
      RENDER_CONFIG.cameraFar
    );
    this.camera.position.set(0, 2.5, 8);
    this.camera.lookAt(0, 0, 0);

    uiRoot.dataset.phase = 'm0';

    this.resizeObserver = new ResizeObserver(() => this.resize(canvas));
    this.resizeObserver.observe(canvas);
    this.resize(canvas);
  }

  start(): void {
    this.loop.start(
      () => this.update(),
      () => this.engine.render(this.camera)
    );
  }

  dispose(): void {
    this.loop.stop();
    this.resizeObserver.disconnect();
    this.engine.dispose();
  }

  private resize(canvas: HTMLCanvasElement): void {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    this.engine.resize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private update(): void {
    // M0 intentionally has no world or vehicle logic yet.
  }
}

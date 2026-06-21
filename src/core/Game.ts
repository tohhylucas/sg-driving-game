import * as THREE from 'three';
import { FIXED_CAMERA_CONFIG, RENDER_CONFIG } from '../config/constants';
import { World } from '../world/World';
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
  private readonly world: World;

  constructor({ canvas, uiRoot }: GameOptions) {
    this.engine = new Engine(canvas);
    this.camera = new THREE.PerspectiveCamera(
      RENDER_CONFIG.cameraFovDeg,
      1,
      RENDER_CONFIG.cameraNear,
      RENDER_CONFIG.cameraFar
    );
    this.camera.position.set(
      FIXED_CAMERA_CONFIG.positionXM,
      FIXED_CAMERA_CONFIG.positionYM,
      FIXED_CAMERA_CONFIG.positionZM
    );
    this.camera.lookAt(
      FIXED_CAMERA_CONFIG.lookAtXM,
      FIXED_CAMERA_CONFIG.lookAtYM,
      FIXED_CAMERA_CONFIG.lookAtZM
    );

    this.world = new World();
    this.engine.scene.background = this.world.sky.color;
    this.engine.scene.add(this.world.object);

    uiRoot.dataset.phase = 'm1';

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
    // M1 is a static world slice; later milestones add vehicle updates.
  }
}

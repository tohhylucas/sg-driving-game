import { ChaseCamera } from '../camera/ChaseCamera';
import { MirrorCamera } from '../camera/MirrorCamera';
import { COCKPIT_CAMERA_CONFIG, MIRROR_CONFIG } from '../config/constants';
import type { MirrorId } from '../types';
import { Cockpit } from '../ui/Cockpit';
import { Car } from '../vehicle/Car';
import { CarController } from '../vehicle/CarController';
import { World } from '../world/World';
import { Engine, type TextureOverlay } from './Engine';
import { Input } from './Input';
import { Loop } from './Loop';

interface GameOptions {
  canvas: HTMLCanvasElement;
  uiRoot: HTMLElement;
}

interface GameMirror {
  id: MirrorId;
  camera: MirrorCamera;
}

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly car: Car;
  private readonly carController: CarController;
  private readonly chaseCamera: ChaseCamera;
  private readonly cockpit: Cockpit;
  private readonly engine: Engine;
  private readonly input = new Input();
  private readonly loop = new Loop();
  private readonly mirrors: GameMirror[];
  private readonly resizeObserver: ResizeObserver;
  private readonly world: World;

  constructor({ canvas, uiRoot }: GameOptions) {
    this.canvas = canvas;
    this.engine = new Engine(canvas);
    this.world = new World();
    this.car = new Car();
    this.carController = new CarController(this.car);
    this.chaseCamera = new ChaseCamera(COCKPIT_CAMERA_CONFIG);
    this.cockpit = new Cockpit(uiRoot);
    this.mirrors = [
      {
        id: 'rearview',
        camera: new MirrorCamera(MIRROR_CONFIG.rearview.camera)
      },
      {
        id: 'leftSide',
        camera: new MirrorCamera(MIRROR_CONFIG.leftSide.camera)
      },
      {
        id: 'rightSide',
        camera: new MirrorCamera(MIRROR_CONFIG.rightSide.camera)
      }
    ];
    this.chaseCamera.update(this.car.state);
    this.cockpit.update({
      speedMps: this.car.state.speedMps,
      steer: this.carController.steerAmount
    });
    this.engine.scene.background = this.world.sky.color;
    this.engine.scene.add(this.world.object);
    this.engine.scene.add(this.car.object);

    uiRoot.dataset.phase = 'm4';

    this.resizeObserver = new ResizeObserver(() => this.resize(canvas));
    this.resizeObserver.observe(canvas);
    this.resize(canvas);
  }

  start(): void {
    this.input.start();
    this.loop.start(
      (dtSec) => this.update(dtSec),
      () => this.render()
    );
  }

  dispose(): void {
    this.input.stop();
    this.loop.stop();
    this.resizeObserver.disconnect();
    for (const mirror of this.mirrors) {
      mirror.camera.dispose();
    }
    this.cockpit.dispose();
    this.engine.dispose();
  }

  private resize(canvas: HTMLCanvasElement): void {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    this.engine.resize(width, height);
    this.chaseCamera.camera.aspect = width / height;
    this.chaseCamera.camera.updateProjectionMatrix();
  }

  private update(dtSec: number): void {
    this.carController.update(this.input.getState(), dtSec);
    this.chaseCamera.update(this.car.state);
    this.cockpit.update({
      speedMps: this.car.state.speedMps,
      steer: this.carController.steerAmount
    });
  }

  private render(): void {
    const overlays: TextureOverlay[] = [];

    for (const mirror of this.mirrors) {
      mirror.camera.update(this.car.state);
      this.engine.renderToTarget(
        mirror.camera.camera,
        mirror.camera.renderTarget
      );

      const viewport =
        this.cockpit.mirrorViews[mirror.id].getCanvasViewport(this.canvas);

      if (viewport) {
        overlays.push({
          texture: mirror.camera.renderTarget.texture,
          viewport
        });
      }
    }

    this.engine.render(this.chaseCamera.camera, overlays);
  }
}

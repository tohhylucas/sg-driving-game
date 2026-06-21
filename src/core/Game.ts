import { ChaseCamera } from '../camera/ChaseCamera';
import { Car } from '../vehicle/Car';
import { CarController } from '../vehicle/CarController';
import { World } from '../world/World';
import { Engine } from './Engine';
import { Input } from './Input';
import { Loop } from './Loop';

interface GameOptions {
  canvas: HTMLCanvasElement;
  uiRoot: HTMLElement;
}

export class Game {
  private readonly car: Car;
  private readonly carController: CarController;
  private readonly chaseCamera: ChaseCamera;
  private readonly engine: Engine;
  private readonly input = new Input();
  private readonly loop = new Loop();
  private readonly resizeObserver: ResizeObserver;
  private readonly world: World;

  constructor({ canvas, uiRoot }: GameOptions) {
    this.engine = new Engine(canvas);
    this.world = new World();
    this.car = new Car();
    this.carController = new CarController(this.car);
    this.chaseCamera = new ChaseCamera();
    this.chaseCamera.update(this.car.state);
    this.engine.scene.background = this.world.sky.color;
    this.engine.scene.add(this.world.object);
    this.engine.scene.add(this.car.object);

    uiRoot.dataset.phase = 'm3';

    this.resizeObserver = new ResizeObserver(() => this.resize(canvas));
    this.resizeObserver.observe(canvas);
    this.resize(canvas);
  }

  start(): void {
    this.input.start();
    this.loop.start(
      (dtSec) => this.update(dtSec),
      () => this.engine.render(this.chaseCamera.camera)
    );
  }

  dispose(): void {
    this.input.stop();
    this.loop.stop();
    this.resizeObserver.disconnect();
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
  }
}

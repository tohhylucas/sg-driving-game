import { Vector3 } from 'three';
import { BlindSpotCameraLook } from '../camera/BlindSpotCameraLook';
import { ChaseCamera } from '../camera/ChaseCamera';
import { MirrorCamera } from '../camera/MirrorCamera';
import { COCKPIT_CAMERA_CONFIG, MIRROR_CONFIG } from '../config/constants';
import type { CarState, MirrorId, Vec3 } from '../types';
import {
  DrivingSession,
  type SessionRuleDiagnostics
} from '../rules/DrivingSession';
import { FollowingTimeGapRule } from '../rules/FollowingTimeGapRule';
import { KeepLeftRule } from '../rules/KeepLeftRule';
import { SideHazardRule } from '../rules/SideHazardRule';
import { StopLineRule } from '../rules/StopLineRule';
import { Cockpit } from '../ui/Cockpit';
import { Car } from '../vehicle/Car';
import { CarController } from '../vehicle/CarController';
import { createInitialCarState } from '../vehicle/carState';
import { getFixedTestTrackLayout } from '../world/testTrackLayout';
import { ScriptedMovingElementViews } from '../world/ScriptedMovingElementViews';
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

export interface GameDiagnostics {
  readonly car: CarState;
  readonly camera: {
    readonly blindSpotLookYawRad: number;
    readonly direction: Vec3;
    readonly position: Vec3;
  };
  readonly movingElements: readonly {
    readonly id: string;
    readonly kind: string;
    readonly segmentId: string;
    readonly speedMps: number;
  }[];
  readonly session: {
    readonly active: boolean;
    readonly endReason: string | undefined;
    readonly elapsedSec: number;
    readonly events: readonly {
      readonly outcome: string;
      readonly ruleId: string;
    }[];
    readonly passCount: number;
    readonly ruleDiagnostics: readonly SessionRuleDiagnostics[];
    readonly sessionId: number;
    readonly violationCount: number;
  };
}

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly car: Car;
  private readonly carController: CarController;
  private readonly blindSpotCameraLook = new BlindSpotCameraLook();
  private readonly chaseCamera: ChaseCamera;
  private readonly cockpit: Cockpit;
  private readonly track = getFixedTestTrackLayout();
  private readonly drivingSession = new DrivingSession({
    rules: [
      new KeepLeftRule(),
      new StopLineRule(),
      new SideHazardRule(),
      new FollowingTimeGapRule()
    ],
    track: this.track
  });
  private readonly engine: Engine;
  private readonly input = new Input();
  private readonly loop = new Loop();
  private readonly mirrors: GameMirror[];
  private readonly movingElements = new ScriptedMovingElementViews(this.track);
  private readonly resizeObserver: ResizeObserver;
  private readonly world: World;
  private wasResetPressed = false;

  constructor({ canvas, uiRoot }: GameOptions) {
    this.canvas = canvas;
    this.engine = new Engine(canvas);
    this.world = new World(this.track);
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
    this.drivingSession.start(this.car.state);
    this.chaseCamera.update(this.car.state);
    this.cockpit.update({
      ruleDiagnostics: this.drivingSession.ruleDiagnostics,
      score: this.drivingSession.summary,
      sessionActive: this.drivingSession.state.active,
      speedMps: this.car.state.speedMps,
      steer: this.carController.steerAmount
    });
    this.engine.scene.background = this.world.sky.color;
    this.engine.scene.add(this.world.object);
    this.engine.scene.add(this.movingElements.object);
    this.engine.scene.add(this.car.object);

    uiRoot.dataset.phase = 'm10';

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

  /** Returns read-only state for local browser smoke verification. */
  readDiagnostics(): GameDiagnostics {
    const cameraDirection = this.chaseCamera.camera.getWorldDirection(
      new Vector3()
    );
    const summary = this.drivingSession.summary;

    return {
      car: {
        position: { ...this.car.state.position },
        headingRad: this.car.state.headingRad,
        speedMps: this.car.state.speedMps
      },
      camera: {
        blindSpotLookYawRad: this.blindSpotCameraLook.currentYawRad,
        direction: {
          x: cameraDirection.x,
          y: cameraDirection.y,
          z: cameraDirection.z
        },
        position: {
          x: this.chaseCamera.camera.position.x,
          y: this.chaseCamera.camera.position.y,
          z: this.chaseCamera.camera.position.z
        }
      },
      movingElements: this.movingElements.currentStates.map((element) => ({
        id: element.id,
        kind: element.kind,
        segmentId: element.segmentId,
        speedMps: element.speedMps
      })),
      session: {
        ...this.drivingSession.state,
        events: summary.events.map((event) => ({
          outcome: event.outcome,
          ruleId: event.ruleId
        })),
        passCount: summary.passCount,
        ruleDiagnostics: this.drivingSession.ruleDiagnostics,
        violationCount: summary.violationCount
      }
    };
  }

  private resize(canvas: HTMLCanvasElement): void {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    this.engine.resize(width, height);
    this.chaseCamera.camera.aspect = width / height;
    this.chaseCamera.camera.updateProjectionMatrix();
  }

  private update(dtSec: number): void {
    const input = this.input.getState();

    if (input.reset && !this.wasResetPressed) {
      this.car.applyState(createInitialCarState());
      this.carController.reset();
      this.movingElements.update(0);
      this.drivingSession.reset(this.car.state);
    }

    this.wasResetPressed = input.reset;
    this.carController.update(input, dtSec);
    this.movingElements.update(this.drivingSession.state.elapsedSec + dtSec);
    this.drivingSession.update(
      this.car.state,
      dtSec,
      this.movingElements.currentStates
    );
    const blindSpotLookYawRad = this.blindSpotCameraLook.update(input, dtSec);
    this.chaseCamera.update(this.car.state, {
      lookYawRad: blindSpotLookYawRad
    });
    this.cockpit.update({
      ruleDiagnostics: this.drivingSession.ruleDiagnostics,
      score: this.drivingSession.summary,
      sessionActive: this.drivingSession.state.active,
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

    const wasCarVisible = this.car.object.visible;

    try {
      this.car.object.visible = false;
      this.engine.render(this.chaseCamera.camera, overlays);
    } finally {
      this.car.object.visible = wasCarVisible;
    }
  }
}

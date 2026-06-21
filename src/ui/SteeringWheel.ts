import { COCKPIT_UI_CONFIG } from '../config/constants';
import { steerToWheelRotationDeg } from './cockpitMetrics';

export class SteeringWheel {
  readonly root: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'cockpit__steering-wheel';
    this.root.dataset.instrument = 'steering-wheel';
    this.root.style.right = `${COCKPIT_UI_CONFIG.steeringWheel.rightPercent}%`;
    this.root.style.bottom = `${COCKPIT_UI_CONFIG.steeringWheel.bottomPercent}%`;
    this.root.style.width = `clamp(${COCKPIT_UI_CONFIG.steeringWheel.minSizePx}px, ${COCKPIT_UI_CONFIG.steeringWheel.sizeViewportWidth}vw, ${COCKPIT_UI_CONFIG.steeringWheel.maxSizePx}px)`;
    this.root.style.height = this.root.style.width;

    const rim = document.createElement('div');
    rim.className = 'cockpit__steering-rim';
    rim.append(createSpoke('top'));
    rim.append(createSpoke('left'));
    rim.append(createSpoke('right'));
    this.root.append(rim);
    parent.append(this.root);
  }

  /** Rotates the wheel from normalized live steering input. */
  setRotation(steer: number): void {
    const rotationDeg = steerToWheelRotationDeg(steer);
    this.root.style.setProperty('--wheel-rotation-deg', `${rotationDeg}deg`);
    this.root.dataset.steer = steer.toFixed(3);
  }
}

function createSpoke(name: string): HTMLElement {
  const spoke = document.createElement('div');
  spoke.className = `cockpit__steering-spoke cockpit__steering-spoke--${name}`;
  return spoke;
}

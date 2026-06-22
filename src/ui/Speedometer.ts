import { COCKPIT_UI_CONFIG } from '../config/constants';
import { formatSpeedKmh, metersPerSecondToKmh } from './cockpitMetrics';

export class Speedometer {
  readonly root: HTMLElement;

  private readonly value: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'cockpit__speedometer';
    this.root.dataset.instrument = 'speedometer';
    this.root.style.left = `${COCKPIT_UI_CONFIG.speedometer.leftPercent}%`;
    this.root.style.bottom = `${COCKPIT_UI_CONFIG.speedometer.bottomPercent}%`;

    this.value = document.createElement('span');
    this.value.className = 'cockpit__speedometer-value';
    const unit = document.createElement('span');
    unit.className = 'cockpit__speedometer-unit';
    unit.textContent = 'km/h';

    this.root.append(this.value, unit);
    parent.append(this.root);
  }

  /** Displays live car speed in km/h. */
  setSpeed(speedMps: number): void {
    const speedKmh = metersPerSecondToKmh(speedMps);
    this.value.textContent = formatSpeedKmh(speedKmh);
    this.root.dataset.speedKmh = speedKmh.toFixed(1);
  }
}

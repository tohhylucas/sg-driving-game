import { COCKPIT_UI_CONFIG } from '../config/constants';

export class InstructorAudio {
  readonly root: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'cockpit__instructor-audio';
    this.root.dataset.instrument = 'instructor-audio';
    this.root.style.left = `${COCKPIT_UI_CONFIG.instructorAudio.leftPercent}%`;
    this.root.style.bottom = `${COCKPIT_UI_CONFIG.instructorAudio.bottomPercent}%`;
    this.root.style.width = `${COCKPIT_UI_CONFIG.instructorAudio.sizePx}px`;
    this.root.style.height = `${COCKPIT_UI_CONFIG.instructorAudio.sizePx}px`;

    const speaker = document.createElement('div');
    speaker.className = 'cockpit__audio-speaker';
    const wave = document.createElement('div');
    wave.className = 'cockpit__audio-wave';
    this.root.append(speaker, wave);
    parent.append(this.root);
  }
}

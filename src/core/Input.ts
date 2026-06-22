import { CONTROL_KEYS } from '../config/controls';
import type { InputState } from '../types';

interface InputTarget {
  addEventListener(
    type: 'keydown' | 'keyup',
    listener: (event: KeyboardEvent) => void
  ): void;
  removeEventListener(
    type: 'keydown' | 'keyup',
    listener: (event: KeyboardEvent) => void
  ): void;
}

export class Input {
  private readonly pressedKeys = new Set<string>();

  constructor(private readonly target: InputTarget = window) {}

  start(): void {
    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
  }

  stop(): void {
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.pressedKeys.clear();
  }

  getState(): InputState {
    return {
      throttle: this.isAnyPressed(CONTROL_KEYS.accelerate) ? 1 : 0,
      brake: this.isAnyPressed(CONTROL_KEYS.brake) ? 1 : 0,
      steer:
        (this.isAnyPressed(CONTROL_KEYS.steerLeft) ? 1 : 0) -
        (this.isAnyPressed(CONTROL_KEYS.steerRight) ? 1 : 0),
      look:
        (this.isAnyPressed(CONTROL_KEYS.lookRight) ? 1 : 0) -
        (this.isAnyPressed(CONTROL_KEYS.lookLeft) ? 1 : 0)
    };
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    this.pressedKeys.add(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.code);
  };

  private isAnyPressed(keys: readonly string[]): boolean {
    return keys.some((key) => this.pressedKeys.has(key));
  }
}

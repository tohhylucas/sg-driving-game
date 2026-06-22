import { describe, expect, it } from 'vitest';
import { CONTROL_KEYS } from '../src/config/controls';
import { Input } from '../src/core/Input';

type KeyEventName = 'keydown' | 'keyup';
type KeyHandler = (event: KeyboardEvent) => void;

class FakeInputTarget {
  private readonly listeners: Record<KeyEventName, Set<KeyHandler>> = {
    keydown: new Set<KeyHandler>(),
    keyup: new Set<KeyHandler>()
  };

  addEventListener(type: KeyEventName, listener: KeyHandler): void {
    this.listeners[type].add(listener);
  }

  removeEventListener(type: KeyEventName, listener: KeyHandler): void {
    this.listeners[type].delete(listener);
  }

  press(code: string): void {
    this.dispatch('keydown', code);
  }

  release(code: string): void {
    this.dispatch('keyup', code);
  }

  private dispatch(type: KeyEventName, code: string): void {
    for (const listener of this.listeners[type]) {
      listener({ code } as KeyboardEvent);
    }
  }
}

describe('Input', () => {
  it('exposes accelerate and brake/reverse from shared control keys', () => {
    const target = new FakeInputTarget();
    const input = new Input(target);
    input.start();

    for (const key of CONTROL_KEYS.accelerate) {
      target.press(key);
      expect(input.getState().throttle).toBe(1);
      target.release(key);
      expect(input.getState().throttle).toBe(0);
    }

    for (const key of CONTROL_KEYS.brake) {
      target.press(key);
      expect(input.getState().brake).toBe(1);
      target.release(key);
      expect(input.getState().brake).toBe(0);
    }
  });

  it('exposes left and right steering from shared control keys', () => {
    const target = new FakeInputTarget();
    const input = new Input(target);
    input.start();

    for (const key of CONTROL_KEYS.steerLeft) {
      target.press(key);
      expect(input.getState().steer).toBe(1);
      target.release(key);
      expect(input.getState().steer).toBe(0);
    }

    for (const key of CONTROL_KEYS.steerRight) {
      target.press(key);
      expect(input.getState().steer).toBe(-1);
      target.release(key);
      expect(input.getState().steer).toBe(0);
    }
  });
});

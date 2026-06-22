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
  it('maps W and S to acceleration and staged brake/reverse', () => {
    const target = new FakeInputTarget();
    const input = new Input(target);
    input.start();

    target.press('KeyW');
    expect(input.getState().throttle).toBe(1);
    target.release('KeyW');
    expect(input.getState().throttle).toBe(0);

    target.press('KeyS');
    expect(input.getState().brake).toBe(1);
    target.release('KeyS');
    expect(input.getState().brake).toBe(0);

    expect(CONTROL_KEYS.accelerate).toEqual(['KeyW']);
    expect(CONTROL_KEYS.brake).toEqual(['KeyS']);
  });

  it('maps only left and right arrows to steering', () => {
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

    target.press('KeyA');
    expect(input.getState().steer).toBe(0);
    target.release('KeyA');

    target.press('KeyD');
    expect(input.getState().steer).toBe(0);
    target.release('KeyD');
  });

  it('maps A and D to blind-spot camera look state', () => {
    const target = new FakeInputTarget();
    const input = new Input(target);
    input.start();

    target.press('KeyA');
    expect(input.getState().look).toBe(-1);
    target.release('KeyA');
    expect(input.getState().look).toBe(0);

    target.press('KeyD');
    expect(input.getState().look).toBe(1);
    target.release('KeyD');
    expect(input.getState().look).toBe(0);
  });
});

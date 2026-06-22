import * as THREE from 'three';
import type { MovingElementState } from '../types';
import { makeGroup } from '../utils/three';
import { Car } from '../vehicle/Car';
import { getScriptedMovingElementStates } from './scriptedMovingElements';
import type { FixedTestTrackLayout } from './testTrackLayout';

export class ScriptedMovingElementViews {
  readonly object: THREE.Group = makeGroup('ScriptedMovingElements');

  private readonly elementCars = new Map<string, Car>();
  private states: MovingElementState[] = [];

  constructor(private readonly layout: FixedTestTrackLayout) {
    for (const element of layout.movingElements) {
      const car = new Car();

      car.object.name = `MovingElement-${element.id}`;
      this.elementCars.set(element.id, car);
      this.object.add(car.object);
    }

    this.update(0);
  }

  get currentStates(): readonly MovingElementState[] {
    return this.states;
  }

  /** Updates rendered moving-element transforms from deterministic track scripts. */
  update(elapsedSec: number): void {
    this.states = getScriptedMovingElementStates(this.layout, elapsedSec);

    for (const state of this.states) {
      const car = this.elementCars.get(state.id);

      if (!car) {
        continue;
      }

      car.applyState({
        position: state.position,
        headingRad: state.headingRad,
        speedMps: state.speedMps
      });
    }
  }
}

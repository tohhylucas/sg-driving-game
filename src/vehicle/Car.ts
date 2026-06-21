import * as THREE from 'three';
import type { CarState } from '../types';

export class Car {
  readonly object = new THREE.Group();

  state: CarState = {
    position: { x: 0, y: 0, z: 0 },
    headingRad: 0,
    speedMps: 0
  };

  constructor() {
    this.object.name = 'Car';
  }
}

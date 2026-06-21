import * as THREE from 'three';
import { WORLD_CONFIG } from '../config/constants';
import { makeGroup, makeHorizontalPlaneMesh } from '../utils/three';

export class Ground {
  readonly object: THREE.Group = makeGroup('Ground');

  constructor() {
    this.object.add(
      makeHorizontalPlaneMesh({
        name: 'GroundPlane',
        widthM: WORLD_CONFIG.groundSizeM,
        lengthM: WORLD_CONFIG.groundSizeM,
        color: WORLD_CONFIG.groundColor,
        yM: WORLD_CONFIG.groundYOffsetM
      })
    );
  }
}

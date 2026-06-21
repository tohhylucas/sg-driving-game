import * as THREE from 'three';
import { WORLD_CONFIG } from '../config/constants';
import { makeGroup } from '../utils/three';

export class Sky {
  readonly object: THREE.Group = makeGroup('Sky');
  readonly color = new THREE.Color(WORLD_CONFIG.skyColor);
}

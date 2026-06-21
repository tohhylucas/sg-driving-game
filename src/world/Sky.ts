import * as THREE from 'three';
import { makeGroup } from '../utils/three';

export class Sky {
  readonly object: THREE.Group = makeGroup('Sky');
}

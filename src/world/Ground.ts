import * as THREE from 'three';
import { makeGroup } from '../utils/three';

export class Ground {
  readonly object: THREE.Group = makeGroup('Ground');
}

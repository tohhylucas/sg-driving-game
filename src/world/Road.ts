import * as THREE from 'three';
import { makeGroup } from '../utils/three';

export class Road {
  readonly object: THREE.Group = makeGroup('Road');
}

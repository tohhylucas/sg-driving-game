import * as THREE from 'three';
import { makeGroup } from '../utils/three';

export class TestTrack {
  readonly object: THREE.Group = makeGroup('TestTrack');
}

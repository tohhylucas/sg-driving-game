import * as THREE from 'three';
import { makeGroup } from '../utils/three';
import { Ground } from './Ground';
import { Sky } from './Sky';
import { TestTrack } from './TestTrack';

export class World {
  readonly object: THREE.Group = makeGroup('World');
  readonly sky = new Sky();

  constructor() {
    this.object.add(this.sky.object);
    this.object.add(new Ground().object);
    this.object.add(new TestTrack().object);
  }
}

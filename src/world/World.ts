import * as THREE from 'three';
import { makeGroup } from '../utils/three';
import { Ground } from './Ground';
import { Road } from './Road';
import { Sky } from './Sky';

export class World {
  readonly object: THREE.Group = makeGroup('World');
  readonly sky = new Sky();

  constructor() {
    this.object.add(this.sky.object);
    this.object.add(new Ground().object);
    this.object.add(new Road().object);
  }
}

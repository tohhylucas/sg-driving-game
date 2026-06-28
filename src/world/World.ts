import * as THREE from 'three';
import { makeGroup } from '../utils/three';
import { Ground } from './Ground';
import { MapDataTrack } from './MapDataTrack';
import type { MapData } from './mapData';
import { Sky } from './Sky';
import { TestTrack } from './TestTrack';
import {
  getFixedTestTrackLayout,
  type FixedTestTrackLayout
} from './testTrackLayout';

export class World {
  readonly object: THREE.Group = makeGroup('World');
  readonly sky = new Sky();
  readonly previewMapTrack?: MapDataTrack;

  constructor(
    layout: FixedTestTrackLayout = getFixedTestTrackLayout(),
    previewMapData?: MapData
  ) {
    this.object.add(this.sky.object);
    this.object.add(new Ground().object);

    if (previewMapData) {
      this.previewMapTrack = new MapDataTrack(previewMapData);
      this.object.add(this.previewMapTrack.object);
      return;
    }

    this.object.add(new TestTrack(layout).object);
  }
}

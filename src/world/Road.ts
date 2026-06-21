import * as THREE from 'three';
import { ROAD_CONFIG } from '../config/constants';
import { makeGroup, makeHorizontalPlaneMesh } from '../utils/three';
import { RoadMarkings } from './RoadMarkings';
import { getStraightRoadLayout } from './roadLayout';

export class Road {
  readonly object: THREE.Group = makeGroup('Road');

  constructor() {
    const layout = getStraightRoadLayout();

    this.object.add(
      makeHorizontalPlaneMesh({
        name: 'RoadSurface',
        widthM: layout.widthM,
        lengthM: layout.lengthM,
        color: ROAD_CONFIG.surfaceColor,
        yM: ROAD_CONFIG.surfaceYOffsetM
      })
    );
    this.object.add(new RoadMarkings(layout).object);
  }
}

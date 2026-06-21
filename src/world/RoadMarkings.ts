import * as THREE from 'three';
import { ROAD_CONFIG } from '../config/constants';
import { makeGroup, makeHorizontalPlaneMesh } from '../utils/three';
import type { StraightRoadLayout } from './roadLayout';

export class RoadMarkings {
  readonly object: THREE.Group = makeGroup('RoadMarkings');

  constructor(layout: StraightRoadLayout) {
    this.object.add(
      makeHorizontalPlaneMesh({
        name: 'LeftEdgeLine',
        widthM: ROAD_CONFIG.edgeLineWidthM,
        lengthM: layout.lengthM,
        color: ROAD_CONFIG.edgeLineColor,
        xM: layout.leftEdgeLineCenterXM,
        yM: ROAD_CONFIG.markingYOffsetM
      })
    );
    this.object.add(
      makeHorizontalPlaneMesh({
        name: 'RightEdgeLine',
        widthM: ROAD_CONFIG.edgeLineWidthM,
        lengthM: layout.lengthM,
        color: ROAD_CONFIG.edgeLineColor,
        xM: layout.rightEdgeLineCenterXM,
        yM: ROAD_CONFIG.markingYOffsetM
      })
    );

    for (const dashCenterZM of layout.centerDashCenterZMs) {
      this.object.add(
        makeHorizontalPlaneMesh({
          name: 'CenterLineDash',
          widthM: ROAD_CONFIG.centerLineWidthM,
          lengthM: layout.centerDashLengthM,
          color: ROAD_CONFIG.centerLineColor,
          xM: layout.centerLineXM,
          yM: ROAD_CONFIG.markingYOffsetM,
          zM: dashCenterZM
        })
      );
    }
  }
}

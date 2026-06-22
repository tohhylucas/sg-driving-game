import * as THREE from 'three';
import { ROAD_CONFIG } from '../config/constants';
import { makeGroup, makeHorizontalPlaneMesh } from '../utils/three';
import { getCenterDashCenterZMs } from './roadLayout';
import {
  getFixedTestTrackLayout,
  type TrackFinishZone,
  type TrackSegment,
  type TrackStopLine
} from './testTrackLayout';

const HALF = 0.5;

export class TestTrack {
  readonly object: THREE.Group = makeGroup('TestTrack');

  constructor() {
    const layout = getFixedTestTrackLayout();

    for (const segment of layout.segments) {
      this.object.add(createRoadSegmentGroup(segment));
    }

    for (const stopLine of layout.stopLines) {
      this.object.add(createStopLineGroup(stopLine));
    }

    this.object.add(createFinishZoneGroup(layout.finishZone));
  }
}

function createRoadSegmentGroup(segment: TrackSegment): THREE.Group {
  const group = makeOrientedGroup(`RoadSegment-${segment.id}`, segment);

  group.add(
    makeHorizontalPlaneMesh({
      name: `RoadSurface-${segment.id}`,
      widthM: segment.widthM,
      lengthM: segment.lengthM,
      color: ROAD_CONFIG.surfaceColor,
      yM: ROAD_CONFIG.surfaceYOffsetM
    })
  );
  group.add(
    makeHorizontalPlaneMesh({
      name: `LeftEdgeLine-${segment.id}`,
      widthM: ROAD_CONFIG.edgeLineWidthM,
      lengthM: segment.lengthM,
      color: ROAD_CONFIG.edgeLineColor,
      xM: -segment.widthM * HALF + ROAD_CONFIG.edgeLineWidthM * HALF,
      yM: ROAD_CONFIG.markingYOffsetM
    })
  );
  group.add(
    makeHorizontalPlaneMesh({
      name: `RightEdgeLine-${segment.id}`,
      widthM: ROAD_CONFIG.edgeLineWidthM,
      lengthM: segment.lengthM,
      color: ROAD_CONFIG.edgeLineColor,
      xM: segment.widthM * HALF - ROAD_CONFIG.edgeLineWidthM * HALF,
      yM: ROAD_CONFIG.markingYOffsetM
    })
  );

  if (segment.kind === 't-junction-side-road') {
    group.add(
      makeHorizontalPlaneMesh({
        name: `SideRoadSolidLine-${segment.id}`,
        widthM: ROAD_CONFIG.sideRoadSolidLineWidthM,
        lengthM: segment.lengthM,
        color: ROAD_CONFIG.sideRoadSolidLineColor,
        xM: ROAD_CONFIG.centerLineXM,
        yM: ROAD_CONFIG.markingYOffsetM
      })
    );
  } else {
    for (const dashCenterZM of getCenterDashCenterZMs(segment.lengthM)) {
      group.add(
        makeHorizontalPlaneMesh({
          name: `CenterLineDash-${segment.id}`,
          widthM: ROAD_CONFIG.centerLineWidthM,
          lengthM: ROAD_CONFIG.centerDashLengthM,
          color: ROAD_CONFIG.centerLineColor,
          xM: ROAD_CONFIG.centerLineXM,
          yM: ROAD_CONFIG.markingYOffsetM,
          zM: dashCenterZM
        })
      );
    }
  }

  return group;
}

function createStopLineGroup(stopLine: TrackStopLine): THREE.Group {
  const group = makeGroup(`StopLine-${stopLine.id}`);
  group.position.set(stopLine.center.xM, 0, stopLine.center.zM);
  group.rotation.y = stopLine.headingRad;
  group.add(
    makeHorizontalPlaneMesh({
      name: `StopLineMarking-${stopLine.id}`,
      widthM: stopLine.lengthM,
      lengthM: stopLine.widthM,
      color: ROAD_CONFIG.stopLineColor,
      yM: ROAD_CONFIG.markingYOffsetM
    })
  );

  return group;
}

function createFinishZoneGroup(finishZone: TrackFinishZone): THREE.Group {
  const group = makeGroup(`FinishZone-${finishZone.id}`);
  group.position.set(finishZone.center.xM, 0, finishZone.center.zM);
  group.add(
    makeHorizontalPlaneMesh({
      name: `FinishLineMarking-${finishZone.id}`,
      widthM: finishZone.widthM,
      lengthM: ROAD_CONFIG.finishLineWidthM,
      color: ROAD_CONFIG.finishLineColor,
      yM: ROAD_CONFIG.markingYOffsetM
    })
  );

  return group;
}

function makeOrientedGroup(
  name: string,
  segment: TrackSegment
): THREE.Group {
  const group = makeGroup(name);
  group.position.set(segment.center.xM, 0, segment.center.zM);
  group.rotation.y = segment.headingRad;
  return group;
}

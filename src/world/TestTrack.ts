import * as THREE from 'three';
import { ROAD_CONFIG, TEST_TRACK_CONFIG } from '../config/constants';
import { makeGroup, makeHorizontalPlaneMesh } from '../utils/three';
import { getCenterDashCenterZMs } from './roadLayout';
import {
  getFixedTestTrackLayout,
  type FixedTestTrackLayout,
  type TrackFinishZone,
  type TrackSegment,
  type TrackSideHazard,
  type TrackStopLine
} from './testTrackLayout';

const HALF = 0.5;
const BICYCLE_FRAME_HEIGHT_FACTOR = 0.28;
const BICYCLE_RIDER_HEIGHT_FACTOR = 0.34;
const BICYCLE_RIDER_WIDTH_FACTOR = 0.48;
const BICYCLE_RIDER_LENGTH_FACTOR = 0.34;
const BICYCLE_WHEEL_RADIUS_FACTOR = 0.36;
const BICYCLE_WHEEL_WIDTH_FACTOR = 0.18;
const BICYCLE_WHEEL_Z_FACTOR = 0.36;
const BICYCLE_WHEEL_SEGMENTS = 16;
const BICYCLE_WHEEL_ROTATION_Z_RAD = Math.PI / 2;

export class TestTrack {
  readonly object: THREE.Group = makeGroup('TestTrack');

  constructor(layout: FixedTestTrackLayout = getFixedTestTrackLayout()) {
    for (const segment of layout.segments) {
      this.object.add(createRoadSegmentGroup(segment));
    }

    for (const stopLine of layout.stopLines) {
      this.object.add(createStopLineGroup(stopLine));
    }

    for (const hazard of layout.sideHazards) {
      this.object.add(createSideHazardGroup(hazard));
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

function createSideHazardGroup(hazard: TrackSideHazard): THREE.Group {
  const group = makeGroup(`SideHazard-${hazard.id}`);
  group.position.set(hazard.center.xM, 0, hazard.center.zM);
  group.rotation.y = hazard.headingRad;

  if (hazard.scenarioType === 'bicycle') {
    addBicycleMeshes(group, hazard);
  }

  return group;
}

function addBicycleMeshes(
  group: THREE.Group,
  hazard: TrackSideHazard
): void {
  const frameHeightM = hazard.visualHeightM * BICYCLE_FRAME_HEIGHT_FACTOR;
  const riderHeightM = hazard.visualHeightM * BICYCLE_RIDER_HEIGHT_FACTOR;
  const wheelRadiusM = hazard.collisionBox.widthM * BICYCLE_WHEEL_RADIUS_FACTOR;
  const wheelWidthM = hazard.collisionBox.widthM * BICYCLE_WHEEL_WIDTH_FACTOR;
  const frameMaterial = new THREE.MeshBasicMaterial({
    color: TEST_TRACK_CONFIG.sideHazard.frameColor
  });
  const wheelMaterial = new THREE.MeshBasicMaterial({
    color: TEST_TRACK_CONFIG.sideHazard.wheelColor
  });
  const riderMaterial = new THREE.MeshBasicMaterial({
    color: TEST_TRACK_CONFIG.sideHazard.riderColor
  });
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(
      hazard.collisionBox.widthM,
      frameHeightM,
      hazard.collisionBox.lengthM
    ),
    frameMaterial
  );
  const rider = new THREE.Mesh(
    new THREE.BoxGeometry(
      hazard.collisionBox.widthM * BICYCLE_RIDER_WIDTH_FACTOR,
      riderHeightM,
      hazard.collisionBox.lengthM * BICYCLE_RIDER_LENGTH_FACTOR
    ),
    riderMaterial
  );

  frame.name = `SideHazardBicycleFrame-${hazard.id}`;
  frame.position.y = wheelRadiusM + frameHeightM * HALF;
  rider.name = `SideHazardBicycleRider-${hazard.id}`;
  rider.position.y = wheelRadiusM + frameHeightM + riderHeightM * HALF;
  group.add(frame, rider);

  for (const zFactor of [-BICYCLE_WHEEL_Z_FACTOR, BICYCLE_WHEEL_Z_FACTOR]) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(
        wheelRadiusM,
        wheelRadiusM,
        wheelWidthM,
        BICYCLE_WHEEL_SEGMENTS
      ),
      wheelMaterial
    );

    wheel.name = `SideHazardBicycleWheel-${hazard.id}`;
    wheel.rotation.z = BICYCLE_WHEEL_ROTATION_Z_RAD;
    wheel.position.set(
      0,
      wheelRadiusM,
      hazard.collisionBox.lengthM * zFactor
    );
    group.add(wheel);
  }
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

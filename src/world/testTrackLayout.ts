import { ROAD_CONFIG, TEST_TRACK_CONFIG } from '../config/constants';

type DrivingLaneSide = typeof ROAD_CONFIG.defaultDrivingLaneSide;

export interface TrackPoint {
  readonly xM: number;
  readonly zM: number;
}

export type TrackSegmentKind =
  | 'loop'
  | 't-junction-side-road'
  | 'cross-junction-road';

export type TrackJunctionKind = 't-junction' | 'cross-junction';

export interface TrackSegment {
  readonly id: string;
  readonly kind: TrackSegmentKind;
  readonly start: TrackPoint;
  readonly end: TrackPoint;
  readonly center: TrackPoint;
  readonly lengthM: number;
  readonly widthM: number;
  readonly headingRad: number;
}

export interface TrackDrivingLaneLayout {
  readonly side: DrivingLaneSide;
  readonly centerOffsetM: number;
}

export interface TrackJunction {
  readonly id: string;
  readonly kind: TrackJunctionKind;
  readonly control: 'uncontrolled';
  readonly center: TrackPoint;
  readonly connectedSegmentIds: readonly string[];
}

export interface TrackStopLine {
  readonly id: string;
  readonly kind: 'stop-line';
  readonly junctionId: string;
  readonly segmentId: string;
  readonly center: TrackPoint;
  readonly headingRad: number;
  readonly lengthM: number;
  readonly widthM: number;
}

export type TrackStopLineCrossingDirection = -1 | 1;

export interface TrackStopLineRuleZone {
  readonly id: string;
  readonly kind: 'stop-line-rule-zone';
  readonly stopLineId: string;
  readonly junctionId: string;
  readonly segmentId: string;
  readonly stopLineLocalZM: number;
  readonly crossingDirection: TrackStopLineCrossingDirection;
  readonly approachDepthM: number;
  readonly widthM: number;
}

export interface TrackFinishZone {
  readonly id: string;
  readonly kind: 'finish-zone';
  readonly center: TrackPoint;
  readonly widthM: number;
  readonly depthM: number;
}

export interface TrackSideHazardFootprint {
  readonly centerLocalXM: number;
  readonly centerLocalZM: number;
  readonly lengthM: number;
  readonly widthM: number;
}

export interface TrackSideHazardTriggerZone {
  readonly centerLocalXM: number;
  readonly centerLocalZM: number;
  readonly lengthM: number;
  readonly widthM: number;
}

export interface TrackSideHazard {
  readonly id: string;
  readonly kind: 'side-hazard';
  readonly scenarioType: 'bicycle' | 'vehicle';
  readonly segmentId: string;
  readonly center: TrackPoint;
  readonly headingRad: number;
  readonly visible: boolean;
  readonly visualHeightM: number;
  readonly clearanceDirection: -1 | 1;
  readonly clearanceLocalZM: number;
  readonly collisionBox: TrackSideHazardFootprint;
  readonly triggerZone: TrackSideHazardTriggerZone;
}

export interface FixedTestTrackLayout {
  readonly roadWidthM: number;
  readonly loopSegments: readonly TrackSegment[];
  readonly segments: readonly TrackSegment[];
  readonly junctions: readonly TrackJunction[];
  readonly stopLines: readonly TrackStopLine[];
  readonly stopLineRuleZones: readonly TrackStopLineRuleZone[];
  readonly sideHazards: readonly TrackSideHazard[];
  readonly finishZone: TrackFinishZone;
  readonly defaultDrivingLane: TrackDrivingLaneLayout;
}

function makeTrackSegment(
  id: string,
  kind: TrackSegmentKind,
  start: TrackPoint,
  end: TrackPoint
): TrackSegment {
  const deltaXM = end.xM - start.xM;
  const deltaZM = end.zM - start.zM;

  return {
    id,
    kind,
    start,
    end,
    center: {
      xM: (start.xM + end.xM) / 2,
      zM: (start.zM + end.zM) / 2
    },
    lengthM: Math.hypot(deltaXM, deltaZM),
    widthM: ROAD_CONFIG.roadWidthM,
    headingRad: Math.atan2(-deltaXM, -deltaZM)
  };
}

function makeLoopSegments(): TrackSegment[] {
  const points = TEST_TRACK_CONFIG.loopCenterlinePoints;
  const segments: TrackSegment[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    segments.push(
      makeTrackSegment(
        `loop-${index + 1}`,
        'loop',
        points[index],
        points[index + 1]
      )
    );
  }

  return segments;
}

function makeFeatureSegments(): TrackSegment[] {
  return [
    makeTrackSegment(
      't-junction-side-road',
      't-junction-side-road',
      TEST_TRACK_CONFIG.tJunctionSideRoad.start,
      TEST_TRACK_CONFIG.tJunctionSideRoad.end
    ),
    makeTrackSegment(
      'cross-junction-road',
      'cross-junction-road',
      TEST_TRACK_CONFIG.crossJunctionRoad.start,
      TEST_TRACK_CONFIG.crossJunctionRoad.end
    )
  ];
}

function makeJunctions(): TrackJunction[] {
  return [
    {
      id: 't-junction',
      kind: 't-junction',
      control: 'uncontrolled',
      center: TEST_TRACK_CONFIG.tJunctionSideRoad.junctionCenter,
      connectedSegmentIds: ['loop-1', 't-junction-side-road']
    },
    {
      id: 'cross-junction',
      kind: 'cross-junction',
      control: 'uncontrolled',
      center: TEST_TRACK_CONFIG.crossJunctionRoad.junctionCenter,
      connectedSegmentIds: ['loop-1', 'cross-junction-road']
    }
  ];
}

function getSegmentLocalZM(segment: TrackSegment, point: TrackPoint): number {
  const deltaXM = point.xM - segment.center.xM;
  const deltaZM = point.zM - segment.center.zM;

  return deltaXM * Math.sin(segment.headingRad) + deltaZM * Math.cos(segment.headingRad);
}

function getSegmentPointAtLocalZM(
  segment: TrackSegment,
  localZM: number
): TrackPoint {
  return getSegmentPointAtLocalPosition(segment, 0, localZM);
}

function getSegmentPointAtLocalPosition(
  segment: TrackSegment,
  localXM: number,
  localZM: number
): TrackPoint {
  return {
    xM:
      segment.center.xM +
      localXM * Math.cos(segment.headingRad) +
      localZM * Math.sin(segment.headingRad),
    zM:
      segment.center.zM -
      localXM * Math.sin(segment.headingRad) +
      localZM * Math.cos(segment.headingRad)
  };
}

function makeStopLine(
  id: string,
  junctionId: string,
  segment: TrackSegment,
  localZM: number
): TrackStopLine {
  return {
    id,
    kind: 'stop-line',
    junctionId,
    segmentId: segment.id,
    center: getSegmentPointAtLocalZM(segment, localZM),
    headingRad: segment.headingRad,
    lengthM: ROAD_CONFIG.roadWidthM,
    widthM: ROAD_CONFIG.stopLineWidthM
  };
}

function findSegment(
  segments: readonly TrackSegment[],
  segmentId: string
): TrackSegment {
  const segment = segments.find((candidate) => candidate.id === segmentId);

  if (!segment) {
    throw new Error(`Missing fixed test track segment: ${segmentId}`);
  }

  return segment;
}

function makeStopLines(segments: readonly TrackSegment[]): TrackStopLine[] {
  const tJunctionSideRoad = findSegment(segments, 't-junction-side-road');
  const tJunctionLocalZM = getSegmentLocalZM(
    tJunctionSideRoad,
    TEST_TRACK_CONFIG.tJunctionSideRoad.junctionCenter
  );
  const setbackM = TEST_TRACK_CONFIG.stopLineSetbackM;

  return [
    makeStopLine(
      't-junction-side-road-stop-line',
      't-junction',
      tJunctionSideRoad,
      tJunctionLocalZM + setbackM
    )
  ];
}

function makeStopLineRuleZones(
  segments: readonly TrackSegment[],
  stopLines: readonly TrackStopLine[]
): TrackStopLineRuleZone[] {
  const sideRoadSegment = findSegment(segments, 't-junction-side-road');
  const sideRoadStopLine = stopLines.find(
    (stopLine) => stopLine.id === 't-junction-side-road-stop-line'
  );

  if (!sideRoadStopLine) {
    throw new Error('Missing T-junction side-road stop line.');
  }

  const stopLineLocalZM = getSegmentLocalZM(
    sideRoadSegment,
    sideRoadStopLine.center
  );
  const startLocalZM = getSegmentLocalZM(
    sideRoadSegment,
    sideRoadSegment.start
  );
  const crossingDirection: TrackStopLineCrossingDirection =
    startLocalZM > stopLineLocalZM ? -1 : 1;

  return [
    {
      id: 't-junction-side-road-stop-line-rule-zone',
      kind: 'stop-line-rule-zone',
      stopLineId: sideRoadStopLine.id,
      junctionId: sideRoadStopLine.junctionId,
      segmentId: sideRoadSegment.id,
      stopLineLocalZM,
      crossingDirection,
      approachDepthM: TEST_TRACK_CONFIG.stopLineRuleApproachDepthM,
      widthM: sideRoadSegment.widthM
    }
  ];
}

function makeFinishZone(): TrackFinishZone {
  return {
    id: 'loop-finish-gate',
    kind: 'finish-zone',
    center: TEST_TRACK_CONFIG.finishZone.center,
    widthM: ROAD_CONFIG.roadWidthM,
    depthM: TEST_TRACK_CONFIG.finishZone.depthM
  };
}

function makeSideHazards(
  segments: readonly TrackSegment[]
): TrackSideHazard[] {
  const segment = findSegment(segments, 'loop-1');
  const config = TEST_TRACK_CONFIG.sideHazard;

  return [
    {
      id: 'loop-1-right-blind-spot-bicycle',
      kind: 'side-hazard',
      scenarioType: 'bicycle',
      segmentId: segment.id,
      center: getSegmentPointAtLocalPosition(
        segment,
        config.centerLocalXM,
        config.centerLocalZM
      ),
      headingRad: segment.headingRad,
      visible: true,
      visualHeightM: config.visualHeightM,
      clearanceDirection: -1,
      clearanceLocalZM: config.centerLocalZM - config.triggerLengthM / 2,
      collisionBox: {
        centerLocalXM: config.centerLocalXM,
        centerLocalZM: config.centerLocalZM,
        lengthM: config.collisionLengthM,
        widthM: config.collisionWidthM
      },
      triggerZone: {
        centerLocalXM: 0,
        centerLocalZM: config.centerLocalZM,
        lengthM: config.triggerLengthM,
        widthM: ROAD_CONFIG.roadWidthM
      }
    }
  ];
}

export function getFixedTestTrackLayout(): FixedTestTrackLayout {
  const loopSegments = makeLoopSegments();
  const featureSegments = makeFeatureSegments();
  const segments = [...loopSegments, ...featureSegments];
  const stopLines = makeStopLines(segments);

  return {
    roadWidthM: ROAD_CONFIG.roadWidthM,
    loopSegments,
    segments,
    junctions: makeJunctions(),
    stopLines,
    stopLineRuleZones: makeStopLineRuleZones(segments, stopLines),
    sideHazards: makeSideHazards(segments),
    finishZone: makeFinishZone(),
    defaultDrivingLane: {
      side: ROAD_CONFIG.defaultDrivingLaneSide,
      centerOffsetM: -ROAD_CONFIG.laneWidthM / 2
    }
  };
}

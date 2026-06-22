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

export interface FixedTestTrackLayout {
  readonly roadWidthM: number;
  readonly loopSegments: readonly TrackSegment[];
  readonly segments: readonly TrackSegment[];
  readonly junctions: readonly TrackJunction[];
  readonly stopLines: readonly TrackStopLine[];
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
  return {
    xM: segment.center.xM + localZM * Math.sin(segment.headingRad),
    zM: segment.center.zM + localZM * Math.cos(segment.headingRad)
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
  const loopMain = findSegment(segments, 'loop-1');
  const tJunctionSideRoad = findSegment(segments, 't-junction-side-road');
  const crossJunctionRoad = findSegment(segments, 'cross-junction-road');
  const tJunctionLocalZM = getSegmentLocalZM(
    tJunctionSideRoad,
    TEST_TRACK_CONFIG.tJunctionSideRoad.junctionCenter
  );
  const crossLocalZMOnLoop = getSegmentLocalZM(
    loopMain,
    TEST_TRACK_CONFIG.crossJunctionRoad.junctionCenter
  );
  const crossLocalZMOnCrossRoad = getSegmentLocalZM(
    crossJunctionRoad,
    TEST_TRACK_CONFIG.crossJunctionRoad.junctionCenter
  );
  const setbackM = TEST_TRACK_CONFIG.stopLineSetbackM;

  return [
    makeStopLine(
      't-junction-side-road-stop-line',
      't-junction',
      tJunctionSideRoad,
      tJunctionLocalZM + setbackM
    ),
    makeStopLine(
      'cross-junction-loop-south-stop-line',
      'cross-junction',
      loopMain,
      crossLocalZMOnLoop + setbackM
    ),
    makeStopLine(
      'cross-junction-loop-north-stop-line',
      'cross-junction',
      loopMain,
      crossLocalZMOnLoop - setbackM
    ),
    makeStopLine(
      'cross-junction-west-stop-line',
      'cross-junction',
      crossJunctionRoad,
      crossLocalZMOnCrossRoad + setbackM
    ),
    makeStopLine(
      'cross-junction-east-stop-line',
      'cross-junction',
      crossJunctionRoad,
      crossLocalZMOnCrossRoad - setbackM
    )
  ];
}

export function getFixedTestTrackLayout(): FixedTestTrackLayout {
  const loopSegments = makeLoopSegments();
  const featureSegments = makeFeatureSegments();
  const segments = [...loopSegments, ...featureSegments];

  return {
    roadWidthM: ROAD_CONFIG.roadWidthM,
    loopSegments,
    segments,
    junctions: makeJunctions(),
    stopLines: makeStopLines(segments),
    defaultDrivingLane: {
      side: ROAD_CONFIG.defaultDrivingLaneSide,
      centerOffsetM: -ROAD_CONFIG.laneWidthM / 2
    }
  };
}

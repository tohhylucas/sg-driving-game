import { ROAD_CONFIG } from '../config/constants';
import { clamp } from '../utils/math';
import type {
  FixedTestTrackLayout,
  TrackPoint,
  TrackSegment
} from '../world/testTrackLayout';

export type LaneSide = 'left' | 'right';

export interface LanePosition {
  readonly localXM: number;
  readonly side: LaneSide;
}

export interface TrackLanePosition extends LanePosition {
  readonly segmentId: string;
  readonly localZM: number;
}

/** Returns a point's lateral lane position relative to a track segment. */
export function getLanePositionOnSegment(
  segment: TrackSegment,
  point: TrackPoint
): LanePosition {
  const deltaXM = point.xM - segment.center.xM;
  const deltaZM = point.zM - segment.center.zM;
  const localXM =
    deltaXM * Math.cos(segment.headingRad) -
    deltaZM * Math.sin(segment.headingRad);

  return {
    localXM,
    side: localXM < ROAD_CONFIG.centerLineXM ? 'left' : 'right'
  };
}

export function getNearestLanePosition(
  layout: FixedTestTrackLayout,
  point: TrackPoint
): TrackLanePosition {
  let nearest: TrackLanePosition | undefined;
  let nearestDistanceM = Number.POSITIVE_INFINITY;

  for (const segment of layout.segments) {
    const deltaXM = point.xM - segment.center.xM;
    const deltaZM = point.zM - segment.center.zM;
    const localXM =
      deltaXM * Math.cos(segment.headingRad) -
      deltaZM * Math.sin(segment.headingRad);
    const localZM =
      deltaXM * Math.sin(segment.headingRad) +
      deltaZM * Math.cos(segment.headingRad);
    const clampedLocalZM = clamp(
      localZM,
      -segment.lengthM / 2,
      segment.lengthM / 2
    );
    const distanceM = Math.hypot(localXM, localZM - clampedLocalZM);

    if (distanceM < nearestDistanceM) {
      nearestDistanceM = distanceM;
      nearest = {
        localXM,
        localZM,
        segmentId: segment.id,
        side: localXM < ROAD_CONFIG.centerLineXM ? 'left' : 'right'
      };
    }
  }

  if (!nearest) {
    throw new Error('Cannot evaluate lane position without track segments.');
  }

  return nearest;
}

/** Checks whether a lane position is inside the configured default lane. */
export function isWithinDefaultDrivingLane(
  lanePosition: LanePosition,
  layout: Pick<FixedTestTrackLayout, 'defaultDrivingLane'>
): boolean {
  const laneHalfWidthM = ROAD_CONFIG.laneWidthM / 2;
  const minXM = layout.defaultDrivingLane.centerOffsetM - laneHalfWidthM;
  const maxXM = layout.defaultDrivingLane.centerOffsetM + laneHalfWidthM;

  return lanePosition.localXM >= minXM && lanePosition.localXM <= maxXM;
}

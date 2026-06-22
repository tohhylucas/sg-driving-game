import { ROAD_CONFIG } from '../config/constants';
import type { MovingElementState } from '../types';
import {
  getSegmentPointAtLocalPosition,
  type FixedTestTrackLayout,
  type TrackMovingElement,
  type TrackSegment
} from './testTrackLayout';

/** Returns live deterministic state for all configured tracked moving elements. */
export function getScriptedMovingElementStates(
  layout: FixedTestTrackLayout,
  elapsedSec: number
): MovingElementState[] {
  return layout.movingElements.map((element) =>
    getScriptedMovingElementState(layout, element, elapsedSec)
  );
}

export function getScriptedMovingElementState(
  layout: FixedTestTrackLayout,
  element: TrackMovingElement,
  elapsedSec: number
): MovingElementState {
  const segment = findSegment(layout, element.segmentId);
  const localZM = getLoopedLocalZM(element, elapsedSec);
  const point = getSegmentPointAtLocalPosition(
    segment,
    element.centerLocalXM,
    localZM
  );

  return {
    id: element.id,
    kind: element.kind,
    segmentId: element.segmentId,
    position: {
      x: point.xM,
      y: ROAD_CONFIG.surfaceYOffsetM,
      z: point.zM
    },
    headingRad: segment.headingRad,
    speedMps: element.speedMps,
    lengthM: element.lengthM,
    widthM: element.widthM
  };
}

function getLoopedLocalZM(
  element: TrackMovingElement,
  elapsedSec: number
): number {
  const pathLengthM = element.pathStartLocalZM - element.pathEndLocalZM;

  if (pathLengthM <= 0) {
    throw new Error(`Invalid moving-element path for ${element.id}.`);
  }

  const initialOffsetM = element.pathStartLocalZM - element.initialLocalZM;
  const travelledM = positiveModulo(
    initialOffsetM + elapsedSec * element.speedMps,
    pathLengthM
  );

  return element.pathStartLocalZM - travelledM;
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function findSegment(
  layout: FixedTestTrackLayout,
  segmentId: string
): TrackSegment {
  const segment = layout.segments.find((candidate) => candidate.id === segmentId);

  if (!segment) {
    throw new Error(`Missing moving-element segment: ${segmentId}`);
  }

  return segment;
}

import type { TrackFinishZone, TrackPoint } from '../world/testTrackLayout';

/** Returns true when a point is inside the fixed finish gate. */
export function isInsideFinishZone(
  point: TrackPoint,
  finishZone: TrackFinishZone
): boolean {
  return (
    Math.abs(point.xM - finishZone.center.xM) <= finishZone.widthM / 2 &&
    Math.abs(point.zM - finishZone.center.zM) < finishZone.depthM / 2
  );
}

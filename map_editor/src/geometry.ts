export interface ImagePoint {
  readonly px: number;
  readonly py: number;
}

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface ViewTransform {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly rotationRad: number;
  readonly rotationCenterPx: number;
  readonly rotationCenterPy: number;
}

export interface WorldTransform {
  readonly originPx: number;
  readonly originPy: number;
  readonly metersPerPixel: number;
}

export interface WorldPoint {
  readonly xM: number;
  readonly yM: number;
  readonly zM: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function pixelDistance(a: ImagePoint, b: ImagePoint): number {
  return Math.hypot(b.px - a.px, b.py - a.py);
}

export function calculateMetersPerPixel(
  a: ImagePoint,
  b: ImagePoint,
  realMeters: number
): number {
  if (realMeters <= 0) {
    throw new Error('Calibration distance must be greater than zero.');
  }

  const distancePx = pixelDistance(a, b);

  if (distancePx <= 0) {
    throw new Error('Calibration points must be different.');
  }

  return realMeters / distancePx;
}

export function imageToWorld(
  point: ImagePoint,
  transform: WorldTransform
): WorldPoint {
  return {
    xM: (point.px - transform.originPx) * transform.metersPerPixel,
    yM: 0,
    zM: (transform.originPy - point.py) * transform.metersPerPixel
  };
}

export function screenToImage(
  view: ViewTransform,
  point: ScreenPoint
): ImagePoint {
  const unscaledX = (point.x - view.offsetX) / view.scale;
  const unscaledY = (point.y - view.offsetY) / view.scale;
  const dx = unscaledX - view.rotationCenterPx;
  const dy = unscaledY - view.rotationCenterPy;
  const cos = Math.cos(view.rotationRad);
  const sin = Math.sin(view.rotationRad);

  return {
    px: view.rotationCenterPx + dx * cos + dy * sin,
    py: view.rotationCenterPy - dx * sin + dy * cos
  };
}

export function imageToScreen(
  view: ViewTransform,
  point: ImagePoint
): ScreenPoint {
  const dx = point.px - view.rotationCenterPx;
  const dy = point.py - view.rotationCenterPy;
  const cos = Math.cos(view.rotationRad);
  const sin = Math.sin(view.rotationRad);

  return {
    x:
      view.offsetX +
      (view.rotationCenterPx + dx * cos - dy * sin) * view.scale,
    y:
      view.offsetY +
      (view.rotationCenterPy + dx * sin + dy * cos) * view.scale
  };
}

export function distanceToSegment(
  point: ImagePoint,
  start: ImagePoint,
  end: ImagePoint
): number {
  const dx = end.px - start.px;
  const dy = end.py - start.py;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return pixelDistance(point, start);
  }

  const t = clamp(
    ((point.px - start.px) * dx + (point.py - start.py) * dy) / lengthSq,
    0,
    1
  );
  const projection = {
    px: start.px + t * dx,
    py: start.py + t * dy
  };

  return pixelDistance(point, projection);
}

export function quadraticBezierPoint(
  start: ImagePoint,
  control: ImagePoint,
  end: ImagePoint,
  t: number
): ImagePoint {
  const clampedT = clamp(t, 0, 1);
  const inverseT = 1 - clampedT;

  return {
    px:
      inverseT * inverseT * start.px +
      2 * inverseT * clampedT * control.px +
      clampedT * clampedT * end.px,
    py:
      inverseT * inverseT * start.py +
      2 * inverseT * clampedT * control.py +
      clampedT * clampedT * end.py
  };
}

export function distanceToQuadraticBezier(
  point: ImagePoint,
  start: ImagePoint,
  control: ImagePoint,
  end: ImagePoint
): number {
  const samples = 24;
  let bestDistance = Number.POSITIVE_INFINITY;
  let previous = start;

  for (let index = 1; index <= samples; index += 1) {
    const current = quadraticBezierPoint(start, control, end, index / samples);
    bestDistance = Math.min(
      bestDistance,
      distanceToSegment(point, previous, current)
    );
    previous = current;
  }

  return bestDistance;
}

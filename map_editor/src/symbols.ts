import type { ImagePoint } from './geometry';
import type { DecalType } from './schema';
import type { PxPaintedLine } from './state';
import {
  SYMBOL_MAX_SCALE_M,
  SYMBOL_MIN_SCALE_M
} from './constants';

export interface GiveWayLineOptions {
  readonly id: string;
  readonly center: ImagePoint;
  readonly rotationDeg: number;
  readonly lengthM: number;
  readonly widthM: number;
  readonly metersPerPixel: number;
}

export interface PlacementRotationOptions {
  readonly center: ImagePoint;
  readonly pointer: ImagePoint;
}

export interface PlacementScaleOptions {
  readonly center: ImagePoint;
  readonly pointer: ImagePoint;
  readonly metersPerPixel: number;
  readonly fallbackScaleM: number;
}

export function isLineMarkingSymbol(type: DecalType): boolean {
  return type === 'give_way_line';
}

function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function getPlacementRotationDeg(
  options: PlacementRotationOptions
): number {
  const dx = options.pointer.px - options.center.px;
  const dy = options.pointer.py - options.center.py;

  if (Math.hypot(dx, dy) < 0.001) {
    return 0;
  }

  return Math.round(normalizeDegrees((Math.atan2(dx, -dy) * 180) / Math.PI));
}

function clampSymbolScaleM(scaleM: number): number {
  return Math.min(Math.max(scaleM, SYMBOL_MIN_SCALE_M), SYMBOL_MAX_SCALE_M);
}

export function getPlacementScaleM(options: PlacementScaleOptions): number {
  const dx = options.pointer.px - options.center.px;
  const dy = options.pointer.py - options.center.py;
  const distancePx = Math.hypot(dx, dy);

  if (distancePx < 0.001) {
    return clampSymbolScaleM(options.fallbackScaleM);
  }

  return clampSymbolScaleM(distancePx * options.metersPerPixel);
}

export function createGiveWayLineMarking(
  options: GiveWayLineOptions
): PxPaintedLine {
  const rotationRad = (options.rotationDeg * Math.PI) / 180;
  const halfLengthPx = options.lengthM / options.metersPerPixel / 2;
  const deltaX = Math.cos(rotationRad) * halfLengthPx;
  const deltaY = Math.sin(rotationRad) * halfLengthPx;

  return {
    id: options.id,
    style: 'give_way_line',
    widthM: options.widthM,
    points: [
      {
        px: options.center.px - deltaX,
        py: options.center.py - deltaY
      },
      {
        px: options.center.px + deltaX,
        py: options.center.py + deltaY
      }
    ]
  };
}

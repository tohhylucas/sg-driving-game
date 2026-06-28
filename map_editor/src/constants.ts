export const DEFAULT_MAP_NAME = 'Singapore Practice Map';
export const DEFAULT_METERS_PER_PIXEL = 0.05;
export const DEFAULT_LANE_WIDTH_M = 3.5;
export const DEFAULT_ROAD_LANES = 2;
export const DEFAULT_DECAL_SCALE_M = 5;
export const DEFAULT_GIVE_WAY_LINE_LENGTH_M = 6;
export const DEFAULT_ROAD_MARKING_WIDTH_M = 0.15;
export const DEFAULT_KERB_WIDTH_M = 0.35;
export const DEFAULT_KERB_HEIGHT_M = 0.18;
export const SYMBOL_MIN_SCALE_M = 0.5;
export const SYMBOL_MAX_SCALE_M = 20;

export const VIEW_CONFIG = {
  minScale: 0.1,
  maxScale: 16,
  zoomStep: 1.12,
  selectionRadiusPx: 10,
  fitPaddingPx: 40
} as const;

export const AUTOTRACE_CONFIG = {
  maxSegments: 650
} as const;

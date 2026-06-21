export const WORLD_CONFIG = {
  skyColor: 0x60a5fa,
  groundColor: 0x22c55e,
  groundSizeM: 220,
  groundYOffsetM: 0
} as const;

export const LOOP_CONFIG = {
  fixedTimeStepSec: 1 / 60,
  maxFrameDeltaSec: 0.25
} as const;

export const RENDER_CONFIG = {
  clearColor: WORLD_CONFIG.skyColor,
  cameraFovDeg: 60,
  cameraNear: 0.1,
  cameraFar: 1000,
  maxDevicePixelRatio: 2
} as const;

const ROAD_LANE_WIDTH_M = 3.5;
const ROAD_LANE_COUNT = 2;
const ROAD_WIDTH_M = ROAD_LANE_WIDTH_M * ROAD_LANE_COUNT;
const ROAD_CENTER_LINE_X_M = 0;

export const ROAD_CONFIG = {
  laneWidthM: ROAD_LANE_WIDTH_M,
  roadLengthM: 120,
  roadWidthM: ROAD_WIDTH_M,
  centerLineXM: ROAD_CENTER_LINE_X_M,
  leftLaneCenterXM: ROAD_CENTER_LINE_X_M - ROAD_LANE_WIDTH_M / 2,
  rightLaneCenterXM: ROAD_CENTER_LINE_X_M + ROAD_LANE_WIDTH_M / 2,
  forwardDirectionZ: -1,
  defaultDrivingLaneSide: 'left',
  surfaceColor: 0x555861,
  surfaceYOffsetM: 0.01,
  edgeLineWidthM: 0.15,
  edgeLineColor: 0xffffff,
  centerLineWidthM: 0.12,
  centerLineColor: 0xffffff,
  centerDashLengthM: 4,
  centerDashGapM: 5,
  markingYOffsetM: 0.02
} as const;

export const FIXED_CAMERA_CONFIG = {
  positionXM: ROAD_CONFIG.leftLaneCenterXM,
  positionYM: 4.2,
  positionZM: 18,
  lookAtXM: ROAD_CONFIG.leftLaneCenterXM,
  lookAtYM: 0,
  lookAtZM: -42
} as const;

export const VEHICLE_CONFIG = {
  maxForwardSpeedMps: 18,
  maxReverseSpeedMps: 5,
  wheelBaseM: 2.6,
  maxSteerRad: 0.55
} as const;

export const LOOP_CONFIG = {
  fixedTimeStepSec: 1 / 60,
  maxFrameDeltaSec: 0.25
} as const;

export const RENDER_CONFIG = {
  clearColor: 0x0f172a,
  cameraFovDeg: 60,
  cameraNear: 0.1,
  cameraFar: 1000,
  maxDevicePixelRatio: 2
} as const;

export const ROAD_CONFIG = {
  laneWidthM: 3.5,
  roadLengthM: 120,
  roadWidthM: 7,
  leftLaneCenterXM: -1.75
} as const;

export const VEHICLE_CONFIG = {
  maxForwardSpeedMps: 18,
  maxReverseSpeedMps: 5,
  wheelBaseM: 2.6,
  maxSteerRad: 0.55
} as const;

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
  markingYOffsetM: 0.02,
  stopLineWidthM: 0.35,
  stopLineColor: 0xffffff
} as const;

export const TEST_TRACK_CONFIG = {
  loopCenterlinePoints: [
    { xM: 0, zM: 28 },
    { xM: 0, zM: -28 },
    { xM: -14, zM: -40 },
    { xM: -32, zM: -28 },
    { xM: -32, zM: 28 },
    { xM: -14, zM: 40 },
    { xM: 0, zM: 28 }
  ],
  tJunctionSideRoad: {
    start: { xM: 24, zM: 14 },
    end: { xM: 0, zM: 14 },
    junctionCenter: { xM: 0, zM: 14 }
  },
  crossJunctionRoad: {
    start: { xM: -20, zM: -14 },
    end: { xM: 20, zM: -14 },
    junctionCenter: { xM: 0, zM: -14 }
  },
  stopLineSetbackM: 4
} as const;

export const FIXED_CAMERA_CONFIG = {
  positionXM: ROAD_CONFIG.leftLaneCenterXM,
  positionYM: 4.2,
  positionZM: 18,
  lookAtXM: ROAD_CONFIG.leftLaneCenterXM,
  lookAtYM: 0,
  lookAtZM: -42
} as const;

export const CHASE_CAMERA_CONFIG = {
  distanceM: 9,
  heightM: 4,
  lateralOffsetM: 0,
  lookAheadM: 8,
  lookAtHeightM: 1.2,
  viewLateralOffsetM: 0
} as const;

export const COCKPIT_CAMERA_CONFIG = {
  lateralOffsetM: 0.45,
  viewLateralOffsetM: 0.6,
  blindSpotMaxShiftM: 0.7,
  blindSpotSmoothingRatePerSec: 8
} as const;

export const COCKPIT_UI_CONFIG = {
  steeringWheel: {
    maxRotationDeg: 150,
    rightPercent: 8,
    bottomPercent: 4,
    sizeViewportWidth: 17,
    minSizePx: 120,
    maxSizePx: 220
  },
  speedometer: {
    leftPercent: 50,
    bottomPercent: 6
  },
  instructorAudio: {
    leftPercent: 4,
    bottomPercent: 5,
    sizePx: 42
  }
} as const;

export const MIRROR_CONFIG = {
  rearview: {
    ui: {
      leftPercent: 34,
      topPercent: 2.5,
      widthPercent: 32,
      heightPercent: 12
    },
    camera: {
      fovDeg: 55,
      renderTargetWidthPx: 640,
      renderTargetHeightPx: 240,
      mountRightOffsetM: 0.35,
      mountUpOffsetM: 2.1,
      mountForwardOffsetM: 0.1,
      targetRightOffsetM: 0,
      targetUpOffsetM: 1.2,
      targetForwardOffsetM: -18
    }
  },
  leftSide: {
    ui: {
      leftPercent: 3,
      topPercent: 28,
      widthPercent: 23,
      heightPercent: 13
    },
    camera: {
      fovDeg: 70,
      renderTargetWidthPx: 512,
      renderTargetHeightPx: 256,
      mountRightOffsetM: -1.05,
      mountUpOffsetM: 1.35,
      mountForwardOffsetM: 0.55,
      targetRightOffsetM: -5,
      targetUpOffsetM: 1.05,
      targetForwardOffsetM: -14
    }
  },
  rightSide: {
    ui: {
      leftPercent: 74,
      topPercent: 28,
      widthPercent: 23,
      heightPercent: 13
    },
    camera: {
      fovDeg: 70,
      renderTargetWidthPx: 512,
      renderTargetHeightPx: 256,
      mountRightOffsetM: 1.05,
      mountUpOffsetM: 1.35,
      mountForwardOffsetM: 0.55,
      targetRightOffsetM: 5,
      targetUpOffsetM: 1.05,
      targetForwardOffsetM: -14
    }
  }
} as const;

export const VEHICLE_CONFIG = {
  maxForwardSpeedMps: 18,
  maxReverseSpeedMps: 5,
  accelerationMps2: 4.5,
  coastDecelerationMps2: 1.5,
  brakeDecelerationMps2: 8,
  reverseAccelerationMps2: 3,
  wheelBaseM: 2.6,
  maxSteerRad: 0.55,
  steerSmoothingRatePerSec: 8
} as const;

export const CAR_CONFIG = {
  lengthM: 4.2,
  widthM: 1.7,
  bodyHeightM: 0.9,
  roofLengthM: 1.8,
  roofWidthM: 1.2,
  roofHeightM: 0.55,
  wheelRadiusM: 0.34,
  wheelWidthM: 0.28,
  frontMarkerLengthM: 0.16,
  frontMarkerHeightM: 0.18,
  spawnHeightM: ROAD_CONFIG.surfaceYOffsetM,
  spawnZM: 0,
  forwardHeadingRad: 0,
  initialSpeedMps: 0,
  bodyColor: 0x2563eb,
  roofColor: 0xdbeafe,
  windshieldColor: 0x93c5fd,
  wheelColor: 0x111827,
  frontMarkerColor: 0xf8fafc
} as const;

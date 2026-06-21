import { ROAD_CONFIG } from '../config/constants';

type DrivingLaneSide = typeof ROAD_CONFIG.defaultDrivingLaneSide;

export interface DrivingLaneLayout {
  readonly side: DrivingLaneSide;
  readonly centerXM: number;
}

export interface StraightRoadLayout {
  readonly lengthM: number;
  readonly widthM: number;
  readonly centerLineXM: number;
  readonly forwardDirectionZ: number;
  readonly leftEdgeLineCenterXM: number;
  readonly rightEdgeLineCenterXM: number;
  readonly centerDashLengthM: number;
  readonly centerDashGapM: number;
  readonly centerDashCenterZMs: readonly number[];
  readonly defaultDrivingLane: DrivingLaneLayout;
}

const DISTANCE_EPSILON_M = 0.000001;

function getDashCenterZMs(): number[] {
  const halfRoadLengthM = ROAD_CONFIG.roadLengthM / 2;
  const halfDashLengthM = ROAD_CONFIG.centerDashLengthM / 2;
  const dashCadenceM =
    ROAD_CONFIG.centerDashLengthM + ROAD_CONFIG.centerDashGapM;
  const lastDashCenterZM = halfRoadLengthM - halfDashLengthM;
  const dashCenterZMs: number[] = [];

  for (
    let centerZM = -halfRoadLengthM + halfDashLengthM;
    centerZM <= lastDashCenterZM + DISTANCE_EPSILON_M;
    centerZM += dashCadenceM
  ) {
    dashCenterZMs.push(centerZM);
  }

  return dashCenterZMs;
}

export function getStraightRoadLayout(): StraightRoadLayout {
  const halfRoadWidthM = ROAD_CONFIG.roadWidthM / 2;
  const halfEdgeLineWidthM = ROAD_CONFIG.edgeLineWidthM / 2;

  return {
    lengthM: ROAD_CONFIG.roadLengthM,
    widthM: ROAD_CONFIG.roadWidthM,
    centerLineXM: ROAD_CONFIG.centerLineXM,
    forwardDirectionZ: ROAD_CONFIG.forwardDirectionZ,
    leftEdgeLineCenterXM: -halfRoadWidthM + halfEdgeLineWidthM,
    rightEdgeLineCenterXM: halfRoadWidthM - halfEdgeLineWidthM,
    centerDashLengthM: ROAD_CONFIG.centerDashLengthM,
    centerDashGapM: ROAD_CONFIG.centerDashGapM,
    centerDashCenterZMs: getDashCenterZMs(),
    defaultDrivingLane: {
      side: ROAD_CONFIG.defaultDrivingLaneSide,
      centerXM: ROAD_CONFIG.leftLaneCenterXM
    }
  };
}

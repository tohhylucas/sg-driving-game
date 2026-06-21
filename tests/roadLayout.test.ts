import { describe, expect, it } from 'vitest';
import { ROAD_CONFIG } from '../src/config/constants';
import { getStraightRoadLayout } from '../src/world/roadLayout';

describe('straight road layout', () => {
  it('encodes Singapore keep-left driving under the project axes', () => {
    const layout = getStraightRoadLayout();

    expect(layout.forwardDirectionZ).toBe(-1);
    expect(layout.centerLineXM).toBe(0);
    expect(layout.defaultDrivingLane.side).toBe('left');
    expect(layout.defaultDrivingLane.centerXM).toBeLessThan(layout.centerLineXM);
    expect(layout.defaultDrivingLane.centerXM).toBeCloseTo(
      ROAD_CONFIG.leftLaneCenterXM
    );
  });

  it('derives straight-road boundaries and center markings from shared config', () => {
    const layout = getStraightRoadLayout();

    expect(layout.lengthM).toBe(ROAD_CONFIG.roadLengthM);
    expect(layout.widthM).toBe(ROAD_CONFIG.roadWidthM);
    expect(layout.leftEdgeLineCenterXM).toBeCloseTo(
      -ROAD_CONFIG.roadWidthM / 2 + ROAD_CONFIG.edgeLineWidthM / 2
    );
    expect(layout.rightEdgeLineCenterXM).toBeCloseTo(
      ROAD_CONFIG.roadWidthM / 2 - ROAD_CONFIG.edgeLineWidthM / 2
    );
    expect(layout.centerDashLengthM).toBe(ROAD_CONFIG.centerDashLengthM);
    expect(layout.centerDashGapM).toBe(ROAD_CONFIG.centerDashGapM);
  });

  it('places dashed center markings inside the straight road bounds', () => {
    const layout = getStraightRoadLayout();
    const halfRoadLengthM = ROAD_CONFIG.roadLengthM / 2;
    const halfDashLengthM = ROAD_CONFIG.centerDashLengthM / 2;

    expect(layout.centerDashCenterZMs.length).toBeGreaterThan(1);
    expect(layout.centerDashCenterZMs[0]).toBeCloseTo(
      -halfRoadLengthM + halfDashLengthM
    );
    expect(layout.centerDashCenterZMs.at(-1)).toBeLessThanOrEqual(
      halfRoadLengthM - halfDashLengthM
    );
    expect(
      layout.centerDashCenterZMs[1] - layout.centerDashCenterZMs[0]
    ).toBeCloseTo(ROAD_CONFIG.centerDashLengthM + ROAD_CONFIG.centerDashGapM);
  });
});

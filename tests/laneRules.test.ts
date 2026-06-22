import { describe, expect, it } from 'vitest';
import { ROAD_CONFIG } from '../src/config/constants';
import {
  getLanePositionOnSegment,
  isWithinDefaultDrivingLane
} from '../src/rules/laneRules';
import { getFixedTestTrackLayout } from '../src/world/testTrackLayout';

describe('lane rule helpers', () => {
  it('detects whether a car is inside the Singapore keep-left lane', () => {
    const layout = getFixedTestTrackLayout();
    const segment = layout.loopSegments[0];
    const leftLane = getLanePositionOnSegment(segment, {
      xM: -ROAD_CONFIG.laneWidthM / 2,
      zM: 0
    });
    const rightLane = getLanePositionOnSegment(segment, {
      xM: ROAD_CONFIG.laneWidthM / 2,
      zM: 0
    });

    expect(leftLane.side).toBe('left');
    expect(isWithinDefaultDrivingLane(leftLane, layout)).toBe(true);
    expect(rightLane.side).toBe('right');
    expect(isWithinDefaultDrivingLane(rightLane, layout)).toBe(false);
  });
});

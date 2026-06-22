import { describe, expect, it } from 'vitest';
import {
  isCarInsideSideHazardTriggerZone,
  SideHazardRule
} from '../src/rules/SideHazardRule';
import type { CarState } from '../src/types';
import {
  getFixedTestTrackLayout,
  type TrackSegment,
  type TrackSideHazard
} from '../src/world/testTrackLayout';

const layout = getFixedTestTrackLayout();

describe('SideHazardRule', () => {
  it('emits a violation when the car collides with a visible side hazard', () => {
    const rule = new SideHazardRule();
    const hazard = getSideHazard();
    const segment = getSegment(hazard.segmentId);

    rule.startSession(1, layout);

    expect(
      rule.update({
        car: makeCarStateAtHazard(segment, hazard, 0, -4, 3),
        dtSec: 0.1,
        elapsedSec: 0.1,
        sessionId: 1,
        track: layout
      })
    ).toEqual([]);

    expect(
      rule.update({
        car: makeCarStateAtHazard(
          segment,
          hazard,
          hazard.collisionBox.centerLocalXM,
          hazard.collisionBox.centerLocalZM,
          3
        ),
        dtSec: 0.1,
        elapsedSec: 0.2,
        sessionId: 1,
        track: layout
      })
    ).toEqual([
      expect.objectContaining({
        outcome: 'violation',
        ruleId: 'side-hazard',
        sessionId: 1
      })
    ]);
  });

  it('emits a pass when the car safely clears a triggered side-hazard scenario', () => {
    const rule = new SideHazardRule();
    const hazard = getSideHazard();
    const segment = getSegment(hazard.segmentId);
    const leftLaneXM = layout.defaultDrivingLane.centerOffsetM;
    const triggerEntry = makeCarStateAtHazard(
      segment,
      hazard,
      leftLaneXM,
      hazard.triggerZone.centerLocalZM,
      3
    );

    rule.startSession(2, layout);

    expect(
      isCarInsideSideHazardTriggerZone(layout, hazard, triggerEntry)
    ).toBe(true);
    expect(
      isCarInsideSideHazardTriggerZone(
        layout,
        hazard,
        makeCarStateAtHazard(segment, hazard, leftLaneXM, 10, 3)
      )
    ).toBe(false);

    expect(
      rule.update({
        car: triggerEntry,
        dtSec: 0.1,
        elapsedSec: 0.1,
        sessionId: 2,
        track: layout
      })
    ).toEqual([]);

    expect(
      rule.update({
        car: makeCarStateAtHazard(
          segment,
          hazard,
          leftLaneXM,
          hazard.clearanceLocalZM - 0.5,
          3
        ),
        dtSec: 0.1,
        elapsedSec: 0.2,
        sessionId: 2,
        track: layout
      })
    ).toEqual([
      expect.objectContaining({
        outcome: 'pass',
        ruleId: 'side-hazard',
        sessionId: 2
      })
    ]);
  });

  it('starts active, suppresses duplicate incident events, and resets per session', () => {
    const rule = new SideHazardRule();
    const hazard = getSideHazard();
    const segment = getSegment(hazard.segmentId);
    const collision = makeCarStateAtHazard(
      segment,
      hazard,
      hazard.collisionBox.centerLocalXM,
      hazard.collisionBox.centerLocalZM,
      3
    );

    rule.startSession(3, layout);

    expect(rule.getDiagnostics()).toEqual(
      expect.objectContaining({
        ruleId: 'side-hazard',
        activeHazardCount: 1,
        pendingHazardCount: 1,
        passedHazardCount: 0,
        violationHazardCount: 0
      })
    );
    expect(
      rule.update({
        car: collision,
        dtSec: 0.1,
        elapsedSec: 0.1,
        sessionId: 3,
        track: layout
      })
    ).toHaveLength(1);
    expect(
      rule.update({
        car: collision,
        dtSec: 0.1,
        elapsedSec: 0.2,
        sessionId: 3,
        track: layout
      })
    ).toEqual([]);
    expect(
      rule.update({
        car: makeCarStateAtHazard(
          segment,
          hazard,
          layout.defaultDrivingLane.centerOffsetM,
          hazard.clearanceLocalZM - 0.5,
          3
        ),
        dtSec: 0.1,
        elapsedSec: 0.3,
        sessionId: 3,
        track: layout
      })
    ).toEqual([]);
    expect(rule.getDiagnostics()).toEqual(
      expect.objectContaining({
        pendingHazardCount: 0,
        violationHazardCount: 1
      })
    );

    rule.startSession(4, layout);

    expect(
      rule.update({
        car: collision,
        dtSec: 0.1,
        elapsedSec: 0.1,
        sessionId: 4,
        track: layout
      })
    ).toEqual([
      expect.objectContaining({
        outcome: 'violation',
        sessionId: 4
      })
    ]);
  });
});

function getSideHazard(): TrackSideHazard {
  const hazard = layout.sideHazards[0];

  if (!hazard) {
    throw new Error('Expected one fixed side hazard.');
  }

  return hazard;
}

function getSegment(segmentId: string): TrackSegment {
  const segment = layout.segments.find((candidate) => candidate.id === segmentId);

  if (!segment) {
    throw new Error(`Expected test track segment ${segmentId}.`);
  }

  return segment;
}

function makeCarStateAtHazard(
  segment: TrackSegment,
  _hazard: TrackSideHazard,
  localXM: number,
  localZM: number,
  speedMps: number
): CarState {
  return {
    position: {
      x:
        segment.center.xM +
        localXM * Math.cos(segment.headingRad) +
        localZM * Math.sin(segment.headingRad),
      y: 0.01,
      z:
        segment.center.zM -
        localXM * Math.sin(segment.headingRad) +
        localZM * Math.cos(segment.headingRad)
    },
    headingRad: segment.headingRad,
    speedMps
  };
}

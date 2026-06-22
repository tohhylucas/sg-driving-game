import { describe, expect, it } from 'vitest';
import {
  computeFollowingTimeGapSec,
  FollowingTimeGapRule,
  selectNearestForwardMovingElement
} from '../src/rules/FollowingTimeGapRule';
import type { CarState, MovingElementState } from '../src/types';
import {
  getFixedTestTrackLayout,
  type TrackSegment
} from '../src/world/testTrackLayout';

const layout = getFixedTestTrackLayout();
const loopSegment = getSegment('loop-1');

describe('FollowingTimeGapRule', () => {
  it('selects only the nearest tracked moving element ahead in the current lane', () => {
    const car = makeCar(loopSegment, layout.defaultDrivingLane.centerOffsetM, 0, 8);
    const nearest = makeMovingElement('nearest', loopSegment, -12);
    const farther = makeMovingElement('farther', loopSegment, -24);
    const adjacentLane = makeMovingElement(
      'adjacent',
      loopSegment,
      -6,
      -layout.defaultDrivingLane.centerOffsetM
    );
    const behind = makeMovingElement('behind', loopSegment, 6);

    expect(
      selectNearestForwardMovingElement(layout, car, [
        farther,
        adjacentLane,
        nearest,
        behind
      ])
    ).toEqual(
      expect.objectContaining({
        element: expect.objectContaining({ id: 'nearest' })
      })
    );
  });

  it('computes a time gap from live car and moving-element state', () => {
    const car = makeCar(loopSegment, layout.defaultDrivingLane.centerOffsetM, 0, 10);
    const element = makeMovingElement('lead', loopSegment, -25);
    const selection = selectNearestForwardMovingElement(layout, car, [element]);

    expect(selection).toBeDefined();
    expect(
      computeFollowingTimeGapSec(car, selection?.forwardDistanceM ?? 0, element)
    ).toBeCloseTo((25 - carLengthM() / 2 - element.lengthM / 2) / 10);
  });

  it('starts an encounter at a safe gap within detection range and passes only on clean completion', () => {
    const rule = new FollowingTimeGapRule({
      detectionRangeM: 50,
      minimumEncounterDurationSec: 1,
      safeTimeGapSec: 2,
      unsafeGracePeriodSec: 1
    });
    const car = makeCar(loopSegment, layout.defaultDrivingLane.centerOffsetM, 0, 5);
    const safeLead = makeMovingElement('lead', loopSegment, -24);

    rule.startSession(2, layout);

    expect(
      rule.update({
        car,
        dtSec: 0.5,
        elapsedSec: 0.5,
        movingElements: [safeLead],
        sessionId: 2,
        track: layout
      })
    ).toEqual([]);
    expect(rule.getDiagnostics()).toEqual(
      expect.objectContaining({
        activeEncounterElementId: 'lead',
        safeTimeGapSec: 2
      })
    );

    expect(
      rule.update({
        car,
        dtSec: 0.6,
        elapsedSec: 1.1,
        movingElements: [],
        sessionId: 2,
        track: layout
      })
    ).toEqual([
      expect.objectContaining({
        outcome: 'pass',
        ruleId: 'following-time-gap',
        sessionId: 2
      })
    ]);
  });

  it('completes an active clean encounter when the session ends', () => {
    const rule = new FollowingTimeGapRule({
      detectionRangeM: 50,
      minimumEncounterDurationSec: 1,
      safeTimeGapSec: 2,
      unsafeGracePeriodSec: 1
    });
    const car = makeCar(loopSegment, layout.defaultDrivingLane.centerOffsetM, 0, 5);
    const safeLead = makeMovingElement('lead', loopSegment, -24);

    rule.startSession(12, layout);
    rule.update({
      car,
      dtSec: 1.1,
      elapsedSec: 1.1,
      movingElements: [safeLead],
      sessionId: 12,
      track: layout
    });

    expect(
      rule.endSession({
        car,
        elapsedSec: 1.1,
        reason: 'finish',
        sessionId: 12,
        track: layout
      })
    ).toEqual([
      expect.objectContaining({
        outcome: 'pass',
        ruleId: 'following-time-gap'
      })
    ]);
  });

  it('does not start following encounters outside the forward detection range', () => {
    const rule = new FollowingTimeGapRule({
      detectionRangeM: 8,
      minimumEncounterDurationSec: 1,
      safeTimeGapSec: 2,
      unsafeGracePeriodSec: 0.5
    });
    const car = makeCar(loopSegment, layout.defaultDrivingLane.centerOffsetM, 0, 10);
    const outsideRangeLead = makeMovingElement('lead', loopSegment, -20);

    rule.startSession(8, layout);

    expect(
      rule.update({
        car,
        dtSec: 1,
        elapsedSec: 1,
        movingElements: [outsideRangeLead],
        sessionId: 8,
        track: layout
      })
    ).toEqual([]);
    expect(rule.getDiagnostics().activeEncounterElementId).toBeUndefined();
  });

  it('does not treat side-hazard scenarios as following targets', () => {
    const rule = new FollowingTimeGapRule({
      detectionRangeM: 50,
      minimumEncounterDurationSec: 1,
      safeTimeGapSec: 2,
      unsafeGracePeriodSec: 0.5
    });
    const car = makeCar(loopSegment, layout.defaultDrivingLane.centerOffsetM, 0, 10);

    expect(layout.sideHazards).toHaveLength(1);
    rule.startSession(11, layout);

    expect(
      rule.update({
        car,
        dtSec: 1,
        elapsedSec: 1,
        movingElements: [],
        sessionId: 11,
        track: layout
      })
    ).toEqual([]);
    expect(rule.getDiagnostics().activeEncounterElementId).toBeUndefined();
  });

  it('uses the configured global safe time-gap threshold for every encounter', () => {
    const car = makeCar(loopSegment, layout.defaultDrivingLane.centerOffsetM, 0, 10);
    const leadWithModerateGap = makeMovingElement('lead', loopSegment, -27);
    const strictRule = new FollowingTimeGapRule({
      detectionRangeM: 50,
      minimumEncounterDurationSec: 1,
      safeTimeGapSec: 3,
      unsafeGracePeriodSec: 0.5
    });
    const lenientRule = new FollowingTimeGapRule({
      detectionRangeM: 50,
      minimumEncounterDurationSec: 1,
      safeTimeGapSec: 2,
      unsafeGracePeriodSec: 0.5
    });

    strictRule.startSession(9, layout);
    lenientRule.startSession(10, layout);

    expect(
      strictRule.update({
        car,
        dtSec: 0.6,
        elapsedSec: 0.6,
        movingElements: [leadWithModerateGap],
        sessionId: 9,
        track: layout
      })
    ).toEqual([expect.objectContaining({ outcome: 'violation' })]);
    expect(
      lenientRule.update({
        car,
        dtSec: 0.6,
        elapsedSec: 0.6,
        movingElements: [leadWithModerateGap],
        sessionId: 10,
        track: layout
      })
    ).toEqual([]);
  });

  it('does not emit continuous pass events or pass too-short clean encounters', () => {
    const rule = new FollowingTimeGapRule({
      detectionRangeM: 50,
      minimumEncounterDurationSec: 1,
      safeTimeGapSec: 2,
      unsafeGracePeriodSec: 1
    });
    const car = makeCar(loopSegment, layout.defaultDrivingLane.centerOffsetM, 0, 5);
    const safeLead = makeMovingElement('lead', loopSegment, -24);

    rule.startSession(3, layout);

    expect(
      rule.update({
        car,
        dtSec: 0.4,
        elapsedSec: 0.4,
        movingElements: [safeLead],
        sessionId: 3,
        track: layout
      })
    ).toEqual([]);
    expect(
      rule.update({
        car,
        dtSec: 0.1,
        elapsedSec: 0.5,
        movingElements: [],
        sessionId: 3,
        track: layout
      })
    ).toEqual([]);
  });

  it('emits one violation after the unsafe grace period and locks out a later pass', () => {
    const rule = new FollowingTimeGapRule({
      detectionRangeM: 50,
      minimumEncounterDurationSec: 1,
      safeTimeGapSec: 2,
      unsafeGracePeriodSec: 1
    });
    const car = makeCar(loopSegment, layout.defaultDrivingLane.centerOffsetM, 0, 10);
    const unsafeLead = makeMovingElement('lead', loopSegment, -10);
    const recoveredLead = makeMovingElement('lead', loopSegment, -40);

    rule.startSession(4, layout);
    expect(
      rule.update({
        car,
        dtSec: 0.6,
        elapsedSec: 0.6,
        movingElements: [unsafeLead],
        sessionId: 4,
        track: layout
      })
    ).toEqual([]);

    expect(
      rule.update({
        car,
        dtSec: 0.5,
        elapsedSec: 1.1,
        movingElements: [unsafeLead],
        sessionId: 4,
        track: layout
      })
    ).toEqual([
      expect.objectContaining({
        outcome: 'violation',
        ruleId: 'following-time-gap'
      })
    ]);
    expect(
      rule.update({
        car,
        dtSec: 0.5,
        elapsedSec: 1.6,
        movingElements: [unsafeLead],
        sessionId: 4,
        track: layout
      })
    ).toEqual([]);
    expect(
      rule.update({
        car,
        dtSec: 1,
        elapsedSec: 2.6,
        movingElements: [recoveredLead],
        sessionId: 4,
        track: layout
      })
    ).toEqual([]);
    expect(
      rule.update({
        car,
        dtSec: 0.1,
        elapsedSec: 2.7,
        movingElements: [],
        sessionId: 4,
        track: layout
      })
    ).toEqual([]);
    expect(rule.getDiagnostics()).toEqual(
      expect.objectContaining({
        violationEncounterCount: 1
      })
    );
  });

  it('allows the same moving element to re-enter as an independent encounter', () => {
    const rule = new FollowingTimeGapRule({
      detectionRangeM: 50,
      minimumEncounterDurationSec: 0.5,
      safeTimeGapSec: 2,
      unsafeGracePeriodSec: 0.5
    });
    const car = makeCar(loopSegment, layout.defaultDrivingLane.centerOffsetM, 0, 5);
    const safeLead = makeMovingElement('lead', loopSegment, -24);
    const unsafeFastCar = makeCar(
      loopSegment,
      layout.defaultDrivingLane.centerOffsetM,
      0,
      10
    );
    const unsafeLead = makeMovingElement('lead', loopSegment, -10);

    rule.startSession(5, layout);
    rule.update({
      car,
      dtSec: 0.6,
      elapsedSec: 0.6,
      movingElements: [safeLead],
      sessionId: 5,
      track: layout
    });
    expect(
      rule.update({
        car,
        dtSec: 0.1,
        elapsedSec: 0.7,
        movingElements: [],
        sessionId: 5,
        track: layout
      })
    ).toEqual([expect.objectContaining({ outcome: 'pass' })]);

    expect(
      rule.update({
        car: unsafeFastCar,
        dtSec: 0.6,
        elapsedSec: 1.3,
        movingElements: [unsafeLead],
        sessionId: 5,
        track: layout
      })
    ).toEqual([expect.objectContaining({ outcome: 'violation' })]);
  });

  it('applies minimum duration only to pass eligibility', () => {
    const rule = new FollowingTimeGapRule({
      detectionRangeM: 50,
      minimumEncounterDurationSec: 5,
      safeTimeGapSec: 2,
      unsafeGracePeriodSec: 0.5
    });
    const car = makeCar(loopSegment, layout.defaultDrivingLane.centerOffsetM, 0, 10);
    const unsafeLead = makeMovingElement('lead', loopSegment, -10);

    rule.startSession(6, layout);

    expect(
      rule.update({
        car,
        dtSec: 0.6,
        elapsedSec: 0.6,
        movingElements: [unsafeLead],
        sessionId: 6,
        track: layout
      })
    ).toEqual([expect.objectContaining({ outcome: 'violation' })]);
  });

  it('uses hysteresis before recovering from an unsafe gap', () => {
    const rule = new FollowingTimeGapRule({
      detectionRangeM: 50,
      minimumEncounterDurationSec: 1,
      safeTimeGapSec: 2,
      unsafeGracePeriodSec: 1,
      recoveryHysteresisSec: 0.5
    });
    const car = makeCar(loopSegment, layout.defaultDrivingLane.centerOffsetM, 0, 10);
    const unsafeLead = makeMovingElement('lead', loopSegment, -22);
    const barelyRecoveredLead = makeMovingElement('lead', loopSegment, -26);

    rule.startSession(7, layout);
    rule.update({
      car,
      dtSec: 0.6,
      elapsedSec: 0.6,
      movingElements: [unsafeLead],
      sessionId: 7,
      track: layout
    });

    expect(
      rule.update({
        car,
        dtSec: 0.5,
        elapsedSec: 1.1,
        movingElements: [barelyRecoveredLead],
        sessionId: 7,
        track: layout
      })
    ).toEqual([expect.objectContaining({ outcome: 'violation' })]);
  });
});

function makeCar(
  segment: TrackSegment,
  localXM: number,
  localZM: number,
  speedMps: number
): CarState {
  const point = getPoint(segment, localXM, localZM);

  return {
    position: { x: point.xM, y: 0.01, z: point.zM },
    headingRad: segment.headingRad,
    speedMps
  };
}

function makeMovingElement(
  id: string,
  segment: TrackSegment,
  localZM: number,
  localXM = layout.defaultDrivingLane.centerOffsetM
): MovingElementState {
  const point = getPoint(segment, localXM, localZM);

  return {
    id,
    kind: 'lead-vehicle',
    segmentId: segment.id,
    position: { x: point.xM, y: 0.01, z: point.zM },
    headingRad: segment.headingRad,
    speedMps: 4,
    lengthM: 4.2,
    widthM: 1.7
  };
}

function carLengthM(): number {
  return 4.2;
}

function getSegment(segmentId: string): TrackSegment {
  const segment = layout.segments.find((candidate) => candidate.id === segmentId);

  if (!segment) {
    throw new Error(`Expected test track segment ${segmentId}.`);
  }

  return segment;
}

function getPoint(
  segment: TrackSegment,
  localXM: number,
  localZM: number
): { xM: number; zM: number } {
  return {
    xM:
      segment.center.xM +
      localXM * Math.cos(segment.headingRad) +
      localZM * Math.sin(segment.headingRad),
    zM:
      segment.center.zM -
      localXM * Math.sin(segment.headingRad) +
      localZM * Math.cos(segment.headingRad)
  };
}

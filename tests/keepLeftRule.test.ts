import { describe, expect, it } from 'vitest';
import type { CarState } from '../src/types';
import { KeepLeftRule } from '../src/rules/KeepLeftRule';
import {
  getFixedTestTrackLayout,
  type TrackSegment
} from '../src/world/testTrackLayout';

describe('KeepLeftRule', () => {
  const layout = getFixedTestTrackLayout();
  const loopSegment = layout.loopSegments[0];
  const sideRoadSegment = layout.segments.find(
    (segment) => segment.id === 't-junction-side-road'
  );
  const leftLaneCar = makeCarState(-1.75);
  const rightLaneCar = makeCarState(1.75);

  it('emits one violation after the grace period outside the left lane', () => {
    const rule = new KeepLeftRule({ gracePeriodSec: 1 });

    rule.startSession(1);

    expect(
      rule.update({
        car: rightLaneCar,
        dtSec: 0.5,
        elapsedSec: 0.5,
        sessionId: 1,
        track: layout
      })
    ).toEqual([]);

    const violation = rule.update({
      car: rightLaneCar,
      dtSec: 0.6,
      elapsedSec: 1.1,
      sessionId: 1,
      track: layout
    });
    const duplicate = rule.update({
      car: rightLaneCar,
      dtSec: 2,
      elapsedSec: 3.1,
      sessionId: 1,
      track: layout
    });

    expect(violation).toEqual([
      expect.objectContaining({
        outcome: 'violation',
        ruleId: 'keep-left',
        sessionId: 1
      })
    ]);
    expect(duplicate).toEqual([]);
  });

  it('emits another violation after returning left and entering a new wrong-lane episode on the same road', () => {
    const rule = new KeepLeftRule({ gracePeriodSec: 1 });

    rule.startSession(2);

    const firstViolation = rule.update({
      car: rightLaneCar,
      dtSec: 1.1,
      elapsedSec: 1.1,
      sessionId: 2,
      track: layout
    });
    const recovered = rule.update({
      car: leftLaneCar,
      dtSec: 0.1,
      elapsedSec: 1.2,
      sessionId: 2,
      track: layout
    });
    const secondViolation = rule.update({
      car: rightLaneCar,
      dtSec: 1.1,
      elapsedSec: 2.3,
      sessionId: 2,
      track: layout
    });

    expect(firstViolation).toHaveLength(1);
    expect(recovered).toEqual([]);
    expect(secondViolation).toEqual([
      expect.objectContaining({
        outcome: 'violation',
        ruleId: 'keep-left',
        sessionId: 2
      })
    ]);
    expect(secondViolation[0].id).not.toBe(firstViolation[0].id);
  });

  it('allows a new keep-left violation after entering another road segment', () => {
    const rule = new KeepLeftRule({ gracePeriodSec: 1 });

    if (!sideRoadSegment) {
      throw new Error('Expected t-junction side road segment in test layout.');
    }

    rule.startSession(3);

    const loopViolation = rule.update({
      car: rightLaneCar,
      dtSec: 1.1,
      elapsedSec: 1.1,
      sessionId: 3,
      track: layout
    });
    const newRoadTooEarly = rule.update({
      car: makeCarStateFromSegment(sideRoadSegment, 1.75, 0),
      dtSec: 0.5,
      elapsedSec: 1.6,
      sessionId: 3,
      track: layout
    });
    const newRoadViolation = rule.update({
      car: makeCarStateFromSegment(sideRoadSegment, 1.75, 0),
      dtSec: 0.6,
      elapsedSec: 2.2,
      sessionId: 3,
      track: layout
    });

    expect(loopViolation).toHaveLength(1);
    expect(newRoadTooEarly).toEqual([]);
    expect(newRoadViolation).toEqual([
      expect.objectContaining({
        outcome: 'violation',
        ruleId: 'keep-left',
        sessionId: 3
      })
    ]);
    expect(newRoadViolation[0].id).not.toBe(loopViolation[0].id);
  });

  it('emits a pass only when a clean session finishes', () => {
    const rule = new KeepLeftRule({ gracePeriodSec: 1 });

    rule.startSession(4);
    expect(
      rule.update({
        car: leftLaneCar,
        dtSec: 2,
        elapsedSec: 2,
        sessionId: 4,
        track: layout
      })
    ).toEqual([]);

    expect(
      rule.endSession({
        car: leftLaneCar,
        elapsedSec: 3,
        reason: 'finish',
        sessionId: 4,
        track: layout
      })
    ).toEqual([
      expect.objectContaining({
        outcome: 'pass',
        ruleId: 'keep-left',
        sessionId: 4
      })
    ]);
  });

  it('exposes current grace period and lane side diagnostics', () => {
    const rule = new KeepLeftRule({ gracePeriodSec: 1.25 });

    rule.startSession(5);

    expect(rule.getDiagnostics()).toEqual({
      ruleId: 'keep-left',
      gracePeriodSec: 1.25,
      laneSide: 'left',
      segmentId: '',
      outsideLaneSec: 0,
      withinDefaultLane: true
    });

    rule.update({
      car: rightLaneCar,
      dtSec: 0.5,
      elapsedSec: 0.5,
      sessionId: 5,
      track: layout
    });

    expect(rule.getDiagnostics()).toEqual({
      ruleId: 'keep-left',
      gracePeriodSec: 1.25,
      laneSide: 'right',
      segmentId: loopSegment.id,
      outsideLaneSec: 0.5,
      withinDefaultLane: false
    });

    rule.update({
      car: leftLaneCar,
      dtSec: 0.2,
      elapsedSec: 0.7,
      sessionId: 5,
      track: layout
    });

    expect(rule.getDiagnostics()).toEqual({
      ruleId: 'keep-left',
      gracePeriodSec: 1.25,
      laneSide: 'left',
      segmentId: loopSegment.id,
      outsideLaneSec: 0,
      withinDefaultLane: true
    });
  });
});

function makeCarState(x: number, z = 0): CarState {
  return {
    position: { x, y: 0.01, z },
    headingRad: 0,
    speedMps: 0
  };
}

function makeCarStateFromSegment(
  segment: TrackSegment,
  localXM: number,
  localZM: number
): CarState {
  const x =
    segment.center.xM +
    localXM * Math.cos(segment.headingRad) +
    localZM * Math.sin(segment.headingRad);
  const z =
    segment.center.zM -
    localXM * Math.sin(segment.headingRad) +
    localZM * Math.cos(segment.headingRad);

  return makeCarState(x, z);
}

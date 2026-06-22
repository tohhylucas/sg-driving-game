import { describe, expect, it } from 'vitest';
import type { CarState } from '../src/types';
import {
  DrivingSession,
  type SessionRule
} from '../src/rules/DrivingSession';
import { KeepLeftRule } from '../src/rules/KeepLeftRule';
import type { ScoredEvent } from '../src/rules/scoring';
import { createInitialCarState } from '../src/vehicle/carState';
import { getFixedTestTrackLayout } from '../src/world/testTrackLayout';

describe('DrivingSession', () => {
  const track = getFixedTestTrackLayout();

  it('starts always-active rules when a session starts', () => {
    const rule = new RecordingRule();
    const session = new DrivingSession({ rules: [rule], track });

    session.start(createInitialCarState());

    expect(session.state.active).toBe(true);
    expect(session.state.sessionId).toBe(1);
    expect(rule.startedSessionIds).toEqual([1]);
  });

  it('aggregates scored events within the active session', () => {
    const session = new DrivingSession({
      rules: [new KeepLeftRule({ gracePeriodSec: 1 })],
      track
    });

    session.start(createInitialCarState());
    session.update(makeCarState(1.75, 0), 1.1);
    session.update(makeCarState(1.75, 0), 1.1);

    expect(session.summary.violationCount).toBe(1);
    expect(session.summary.passCount).toBe(0);
    expect(session.summary.events).toHaveLength(1);
  });

  it('aggregates separate keep-left violation episodes independently', () => {
    const session = new DrivingSession({
      rules: [new KeepLeftRule({ gracePeriodSec: 1 })],
      track
    });

    session.start(createInitialCarState());
    session.update(makeCarState(1.75, 0), 1.1);
    session.update(makeCarState(-1.75, 0), 0.1);
    session.update(makeCarState(1.75, 0), 1.1);

    expect(session.summary.violationCount).toBe(2);
    expect(session.summary.events).toHaveLength(2);
  });

  it('ends the session and records a clean pass when crossing the finish zone', () => {
    const session = new DrivingSession({
      rules: [new KeepLeftRule({ gracePeriodSec: 1 })],
      track
    });

    session.start(createInitialCarState());
    session.update(makeCarState(-1.75, track.finishZone.center.zM), 0.1);

    expect(session.state.active).toBe(false);
    expect(session.summary.passCount).toBe(1);
    expect(session.summary.violationCount).toBe(0);
  });

  it('reset starts a fresh session and clears current scored events', () => {
    const session = new DrivingSession({
      rules: [new KeepLeftRule({ gracePeriodSec: 1 })],
      track
    });

    session.start(createInitialCarState());
    session.update(makeCarState(1.75, 0), 1.1);
    session.reset(createInitialCarState());

    expect(session.state.active).toBe(true);
    expect(session.state.sessionId).toBe(2);
    expect(session.summary.events).toEqual([]);
  });

  it('exposes rule diagnostics for debug HUDs', () => {
    const session = new DrivingSession({
      rules: [new KeepLeftRule({ gracePeriodSec: 1.25 })],
      track
    });

    session.start(createInitialCarState());
    session.update(makeCarState(1.75, 0), 0.5);

    expect(session.ruleDiagnostics).toEqual([
      expect.objectContaining({
        ruleId: 'keep-left',
        gracePeriodSec: 1.25,
        laneSide: 'right',
        outsideLaneSec: 0.5,
        withinDefaultLane: false
      })
    ]);
  });
});

class RecordingRule implements SessionRule {
  readonly id = 'recording';
  readonly startedSessionIds: number[] = [];

  startSession(sessionId: number): void {
    this.startedSessionIds.push(sessionId);
  }

  update(): ScoredEvent[] {
    return [];
  }

  endSession(): ScoredEvent[] {
    return [];
  }
}

function makeCarState(x: number, z: number): CarState {
  return {
    position: { x, y: 0.01, z },
    headingRad: 0,
    speedMps: 0
  };
}

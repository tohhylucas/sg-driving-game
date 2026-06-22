import { describe, expect, it } from 'vitest';
import type { CarState } from '../src/types';
import {
  DrivingSession,
  type SessionRule
} from '../src/rules/DrivingSession';
import { KeepLeftRule } from '../src/rules/KeepLeftRule';
import { SideHazardRule } from '../src/rules/SideHazardRule';
import { StopLineRule } from '../src/rules/StopLineRule';
import type { ScoredEvent } from '../src/rules/scoring';
import { createInitialCarState } from '../src/vehicle/carState';
import {
  getFixedTestTrackLayout,
  type TrackSegment,
  type TrackSideHazard,
  type TrackStopLineRuleZone
} from '../src/world/testTrackLayout';

const track = getFixedTestTrackLayout();

describe('DrivingSession', () => {

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

  it('starts stop-line diagnostics with active rule zones', () => {
    const session = new DrivingSession({
      rules: [new StopLineRule()],
      track
    });

    session.start(createInitialCarState());

    expect(session.state.active).toBe(true);
    expect(session.ruleDiagnostics).toEqual([
      expect.objectContaining({
        ruleId: 'stop-line',
        activeZoneCount: 1,
        pendingZoneCount: 1
      })
    ]);
  });

  it('ends the session immediately when the side-road stop line is crossed without stopping', () => {
    const session = new DrivingSession({
      rules: [new StopLineRule({ completeStopMaxSpeedMps: 0.1 })],
      track
    });
    const zone = getTjunctionStopLineZone();
    const segment = getSegment(zone.segmentId);

    session.start(createInitialCarState());
    session.update(makeCarStateAtZone(segment, zone, 1, 1), 0.1);
    session.update(makeCarStateAtZone(segment, zone, -0.2, 1), 0.1);

    expect(session.state.active).toBe(false);
    expect(session.state.endReason).toBe('failure');
    expect(session.summary.violationCount).toBe(1);
    expect(session.summary.passCount).toBe(0);
    expect(session.summary.events).toEqual([
      expect.objectContaining({
        message: 'IMMEDIATE FAILURE: Stop line crossed without a complete stop',
        outcome: 'violation',
        ruleId: 'stop-line'
      })
    ]);
    expect(session.ruleDiagnostics).toEqual([
      expect.objectContaining({
        ruleId: 'stop-line',
        activeZoneCount: 1,
        pendingZoneCount: 0,
        violationZoneCount: 1
      })
    ]);
  });

  it('starts side-hazard diagnostics with active fixed hazards', () => {
    const session = new DrivingSession({
      rules: [new SideHazardRule()],
      track
    });

    session.start(createInitialCarState());

    expect(session.state.active).toBe(true);
    expect(session.ruleDiagnostics).toEqual([
      expect.objectContaining({
        ruleId: 'side-hazard',
        activeHazardCount: 1,
        pendingHazardCount: 1
      })
    ]);
  });

  it('ends the session immediately when the car collides with a side hazard', () => {
    const session = new DrivingSession({
      rules: [new SideHazardRule()],
      track
    });
    const hazard = getSideHazard();
    const segment = getSegment(hazard.segmentId);

    session.start(createInitialCarState());
    session.update(
      makeCarStateAtHazard(
        segment,
        hazard,
        hazard.collisionBox.centerLocalXM,
        hazard.collisionBox.centerLocalZM,
        3
      ),
      0.1
    );

    expect(session.state.active).toBe(false);
    expect(session.state.endReason).toBe('failure');
    expect(session.summary.violationCount).toBe(1);
    expect(session.summary.passCount).toBe(0);
    expect(session.summary.events).toEqual([
      expect.objectContaining({
        message: 'IMMEDIATE FAILURE: Side hazard collision',
        outcome: 'violation',
        ruleId: 'side-hazard'
      })
    ]);
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

  it('keeps diagnostics aligned with the car after the scoring session ends', () => {
    const session = new DrivingSession({
      rules: [new KeepLeftRule({ gracePeriodSec: 1 })],
      track
    });

    session.start(createInitialCarState());
    session.update(makeCarState(1.75, 0), 2.5);
    session.end('finish', makeCarState(1.75, 0));
    session.update(makeCarState(-1.75, 0), 0.1);

    expect(session.state.active).toBe(false);
    expect(session.ruleDiagnostics).toEqual([
      expect.objectContaining({
        laneSide: 'left',
        outsideLaneSec: 0,
        withinDefaultLane: true
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

function getTjunctionStopLineZone(): TrackStopLineRuleZone {
  const zone = track.stopLineRuleZones.find(
    (candidate) => candidate.junctionId === 't-junction'
  );

  if (!zone) {
    throw new Error('Expected T-junction stop-line rule zone.');
  }

  return zone;
}

function getSegment(segmentId: string): TrackSegment {
  const segment = track.segments.find((candidate) => candidate.id === segmentId);

  if (!segment) {
    throw new Error(`Expected test track segment ${segmentId}.`);
  }

  return segment;
}

function makeCarStateAtZone(
  segment: TrackSegment,
  zone: TrackStopLineRuleZone,
  signedApproachDistanceM: number,
  speedMps: number
): CarState {
  const localZM =
    zone.stopLineLocalZM +
    signedApproachDistanceM *
      (zone.crossingDirection === -1 ? 1 : -1);
  const x =
    segment.center.xM +
    localZM * Math.sin(segment.headingRad);
  const z =
    segment.center.zM +
    localZM * Math.cos(segment.headingRad);

  return {
    position: { x, y: 0.01, z },
    headingRad: segment.headingRad,
    speedMps
  };
}

function getSideHazard(): TrackSideHazard {
  const hazard = track.sideHazards[0];

  if (!hazard) {
    throw new Error('Expected one fixed side hazard.');
  }

  return hazard;
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

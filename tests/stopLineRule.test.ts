import { describe, expect, it } from 'vitest';
import { StopLineRule } from '../src/rules/StopLineRule';
import type { CarState } from '../src/types';
import {
  getFixedTestTrackLayout,
  type TrackSegment,
  type TrackStopLineRuleZone
} from '../src/world/testTrackLayout';

describe('StopLineRule', () => {
  const layout = getFixedTestTrackLayout();

  it('emits a pass when the car fully stops before crossing the side-road stop line', () => {
    const rule = new StopLineRule({ completeStopMaxSpeedMps: 0.1 });
    const zone = getTjunctionStopLineZone();
    const segment = getSegment(zone.segmentId);

    rule.startSession(1, layout);

    expect(
      rule.update({
        car: makeCarStateAtZone(segment, zone, 3, 2),
        dtSec: 0.1,
        elapsedSec: 0.1,
        sessionId: 1,
        track: layout
      })
    ).toEqual([]);
    expect(
      rule.update({
        car: makeCarStateAtZone(segment, zone, 1, 0.05),
        dtSec: 0.2,
        elapsedSec: 0.3,
        sessionId: 1,
        track: layout
      })
    ).toEqual([]);

    expect(
      rule.update({
        car: makeCarStateAtZone(segment, zone, -0.2, 1.5),
        dtSec: 0.1,
        elapsedSec: 0.4,
        sessionId: 1,
        track: layout
      })
    ).toEqual([
      expect.objectContaining({
        outcome: 'pass',
        ruleId: 'stop-line',
        sessionId: 1
      })
    ]);
  });

  it('emits a violation when the car crosses the stop line without stopping', () => {
    const rule = new StopLineRule({ completeStopMaxSpeedMps: 0.1 });
    const zone = getTjunctionStopLineZone();
    const segment = getSegment(zone.segmentId);

    rule.startSession(2, layout);
    rule.update({
      car: makeCarStateAtZone(segment, zone, 1, 2),
      dtSec: 0.1,
      elapsedSec: 0.1,
      sessionId: 2,
      track: layout
    });

    expect(
      rule.update({
        car: makeCarStateAtZone(segment, zone, -0.2, 2),
        dtSec: 0.1,
        elapsedSec: 0.2,
        sessionId: 2,
        track: layout
      })
    ).toEqual([
      expect.objectContaining({
        message: 'IMMEDIATE FAILURE: Stop line crossed without a complete stop',
        outcome: 'violation',
        ruleId: 'stop-line',
        sessionId: 2
      })
    ]);
  });

  it('treats a rolling stop above the complete-stop speed as a violation', () => {
    const rule = new StopLineRule({ completeStopMaxSpeedMps: 0.1 });
    const zone = getTjunctionStopLineZone();
    const segment = getSegment(zone.segmentId);

    rule.startSession(3, layout);
    rule.update({
      car: makeCarStateAtZone(segment, zone, 1, 0.11),
      dtSec: 0.1,
      elapsedSec: 0.1,
      sessionId: 3,
      track: layout
    });

    expect(
      rule.update({
        car: makeCarStateAtZone(segment, zone, -0.2, 1),
        dtSec: 0.1,
        elapsedSec: 0.2,
        sessionId: 3,
        track: layout
      })
    ).toEqual([
      expect.objectContaining({
        message: 'IMMEDIATE FAILURE: Stop line crossed without a complete stop',
        outcome: 'violation',
        ruleId: 'stop-line',
        sessionId: 3
      })
    ]);
  });

  it('allows reversing away before the line and retrying with a complete stop', () => {
    const rule = new StopLineRule({ completeStopMaxSpeedMps: 0.1 });
    const zone = getTjunctionStopLineZone();
    const segment = getSegment(zone.segmentId);

    rule.startSession(4, layout);
    rule.update({
      car: makeCarStateAtZone(segment, zone, 1, 1),
      dtSec: 0.1,
      elapsedSec: 0.1,
      sessionId: 4,
      track: layout
    });
    expect(
      rule.update({
        car: makeCarStateAtZone(segment, zone, 3, -1),
        dtSec: 0.1,
        elapsedSec: 0.2,
        sessionId: 4,
        track: layout
      })
    ).toEqual([]);
    rule.update({
      car: makeCarStateAtZone(segment, zone, 1, 0),
      dtSec: 0.1,
      elapsedSec: 0.3,
      sessionId: 4,
      track: layout
    });

    expect(
      rule.update({
        car: makeCarStateAtZone(segment, zone, -0.2, 1),
        dtSec: 0.1,
        elapsedSec: 0.4,
        sessionId: 4,
        track: layout
      })
    ).toEqual([
      expect.objectContaining({
        outcome: 'pass',
        ruleId: 'stop-line',
        sessionId: 4
      })
    ]);
  });

  it('clears stop-line progress when a new session starts', () => {
    const rule = new StopLineRule({ completeStopMaxSpeedMps: 0.1 });
    const zone = getTjunctionStopLineZone();
    const segment = getSegment(zone.segmentId);

    rule.startSession(5, layout);
    rule.update({
      car: makeCarStateAtZone(segment, zone, 1, 1),
      dtSec: 0.1,
      elapsedSec: 0.1,
      sessionId: 5,
      track: layout
    });
    expect(
      rule.update({
        car: makeCarStateAtZone(segment, zone, -0.2, 1),
        dtSec: 0.1,
        elapsedSec: 0.2,
        sessionId: 5,
        track: layout
      })
    ).toEqual([
      expect.objectContaining({
        outcome: 'violation',
        sessionId: 5
      })
    ]);

    rule.startSession(6, layout);
    rule.update({
      car: makeCarStateAtZone(segment, zone, 1, 0),
      dtSec: 0.1,
      elapsedSec: 0.1,
      sessionId: 6,
      track: layout
    });

    expect(
      rule.update({
        car: makeCarStateAtZone(segment, zone, -0.2, 1),
        dtSec: 0.1,
        elapsedSec: 0.2,
        sessionId: 6,
        track: layout
      })
    ).toEqual([
      expect.objectContaining({
        outcome: 'pass',
        sessionId: 6
      })
    ]);
  });

  it('does not emit a later pass after the same zone already violated', () => {
    const rule = new StopLineRule({ completeStopMaxSpeedMps: 0.1 });
    const zone = getTjunctionStopLineZone();
    const segment = getSegment(zone.segmentId);

    rule.startSession(7, layout);
    rule.update({
      car: makeCarStateAtZone(segment, zone, 1, 1),
      dtSec: 0.1,
      elapsedSec: 0.1,
      sessionId: 7,
      track: layout
    });
    expect(
      rule.update({
        car: makeCarStateAtZone(segment, zone, -0.2, 1),
        dtSec: 0.1,
        elapsedSec: 0.2,
        sessionId: 7,
        track: layout
      })
    ).toHaveLength(1);

    rule.update({
      car: makeCarStateAtZone(segment, zone, 3, -1),
      dtSec: 0.1,
      elapsedSec: 0.3,
      sessionId: 7,
      track: layout
    });
    rule.update({
      car: makeCarStateAtZone(segment, zone, 1, 0),
      dtSec: 0.1,
      elapsedSec: 0.4,
      sessionId: 7,
      track: layout
    });

    expect(
      rule.update({
        car: makeCarStateAtZone(segment, zone, -0.2, 1),
        dtSec: 0.1,
        elapsedSec: 0.5,
        sessionId: 7,
        track: layout
      })
    ).toEqual([]);
    expect(rule.getDiagnostics()).toEqual(
      expect.objectContaining({
        pendingZoneCount: 0,
        violationZoneCount: 1
      })
    );
  });

  function getTjunctionStopLineZone(): TrackStopLineRuleZone {
    const zone = layout.stopLineRuleZones.find(
      (candidate) => candidate.junctionId === 't-junction'
    );

    if (!zone) {
      throw new Error('Expected T-junction stop-line rule zone.');
    }

    return zone;
  }

  function getSegment(segmentId: string): TrackSegment {
    const segment = layout.segments.find(
      (candidate) => candidate.id === segmentId
    );

    if (!segment) {
      throw new Error(`Expected test track segment ${segmentId}.`);
    }

    return segment;
  }
});

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

import { RULE_CONFIG } from '../config/constants';
import type { CarState } from '../types';
import type {
  FixedTestTrackLayout,
  TrackPoint,
  TrackSegment,
  TrackStopLineRuleZone
} from '../world/testTrackLayout';
import type {
  RuleDiagnosticsContext,
  RuleEndContext,
  RuleUpdateContext
} from './KeepLeftRule';
import type { ScoredEvent } from './scoring';

interface StopLineRuleConfig {
  readonly completeStopMaxSpeedMps: number;
}

export interface StopLineRuleDiagnostics {
  readonly ruleId: 'stop-line';
  readonly activeZoneCount: number;
  readonly completeStopMaxSpeedMps: number;
  readonly passedZoneCount: number;
  readonly pendingZoneCount: number;
  readonly violationZoneCount: number;
}

interface StopLineZoneState {
  emittedOutcome: ScoredEvent['outcome'] | undefined;
  lastSignedApproachDistanceM: number | undefined;
  stoppedBeforeLine: boolean;
}

interface StopLineZoneEvaluation {
  readonly lateralWithinZone: boolean;
  readonly signedApproachDistanceM: number;
}

export class StopLineRule {
  readonly id = 'stop-line' as const;

  private readonly config: StopLineRuleConfig;
  private diagnostics: StopLineRuleDiagnostics;
  private zoneStates = new Map<string, StopLineZoneState>();

  constructor(config: Partial<StopLineRuleConfig> = {}) {
    this.config = {
      completeStopMaxSpeedMps: RULE_CONFIG.stopLineCompleteStopMaxSpeedMps,
      ...config
    };
    this.diagnostics = this.createDiagnostics(0);
  }

  /** Resets per-session stop-line state for all configured rule zones. */
  startSession(_sessionId: number, track: FixedTestTrackLayout): void {
    this.zoneStates = new Map(
      track.stopLineRuleZones.map((zone) => [
        zone.id,
        {
          emittedOutcome: undefined,
          lastSignedApproachDistanceM: undefined,
          stoppedBeforeLine: false
        }
      ])
    );
    this.recordDiagnostics(track);
  }

  /** Returns current stop-line scoring progress for browser smoke checks. */
  getDiagnostics(): StopLineRuleDiagnostics {
    return { ...this.diagnostics };
  }

  /** Refreshes read-only diagnostics without scoring new crossings. */
  syncDiagnostics(context: RuleDiagnosticsContext): void {
    this.ensureZoneStates(context.track);
    this.recordDiagnostics(context.track);
  }

  /** Scores a pass or violation when the car crosses a configured stop line. */
  update(context: RuleUpdateContext): ScoredEvent[] {
    this.ensureZoneStates(context.track);
    const events: ScoredEvent[] = [];

    for (const zone of context.track.stopLineRuleZones) {
      const state = this.getZoneState(zone);

      if (state.emittedOutcome) {
        continue;
      }

      const evaluation = evaluateZone(context.track, zone, context.car);
      const previousDistanceM = state.lastSignedApproachDistanceM;

      if (
        evaluation.lateralWithinZone &&
        evaluation.signedApproachDistanceM >= 0 &&
        evaluation.signedApproachDistanceM <= zone.approachDepthM &&
        Math.abs(context.car.speedMps) <= this.config.completeStopMaxSpeedMps
      ) {
        state.stoppedBeforeLine = true;
      }

      const crossedFromApproach =
        evaluation.lateralWithinZone &&
        previousDistanceM !== undefined &&
        previousDistanceM > 0 &&
        evaluation.signedApproachDistanceM <= 0;

      state.lastSignedApproachDistanceM =
        evaluation.signedApproachDistanceM;

      if (!crossedFromApproach) {
        continue;
      }

      const outcome = state.stoppedBeforeLine ? 'pass' : 'violation';
      state.emittedOutcome = outcome;
      events.push(
        this.createEvent(
          context.sessionId,
          zone,
          outcome,
          context.elapsedSec
        )
      );
    }

    this.recordDiagnostics(context.track);
    return events;
  }

  endSession(_context: RuleEndContext): ScoredEvent[] {
    return [];
  }

  private createEvent(
    sessionId: number,
    zone: TrackStopLineRuleZone,
    outcome: ScoredEvent['outcome'],
    occurredAtSec: number
  ): ScoredEvent {
    return {
      id: `${sessionId}:${this.id}:${zone.id}:${outcome}`,
      sessionId,
      ruleId: this.id,
      outcome,
      message:
        outcome === 'pass'
          ? 'Stopped before the side-road stop line'
          : 'Stop line violation',
      occurredAtSec
    };
  }

  private createDiagnostics(activeZoneCount: number): StopLineRuleDiagnostics {
    return {
      ruleId: this.id,
      activeZoneCount,
      completeStopMaxSpeedMps: this.config.completeStopMaxSpeedMps,
      passedZoneCount: 0,
      pendingZoneCount: activeZoneCount,
      violationZoneCount: 0
    };
  }

  private ensureZoneStates(track: FixedTestTrackLayout): void {
    if (this.zoneStates.size === track.stopLineRuleZones.length) {
      return;
    }

    for (const zone of track.stopLineRuleZones) {
      if (!this.zoneStates.has(zone.id)) {
        this.zoneStates.set(zone.id, {
          emittedOutcome: undefined,
          lastSignedApproachDistanceM: undefined,
          stoppedBeforeLine: false
        });
      }
    }
  }

  private getZoneState(zone: TrackStopLineRuleZone): StopLineZoneState {
    const state = this.zoneStates.get(zone.id);

    if (!state) {
      throw new Error(`Missing stop-line rule state for zone ${zone.id}.`);
    }

    return state;
  }

  private recordDiagnostics(track: FixedTestTrackLayout): void {
    let passedZoneCount = 0;
    let violationZoneCount = 0;

    for (const state of this.zoneStates.values()) {
      if (state.emittedOutcome === 'pass') {
        passedZoneCount += 1;
      } else if (state.emittedOutcome === 'violation') {
        violationZoneCount += 1;
      }
    }

    const activeZoneCount = track.stopLineRuleZones.length;

    this.diagnostics = {
      ruleId: this.id,
      activeZoneCount,
      completeStopMaxSpeedMps: this.config.completeStopMaxSpeedMps,
      passedZoneCount,
      pendingZoneCount: activeZoneCount - passedZoneCount - violationZoneCount,
      violationZoneCount
    };
  }
}

function evaluateZone(
  track: FixedTestTrackLayout,
  zone: TrackStopLineRuleZone,
  car: CarState
): StopLineZoneEvaluation {
  const segment = findSegment(track, zone.segmentId);
  const localPosition = getSegmentLocalPosition(segment, {
    xM: car.position.x,
    zM: car.position.z
  });

  return {
    lateralWithinZone: Math.abs(localPosition.localXM) <= zone.widthM / 2,
    signedApproachDistanceM:
      (localPosition.localZM - zone.stopLineLocalZM) *
      (zone.crossingDirection === -1 ? 1 : -1)
  };
}

function findSegment(
  track: FixedTestTrackLayout,
  segmentId: string
): TrackSegment {
  const segment = track.segments.find((candidate) => candidate.id === segmentId);

  if (!segment) {
    throw new Error(`Missing stop-line rule segment: ${segmentId}`);
  }

  return segment;
}

function getSegmentLocalPosition(
  segment: TrackSegment,
  point: TrackPoint
): { localXM: number; localZM: number } {
  const deltaXM = point.xM - segment.center.xM;
  const deltaZM = point.zM - segment.center.zM;

  return {
    localXM:
      deltaXM * Math.cos(segment.headingRad) -
      deltaZM * Math.sin(segment.headingRad),
    localZM:
      deltaXM * Math.sin(segment.headingRad) +
      deltaZM * Math.cos(segment.headingRad)
  };
}

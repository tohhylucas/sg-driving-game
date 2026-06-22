import { CAR_CONFIG, RULE_CONFIG } from '../config/constants';
import type { CarState } from '../types';
import type {
  FixedTestTrackLayout,
  TrackSegment,
  TrackSideHazard,
  TrackSideHazardFootprint,
  TrackSideHazardTriggerZone
} from '../world/testTrackLayout';
import type {
  RuleDiagnosticsContext,
  RuleEndContext,
  RuleUpdateContext
} from './KeepLeftRule';
import type { ScoredEvent } from './scoring';

interface SideHazardRuleConfig {
  readonly collisionPaddingM: number;
}

interface SideHazardState {
  emittedOutcome: ScoredEvent['outcome'] | undefined;
  triggered: boolean;
}

export interface SideHazardRuleDiagnostics {
  readonly ruleId: 'side-hazard';
  readonly activeHazardCount: number;
  readonly pendingHazardCount: number;
  readonly passedHazardCount: number;
  readonly triggeredHazardCount: number;
  readonly violationHazardCount: number;
}

export class SideHazardRule {
  readonly id = 'side-hazard' as const;

  private readonly config: SideHazardRuleConfig;
  private diagnostics: SideHazardRuleDiagnostics = this.createDiagnostics(0);
  private hazardStates = new Map<string, SideHazardState>();

  constructor(config: Partial<SideHazardRuleConfig> = {}) {
    this.config = {
      collisionPaddingM: RULE_CONFIG.sideHazardCollisionPaddingM,
      ...config
    };
  }

  /** Resets per-session side-hazard scoring state for fixed hazards. */
  startSession(_sessionId: number, track: FixedTestTrackLayout): void {
    this.hazardStates = new Map(
      track.sideHazards.map((hazard) => [
        hazard.id,
        {
          emittedOutcome: undefined,
          triggered: false
        }
      ])
    );
    this.recordDiagnostics(track);
  }

  /** Returns current side-hazard scoring progress for browser smoke checks. */
  getDiagnostics(): SideHazardRuleDiagnostics {
    return { ...this.diagnostics };
  }

  /** Scores a violation when the car physically overlaps a visible hazard. */
  update(context: RuleUpdateContext): ScoredEvent[] {
    this.ensureHazardStates(context.track);
    const events: ScoredEvent[] = [];

    for (const hazard of context.track.sideHazards) {
      const state = this.getHazardState(hazard);

      if (state.emittedOutcome || !hazard.visible) {
        continue;
      }

      if (
        isCarCollidingWithSideHazard(
          context.track,
          hazard,
          context.car,
          this.config.collisionPaddingM
        )
      ) {
        state.emittedOutcome = 'violation';
        events.push(
          this.createEvent(
            context.sessionId,
            hazard,
            'violation',
            'IMMEDIATE FAILURE: Side hazard collision',
            context.elapsedSec
          )
        );
        continue;
      }

      if (isCarInsideSideHazardTriggerZone(context.track, hazard, context.car)) {
        state.triggered = true;
      }

      if (
        !state.triggered ||
        !hasCarClearedSideHazard(context.track, hazard, context.car)
      ) {
        continue;
      }

      state.emittedOutcome = 'pass';
      events.push(
        this.createEvent(
          context.sessionId,
          hazard,
          'pass',
          'Safely cleared side hazard',
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

  syncDiagnostics(context: RuleDiagnosticsContext): void {
    this.ensureHazardStates(context.track);
    this.recordDiagnostics(context.track);
  }

  private createEvent(
    sessionId: number,
    hazard: TrackSideHazard,
    outcome: ScoredEvent['outcome'],
    message: string,
    occurredAtSec: number
  ): ScoredEvent {
    return {
      id: `${sessionId}:${this.id}:${hazard.id}:${outcome}`,
      sessionId,
      ruleId: this.id,
      outcome,
      message,
      occurredAtSec
    };
  }

  private ensureHazardStates(track: FixedTestTrackLayout): void {
    if (this.hazardStates.size === track.sideHazards.length) {
      return;
    }

    for (const hazard of track.sideHazards) {
      if (!this.hazardStates.has(hazard.id)) {
        this.hazardStates.set(hazard.id, {
          emittedOutcome: undefined,
          triggered: false
        });
      }
    }
  }

  private createDiagnostics(activeHazardCount: number): SideHazardRuleDiagnostics {
    return {
      ruleId: this.id,
      activeHazardCount,
      pendingHazardCount: activeHazardCount,
      passedHazardCount: 0,
      triggeredHazardCount: 0,
      violationHazardCount: 0
    };
  }

  private recordDiagnostics(track: FixedTestTrackLayout): void {
    let passedHazardCount = 0;
    let triggeredHazardCount = 0;
    let violationHazardCount = 0;

    for (const state of this.hazardStates.values()) {
      if (state.emittedOutcome === 'pass') {
        passedHazardCount += 1;
      } else if (state.emittedOutcome === 'violation') {
        violationHazardCount += 1;
      } else if (state.triggered) {
        triggeredHazardCount += 1;
      }
    }

    const activeHazardCount = track.sideHazards.length;

    this.diagnostics = {
      ruleId: this.id,
      activeHazardCount,
      pendingHazardCount:
        activeHazardCount -
        passedHazardCount -
        triggeredHazardCount -
        violationHazardCount,
      passedHazardCount,
      triggeredHazardCount,
      violationHazardCount
    };
  }

  private getHazardState(hazard: TrackSideHazard): SideHazardState {
    const state = this.hazardStates.get(hazard.id);

    if (!state) {
      throw new Error(`Missing side-hazard rule state for hazard ${hazard.id}.`);
    }

    return state;
  }
}

export function isCarInsideSideHazardTriggerZone(
  track: FixedTestTrackLayout,
  hazard: TrackSideHazard,
  car: CarState
): boolean {
  const segment = findSegment(track, hazard.segmentId);
  const localPosition = getSegmentLocalPosition(segment, {
    xM: car.position.x,
    zM: car.position.z
  });

  return isInsideLocalFootprint(localPosition, hazard.triggerZone);
}

export function isCarCollidingWithSideHazard(
  track: FixedTestTrackLayout,
  hazard: TrackSideHazard,
  car: CarState,
  collisionPaddingM: number = RULE_CONFIG.sideHazardCollisionPaddingM
): boolean {
  const segment = findSegment(track, hazard.segmentId);
  const localPosition = getSegmentLocalPosition(segment, {
    xM: car.position.x,
    zM: car.position.z
  });
  const expandedFootprint: TrackSideHazardFootprint = {
    centerLocalXM: hazard.collisionBox.centerLocalXM,
    centerLocalZM: hazard.collisionBox.centerLocalZM,
    lengthM:
      hazard.collisionBox.lengthM +
      CAR_CONFIG.lengthM +
      collisionPaddingM * 2,
    widthM:
      hazard.collisionBox.widthM + CAR_CONFIG.widthM + collisionPaddingM * 2
  };

  return isInsideLocalFootprint(localPosition, expandedFootprint);
}

function hasCarClearedSideHazard(
  track: FixedTestTrackLayout,
  hazard: TrackSideHazard,
  car: CarState
): boolean {
  const segment = findSegment(track, hazard.segmentId);
  const localPosition = getSegmentLocalPosition(segment, {
    xM: car.position.x,
    zM: car.position.z
  });

  return hazard.clearanceDirection === -1
    ? localPosition.localZM <= hazard.clearanceLocalZM
    : localPosition.localZM >= hazard.clearanceLocalZM;
}

function isInsideLocalFootprint(
  localPosition: { localXM: number; localZM: number },
  footprint: TrackSideHazardFootprint | TrackSideHazardTriggerZone
): boolean {
  return (
    Math.abs(localPosition.localXM - footprint.centerLocalXM) <=
      footprint.widthM / 2 &&
    Math.abs(localPosition.localZM - footprint.centerLocalZM) <=
      footprint.lengthM / 2
  );
}

function findSegment(
  track: FixedTestTrackLayout,
  segmentId: string
): TrackSegment {
  const segment = track.segments.find((candidate) => candidate.id === segmentId);

  if (!segment) {
    throw new Error(`Missing side-hazard segment: ${segmentId}`);
  }

  return segment;
}

function getSegmentLocalPosition(
  segment: TrackSegment,
  point: { xM: number; zM: number }
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

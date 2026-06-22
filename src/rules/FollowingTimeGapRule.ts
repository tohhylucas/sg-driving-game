import { CAR_CONFIG, RULE_CONFIG } from '../config/constants';
import type { CarState, MovingElementState } from '../types';
import type { FixedTestTrackLayout } from '../world/testTrackLayout';
import type {
  RuleDiagnosticsContext,
  RuleEndContext,
  RuleUpdateContext
} from './KeepLeftRule';
import { getNearestLanePosition, type TrackLanePosition } from './laneRules';
import type { ScoredEvent } from './scoring';

export interface ForwardMovingElementSelection {
  readonly element: MovingElementState;
  readonly carLanePosition: TrackLanePosition;
  readonly elementLanePosition: TrackLanePosition;
  readonly forwardDistanceM: number;
}

interface FollowingTimeGapRuleConfig {
  readonly detectionRangeM: number;
  readonly minimumEncounterDurationSec: number;
  readonly recoveryHysteresisSec: number;
  readonly safeTimeGapSec: number;
  readonly unsafeGracePeriodSec: number;
}

interface FollowingEncounter {
  readonly elementId: string;
  readonly sequence: number;
  durationSec: number;
  emittedViolation: boolean;
  unsafe: boolean;
  unsafeDurationSec: number;
}

export interface FollowingTimeGapRuleDiagnostics {
  readonly ruleId: 'following-time-gap';
  readonly activeEncounterDurationSec: number;
  readonly activeEncounterElementId: string | undefined;
  readonly detectionRangeM: number;
  readonly lastTimeGapSec: number | undefined;
  readonly minimumEncounterDurationSec: number;
  readonly passEncounterCount: number;
  readonly recoveryHysteresisSec: number;
  readonly safeTimeGapSec: number;
  readonly unsafeDurationSec: number;
  readonly unsafeGracePeriodSec: number;
  readonly violationEncounterCount: number;
}

const STOPPED_TIME_GAP_SPEED_MPS = 0.1;

export class FollowingTimeGapRule {
  readonly id = 'following-time-gap' as const;

  private readonly config: FollowingTimeGapRuleConfig;
  private currentEncounter: FollowingEncounter | undefined;
  private diagnostics: FollowingTimeGapRuleDiagnostics;
  private encounterSequence = 0;
  private lastTimeGapSec: number | undefined;
  private passEncounterCount = 0;
  private violationEncounterCount = 0;

  constructor(config: Partial<FollowingTimeGapRuleConfig> = {}) {
    this.config = {
      detectionRangeM: RULE_CONFIG.followingForwardDetectionRangeM,
      minimumEncounterDurationSec:
        RULE_CONFIG.followingMinimumEncounterDurationSec,
      recoveryHysteresisSec: RULE_CONFIG.followingRecoveryHysteresisSec,
      safeTimeGapSec: RULE_CONFIG.followingSafeTimeGapSec,
      unsafeGracePeriodSec: RULE_CONFIG.followingUnsafeGracePeriodSec,
      ...config
    };
    this.diagnostics = this.createDiagnostics();
  }

  /** Resets encounter state for a new always-active following rule session. */
  startSession(_sessionId: number, _track: FixedTestTrackLayout): void {
    this.currentEncounter = undefined;
    this.encounterSequence = 0;
    this.lastTimeGapSec = undefined;
    this.passEncounterCount = 0;
    this.violationEncounterCount = 0;
    this.diagnostics = this.createDiagnostics();
  }

  /** Returns current following-rule state for browser smoke checks. */
  getDiagnostics(): FollowingTimeGapRuleDiagnostics {
    return { ...this.diagnostics };
  }

  /** Refreshes read-only diagnostics without advancing encounter timers. */
  syncDiagnostics(_context: RuleDiagnosticsContext): void {
    this.diagnostics = this.createDiagnostics();
  }

  /** Scores encounter-based following gap pass and violation events. */
  update(context: RuleUpdateContext): ScoredEvent[] {
    const selection = this.selectRelevantElement(context);
    const events: ScoredEvent[] = [];

    if (
      this.currentEncounter &&
      (!selection || selection.element.id !== this.currentEncounter.elementId)
    ) {
      this.currentEncounter.durationSec += context.dtSec;
      events.push(
        ...this.completeEncounter(context.sessionId, context.elapsedSec)
      );
    }

    if (!this.currentEncounter && selection) {
      this.currentEncounter = this.startEncounter(selection.element.id);
    }

    if (!this.currentEncounter || !selection) {
      this.lastTimeGapSec = undefined;
      this.diagnostics = this.createDiagnostics();
      return events;
    }

    this.currentEncounter.durationSec += context.dtSec;
    this.lastTimeGapSec = computeFollowingTimeGapSec(
      context.car,
      selection.forwardDistanceM,
      selection.element
    );
    this.updateUnsafeState(this.currentEncounter, this.lastTimeGapSec);

    if (this.currentEncounter.unsafe) {
      this.currentEncounter.unsafeDurationSec += context.dtSec;
    } else {
      this.currentEncounter.unsafeDurationSec = 0;
    }

    if (
      this.currentEncounter.unsafeDurationSec >=
        this.config.unsafeGracePeriodSec &&
      !this.currentEncounter.emittedViolation
    ) {
      this.currentEncounter.emittedViolation = true;
      this.violationEncounterCount += 1;
      events.push(
        this.createEvent(
          context.sessionId,
          this.currentEncounter,
          'violation',
          'Following time-gap violation',
          context.elapsedSec
        )
      );
    }

    this.diagnostics = this.createDiagnostics();
    return events;
  }

  endSession(context: RuleEndContext): ScoredEvent[] {
    return this.completeEncounter(context.sessionId, context.elapsedSec);
  }

  private selectRelevantElement(
    context: RuleUpdateContext
  ): ForwardMovingElementSelection | undefined {
    const selection = selectNearestForwardMovingElement(
      context.track,
      context.car,
      context.movingElements ?? []
    );

    if (!selection || selection.forwardDistanceM > this.config.detectionRangeM) {
      return undefined;
    }

    return selection;
  }

  private startEncounter(elementId: string): FollowingEncounter {
    this.encounterSequence += 1;

    return {
      elementId,
      sequence: this.encounterSequence,
      durationSec: 0,
      emittedViolation: false,
      unsafe: false,
      unsafeDurationSec: 0
    };
  }

  private updateUnsafeState(
    encounter: FollowingEncounter,
    timeGapSec: number
  ): void {
    if (encounter.unsafe) {
      encounter.unsafe =
        timeGapSec < this.config.safeTimeGapSec + this.config.recoveryHysteresisSec;
      return;
    }

    encounter.unsafe = timeGapSec < this.config.safeTimeGapSec;
  }

  private completeEncounter(
    sessionId: number,
    elapsedSec: number
  ): ScoredEvent[] {
    const encounter = this.currentEncounter;

    if (!encounter) {
      this.diagnostics = this.createDiagnostics();
      return [];
    }

    this.currentEncounter = undefined;
    this.lastTimeGapSec = undefined;

    if (
      encounter.emittedViolation ||
      encounter.unsafe ||
      encounter.durationSec < this.config.minimumEncounterDurationSec
    ) {
      this.diagnostics = this.createDiagnostics();
      return [];
    }

    this.passEncounterCount += 1;
    this.diagnostics = this.createDiagnostics();
    return [
      this.createEvent(
        sessionId,
        encounter,
        'pass',
        'Safe following gap maintained',
        elapsedSec
      )
    ];
  }

  private createEvent(
    sessionId: number,
    encounter: FollowingEncounter,
    outcome: ScoredEvent['outcome'],
    message: string,
    occurredAtSec: number
  ): ScoredEvent {
    return {
      id: `${sessionId}:${this.id}:${encounter.elementId}:${encounter.sequence}:${outcome}`,
      sessionId,
      ruleId: this.id,
      outcome,
      message,
      occurredAtSec
    };
  }

  private createDiagnostics(): FollowingTimeGapRuleDiagnostics {
    return {
      ruleId: this.id,
      activeEncounterDurationSec: this.currentEncounter?.durationSec ?? 0,
      activeEncounterElementId: this.currentEncounter?.elementId,
      detectionRangeM: this.config.detectionRangeM,
      lastTimeGapSec: this.lastTimeGapSec,
      minimumEncounterDurationSec: this.config.minimumEncounterDurationSec,
      passEncounterCount: this.passEncounterCount,
      recoveryHysteresisSec: this.config.recoveryHysteresisSec,
      safeTimeGapSec: this.config.safeTimeGapSec,
      unsafeDurationSec: this.currentEncounter?.unsafeDurationSec ?? 0,
      unsafeGracePeriodSec: this.config.unsafeGracePeriodSec,
      violationEncounterCount: this.violationEncounterCount
    };
  }
}

export function computeFollowingTimeGapSec(
  car: CarState,
  forwardDistanceM: number,
  element: MovingElementState
): number {
  if (car.speedMps <= STOPPED_TIME_GAP_SPEED_MPS) {
    return Number.POSITIVE_INFINITY;
  }

  const clearanceM = Math.max(
    0,
    forwardDistanceM - CAR_CONFIG.lengthM / 2 - element.lengthM / 2
  );

  return clearanceM / car.speedMps;
}

/** Selects the nearest tracked moving element ahead in the player's current lane. */
export function selectNearestForwardMovingElement(
  track: FixedTestTrackLayout,
  car: CarState,
  movingElements: readonly MovingElementState[]
): ForwardMovingElementSelection | undefined {
  const carLanePosition = getNearestLanePosition(track, {
    xM: car.position.x,
    zM: car.position.z
  });
  let nearest: ForwardMovingElementSelection | undefined;

  for (const element of movingElements) {
    const elementLanePosition = getNearestLanePosition(track, {
      xM: element.position.x,
      zM: element.position.z
    });

    if (
      elementLanePosition.segmentId !== carLanePosition.segmentId ||
      elementLanePosition.side !== carLanePosition.side
    ) {
      continue;
    }

    const forwardDistanceM =
      carLanePosition.localZM - elementLanePosition.localZM;

    if (forwardDistanceM <= 0) {
      continue;
    }

    if (!nearest || forwardDistanceM < nearest.forwardDistanceM) {
      nearest = {
        element,
        carLanePosition,
        elementLanePosition,
        forwardDistanceM
      };
    }
  }

  return nearest;
}

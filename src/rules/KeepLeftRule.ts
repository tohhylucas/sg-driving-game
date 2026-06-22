import { RULE_CONFIG } from '../config/constants';
import type { CarState } from '../types';
import type { FixedTestTrackLayout } from '../world/testTrackLayout';
import {
  getNearestLanePosition,
  isWithinDefaultDrivingLane,
  type LaneSide,
  type TrackLanePosition
} from './laneRules';
import type { ScoredEvent } from './scoring';

export type SessionEndReason = 'finish' | 'reset';

export interface RuleUpdateContext {
  readonly car: CarState;
  readonly dtSec: number;
  readonly elapsedSec: number;
  readonly sessionId: number;
  readonly track: FixedTestTrackLayout;
}

export interface RuleEndContext {
  readonly car: CarState;
  readonly elapsedSec: number;
  readonly reason: SessionEndReason;
  readonly sessionId: number;
  readonly track: FixedTestTrackLayout;
}

export interface RuleDiagnosticsContext {
  readonly car: CarState;
  readonly elapsedSec: number;
  readonly sessionId: number;
  readonly track: FixedTestTrackLayout;
}

interface KeepLeftRuleConfig {
  gracePeriodSec: number;
}

export interface KeepLeftRuleDiagnostics {
  readonly ruleId: 'keep-left';
  readonly gracePeriodSec: number;
  readonly laneSide: LaneSide;
  readonly segmentId: string;
  readonly outsideLaneSec: number;
  readonly withinDefaultLane: boolean;
}

export class KeepLeftRule {
  readonly id = 'keep-left' as const;

  private readonly config: KeepLeftRuleConfig;
  private currentWrongLaneSegmentId: string | undefined;
  private diagnostics: KeepLeftRuleDiagnostics;
  private hasAnyViolation = false;
  private hasPass = false;
  private outsideLaneSec = 0;
  private violationCount = 0;
  private violationEmittedForEpisode = false;

  constructor(config: Partial<KeepLeftRuleConfig> = {}) {
    this.config = {
      gracePeriodSec: RULE_CONFIG.keepLeftGracePeriodSec,
      ...config
    };
    this.diagnostics = this.createDefaultDiagnostics();
  }

  /** Resets per-session keep-left state. */
  startSession(_sessionId: number): void {
    this.currentWrongLaneSegmentId = undefined;
    this.hasAnyViolation = false;
    this.hasPass = false;
    this.outsideLaneSec = 0;
    this.violationCount = 0;
    this.violationEmittedForEpisode = false;
    this.diagnostics = this.createDefaultDiagnostics();
  }

  /** Returns the current keep-left debug state for HUD diagnostics. */
  getDiagnostics(): KeepLeftRuleDiagnostics {
    return { ...this.diagnostics };
  }

  /** Refreshes read-only diagnostics without advancing scoring timers. */
  syncDiagnostics(context: RuleDiagnosticsContext): void {
    const lanePosition = this.getLanePosition(context);
    const withinDefaultLane = isWithinDefaultDrivingLane(
      lanePosition,
      context.track
    );

    this.recordDiagnostics(lanePosition, withinDefaultLane, 0);
  }

  /** Observes lane position and emits a violation after the grace period. */
  update(context: RuleUpdateContext): ScoredEvent[] {
    const lanePosition = this.getLanePosition(context);
    const withinDefaultLane = isWithinDefaultDrivingLane(
      lanePosition,
      context.track
    );

    if (withinDefaultLane) {
      this.currentWrongLaneSegmentId = undefined;
      this.outsideLaneSec = 0;
      this.violationEmittedForEpisode = false;
      this.recordDiagnostics(
        lanePosition,
        withinDefaultLane,
        this.outsideLaneSec
      );
      return [];
    }

    if (this.currentWrongLaneSegmentId !== lanePosition.segmentId) {
      this.currentWrongLaneSegmentId = lanePosition.segmentId;
      this.outsideLaneSec = 0;
      this.violationEmittedForEpisode = false;
    }

    this.outsideLaneSec += context.dtSec;
    this.recordDiagnostics(
      lanePosition,
      withinDefaultLane,
      this.outsideLaneSec
    );

    if (
      this.violationEmittedForEpisode ||
      this.outsideLaneSec < this.config.gracePeriodSec
    ) {
      return [];
    }

    this.hasAnyViolation = true;
    this.violationCount += 1;
    this.violationEmittedForEpisode = true;
    return [
      this.createEvent(
        context.sessionId,
        'violation',
        'Keep left violation',
        context.elapsedSec,
        this.violationCount
      )
    ];
  }

  /** Emits a clean pass only when the route finishes without violation. */
  endSession(context: RuleEndContext): ScoredEvent[] {
    if (context.reason !== 'finish' || this.hasAnyViolation || this.hasPass) {
      return [];
    }

    this.hasPass = true;
    return [
      this.createEvent(
        context.sessionId,
        'pass',
        'Kept left for the completed route',
        context.elapsedSec
      )
    ];
  }

  private createEvent(
    sessionId: number,
    outcome: ScoredEvent['outcome'],
    message: string,
    occurredAtSec: number,
    sequence?: number
  ): ScoredEvent {
    return {
      id: `${sessionId}:${this.id}:${outcome}${
        sequence === undefined ? '' : `:${sequence}`
      }`,
      sessionId,
      ruleId: this.id,
      outcome,
      message,
      occurredAtSec
    };
  }

  private createDefaultDiagnostics(): KeepLeftRuleDiagnostics {
    return {
      ruleId: this.id,
      gracePeriodSec: this.config.gracePeriodSec,
      laneSide: 'left',
      segmentId: '',
      outsideLaneSec: 0,
      withinDefaultLane: true
    };
  }

  private recordDiagnostics(
    lanePosition: TrackLanePosition,
    withinDefaultLane: boolean,
    outsideLaneSec: number
  ): void {
    this.diagnostics = {
      ruleId: this.id,
      gracePeriodSec: this.config.gracePeriodSec,
      laneSide: lanePosition.side,
      segmentId: lanePosition.segmentId,
      outsideLaneSec,
      withinDefaultLane
    };
  }

  private getLanePosition(
    context: Pick<RuleUpdateContext, 'car' | 'track'>
  ): TrackLanePosition {
    return getNearestLanePosition(context.track, {
      xM: context.car.position.x,
      zM: context.car.position.z
    });
  }
}

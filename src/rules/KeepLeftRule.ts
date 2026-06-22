import { RULE_CONFIG } from '../config/constants';
import type { CarState } from '../types';
import type { FixedTestTrackLayout } from '../world/testTrackLayout';
import {
  getNearestLanePosition,
  isWithinDefaultDrivingLane
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

interface KeepLeftRuleConfig {
  gracePeriodSec: number;
}

export class KeepLeftRule {
  readonly id = 'keep-left';

  private readonly config: KeepLeftRuleConfig;
  private hasViolation = false;
  private hasPass = false;
  private outsideLaneSec = 0;

  constructor(config: Partial<KeepLeftRuleConfig> = {}) {
    this.config = {
      gracePeriodSec: RULE_CONFIG.keepLeftGracePeriodSec,
      ...config
    };
  }

  /** Resets per-session keep-left state. */
  startSession(_sessionId: number): void {
    this.hasViolation = false;
    this.hasPass = false;
    this.outsideLaneSec = 0;
  }

  /** Observes lane position and emits a violation after the grace period. */
  update(context: RuleUpdateContext): ScoredEvent[] {
    const lanePosition = getNearestLanePosition(context.track, {
      xM: context.car.position.x,
      zM: context.car.position.z
    });

    if (isWithinDefaultDrivingLane(lanePosition, context.track)) {
      this.outsideLaneSec = 0;
      return [];
    }

    this.outsideLaneSec += context.dtSec;

    if (
      this.hasViolation ||
      this.outsideLaneSec < this.config.gracePeriodSec
    ) {
      return [];
    }

    this.hasViolation = true;
    return [
      this.createEvent(
        context.sessionId,
        'violation',
        'Keep left violation',
        context.elapsedSec
      )
    ];
  }

  /** Emits a clean pass only when the route finishes without violation. */
  endSession(context: RuleEndContext): ScoredEvent[] {
    if (context.reason !== 'finish' || this.hasViolation || this.hasPass) {
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
    occurredAtSec: number
  ): ScoredEvent {
    return {
      id: `${sessionId}:${this.id}:${outcome}`,
      sessionId,
      ruleId: this.id,
      outcome,
      message,
      occurredAtSec
    };
  }
}

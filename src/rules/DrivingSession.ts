import type { CarState } from '../types';
import type { FixedTestTrackLayout } from '../world/testTrackLayout';
import { isInsideFinishZone } from './finishZone';
import type {
  KeepLeftRuleDiagnostics,
  RuleEndContext,
  RuleUpdateContext,
  SessionEndReason
} from './KeepLeftRule';
import type { ScoredEvent, ScoredEventSummary } from './scoring';
import { summarizeScoredEvents } from './scoring';

export interface SessionRule {
  readonly id: string;
  startSession(sessionId: number): void;
  update(context: RuleUpdateContext): ScoredEvent[];
  endSession(context: RuleEndContext): ScoredEvent[];
  getDiagnostics?(): SessionRuleDiagnostics;
}

export type SessionRuleDiagnostics = KeepLeftRuleDiagnostics;

export interface DrivingSessionState {
  readonly active: boolean;
  readonly elapsedSec: number;
  readonly sessionId: number;
}

interface DrivingSessionOptions {
  readonly rules: readonly SessionRule[];
  readonly track: FixedTestTrackLayout;
}

export class DrivingSession {
  private readonly rules: readonly SessionRule[];
  private readonly track: FixedTestTrackLayout;
  private active = false;
  private elapsedSec = 0;
  private events: ScoredEvent[] = [];
  private sessionId = 0;

  constructor({ rules, track }: DrivingSessionOptions) {
    this.rules = rules;
    this.track = track;
  }

  get state(): DrivingSessionState {
    return {
      active: this.active,
      elapsedSec: this.elapsedSec,
      sessionId: this.sessionId
    };
  }

  get summary(): ScoredEventSummary {
    return summarizeScoredEvents(this.events);
  }

  get ruleDiagnostics(): readonly SessionRuleDiagnostics[] {
    const diagnostics: SessionRuleDiagnostics[] = [];

    for (const rule of this.rules) {
      const ruleDiagnostics = rule.getDiagnostics?.();

      if (ruleDiagnostics) {
        diagnostics.push(ruleDiagnostics);
      }
    }

    return diagnostics;
  }

  /** Starts a new scored driving session from the current car state. */
  start(_car: CarState): void {
    this.sessionId += 1;
    this.elapsedSec = 0;
    this.events = [];
    this.active = true;

    for (const rule of this.rules) {
      rule.startSession(this.sessionId);
    }
  }

  /** Advances active rules and ends the session when the finish gate is crossed. */
  update(car: CarState, dtSec: number): void {
    if (!this.active) {
      return;
    }

    this.elapsedSec += dtSec;

    for (const rule of this.rules) {
      this.events.push(
        ...rule.update({
          car,
          dtSec,
          elapsedSec: this.elapsedSec,
          sessionId: this.sessionId,
          track: this.track
        })
      );
    }

    if (
      isInsideFinishZone(
        { xM: car.position.x, zM: car.position.z },
        this.track.finishZone
      )
    ) {
      this.end('finish', car);
    }
  }

  /** Ends any active session and starts a fresh reset session. */
  reset(car: CarState): void {
    if (this.active) {
      this.end('reset', car);
    }

    this.start(car);
  }

  /** Ends the active session with the supplied reason. */
  end(reason: SessionEndReason, car: CarState): void {
    if (!this.active) {
      return;
    }

    for (const rule of this.rules) {
      this.events.push(
        ...rule.endSession({
          car,
          elapsedSec: this.elapsedSec,
          reason,
          sessionId: this.sessionId,
          track: this.track
        })
      );
    }

    this.active = false;
  }
}

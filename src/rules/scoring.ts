export type ScoredOutcome = 'pass' | 'violation';

export interface ScoredEvent {
  readonly id: string;
  readonly sessionId: number;
  readonly ruleId: string;
  readonly outcome: ScoredOutcome;
  readonly message: string;
  readonly occurredAtSec: number;
}

export interface ScoredEventSummary {
  readonly events: readonly ScoredEvent[];
  readonly passCount: number;
  readonly violationCount: number;
}

export function summarizeScoredEvents(
  events: readonly ScoredEvent[]
): ScoredEventSummary {
  return {
    events,
    passCount: events.filter((event) => event.outcome === 'pass').length,
    violationCount: events.filter((event) => event.outcome === 'violation')
      .length
  };
}

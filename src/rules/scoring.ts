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

export interface RuleOutcomeSummary {
  readonly ruleId: string;
  readonly events: readonly ScoredEvent[];
}

export interface SessionOutcomeSummary {
  readonly passes: readonly RuleOutcomeSummary[];
  readonly violations: readonly RuleOutcomeSummary[];
  readonly notEncountered: readonly string[];
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

export function summarizeSessionOutcomes(
  events: readonly ScoredEvent[],
  ruleIds: readonly string[]
): SessionOutcomeSummary {
  const orderedRuleIds = getOrderedRuleIds(ruleIds, events);

  return {
    passes: groupEventsByOutcome(events, orderedRuleIds, 'pass'),
    violations: groupEventsByOutcome(events, orderedRuleIds, 'violation'),
    notEncountered: orderedRuleIds.filter(
      (ruleId) => !events.some((event) => event.ruleId === ruleId)
    )
  };
}

function getOrderedRuleIds(
  ruleIds: readonly string[],
  events: readonly ScoredEvent[]
): string[] {
  const orderedRuleIds: string[] = [];

  for (const ruleId of ruleIds) {
    appendUniqueRuleId(orderedRuleIds, ruleId);
  }

  for (const event of events) {
    appendUniqueRuleId(orderedRuleIds, event.ruleId);
  }

  return orderedRuleIds;
}

function appendUniqueRuleId(ruleIds: string[], ruleId: string): void {
  if (!ruleIds.includes(ruleId)) {
    ruleIds.push(ruleId);
  }
}

function groupEventsByOutcome(
  events: readonly ScoredEvent[],
  ruleIds: readonly string[],
  outcome: ScoredOutcome
): RuleOutcomeSummary[] {
  return ruleIds.flatMap((ruleId) => {
    const outcomeEvents = events.filter(
      (event) => event.ruleId === ruleId && event.outcome === outcome
    );

    if (outcomeEvents.length === 0) {
      return [];
    }

    return [
      {
        ruleId,
        events: outcomeEvents
      }
    ];
  });
}

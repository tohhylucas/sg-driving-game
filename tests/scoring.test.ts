import { describe, expect, it } from 'vitest';
import {
  summarizeSessionOutcomes,
  type ScoredEvent
} from '../src/rules/scoring';

describe('summarizeSessionOutcomes', () => {
  it('groups real rule events and treats silent rules as not encountered', () => {
    const events: ScoredEvent[] = [
      makeEvent('session:keep-left:violation', 'keep-left', 'violation'),
      makeEvent('session:stop-line:pass', 'stop-line', 'pass')
    ];

    expect(
      summarizeSessionOutcomes(events, [
        'keep-left',
        'stop-line',
        'side-hazard'
      ])
    ).toEqual({
      passes: [
        {
          ruleId: 'stop-line',
          events: [events[1]]
        }
      ],
      violations: [
        {
          ruleId: 'keep-left',
          events: [events[0]]
        }
      ],
      notEncountered: ['side-hazard']
    });
  });
});

function makeEvent(
  id: string,
  ruleId: string,
  outcome: ScoredEvent['outcome']
): ScoredEvent {
  return {
    id,
    sessionId: 1,
    ruleId,
    outcome,
    message: `${ruleId} ${outcome}`,
    occurredAtSec: 1
  };
}

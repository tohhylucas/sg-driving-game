import { describe, expect, it } from 'vitest';
import { formatKeepLeftDebugText } from '../src/ui/ScoringFeedback';

describe('ScoringFeedback', () => {
  const diagnostics = {
    ruleId: 'keep-left',
    gracePeriodSec: 1.5,
    laneSide: 'right',
    segmentId: 'loop-1',
    outsideLaneSec: 0,
    withinDefaultLane: false
  } as const;

  it('shows when the session is active and the outside timer can run', () => {
    expect(formatKeepLeftDebugText(diagnostics, true)).toBe(
      'Grace 1.5s | Session active | Side right | Correct no | Outside 0.00s'
    );
  });

  it('shows a paused outside timer after the scoring session has finished', () => {
    expect(formatKeepLeftDebugText(diagnostics, false)).toBe(
      'Grace 1.5s | Session finished | Side right | Correct no | Outside paused'
    );
  });
});

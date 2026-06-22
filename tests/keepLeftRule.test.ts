import { describe, expect, it } from 'vitest';
import type { CarState } from '../src/types';
import { KeepLeftRule } from '../src/rules/KeepLeftRule';
import { getFixedTestTrackLayout } from '../src/world/testTrackLayout';

describe('KeepLeftRule', () => {
  const layout = getFixedTestTrackLayout();
  const leftLaneCar = makeCarState(-1.75);
  const rightLaneCar = makeCarState(1.75);

  it('emits one violation after the grace period outside the left lane', () => {
    const rule = new KeepLeftRule({ gracePeriodSec: 1 });

    rule.startSession(1);

    expect(
      rule.update({
        car: rightLaneCar,
        dtSec: 0.5,
        elapsedSec: 0.5,
        sessionId: 1,
        track: layout
      })
    ).toEqual([]);

    const violation = rule.update({
      car: rightLaneCar,
      dtSec: 0.6,
      elapsedSec: 1.1,
      sessionId: 1,
      track: layout
    });
    const duplicate = rule.update({
      car: rightLaneCar,
      dtSec: 2,
      elapsedSec: 3.1,
      sessionId: 1,
      track: layout
    });

    expect(violation).toEqual([
      expect.objectContaining({
        outcome: 'violation',
        ruleId: 'keep-left',
        sessionId: 1
      })
    ]);
    expect(duplicate).toEqual([]);
  });

  it('emits a pass only when a clean session finishes', () => {
    const rule = new KeepLeftRule({ gracePeriodSec: 1 });

    rule.startSession(2);
    expect(
      rule.update({
        car: leftLaneCar,
        dtSec: 2,
        elapsedSec: 2,
        sessionId: 2,
        track: layout
      })
    ).toEqual([]);

    expect(
      rule.endSession({
        car: leftLaneCar,
        elapsedSec: 3,
        reason: 'finish',
        sessionId: 2,
        track: layout
      })
    ).toEqual([
      expect.objectContaining({
        outcome: 'pass',
        ruleId: 'keep-left',
        sessionId: 2
      })
    ]);
  });
});

function makeCarState(x: number): CarState {
  return {
    position: { x, y: 0.01, z: 0 },
    headingRad: 0,
    speedMps: 0
  };
}

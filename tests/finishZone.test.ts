import { describe, expect, it } from 'vitest';
import { isInsideFinishZone } from '../src/rules/finishZone';
import { getFixedTestTrackLayout } from '../src/world/testTrackLayout';

describe('finish zone', () => {
  it('is exposed by the fixed test track layout', () => {
    const layout = getFixedTestTrackLayout();

    expect(layout.finishZone.kind).toBe('finish-zone');
    expect(layout.finishZone.widthM).toBe(layout.roadWidthM);
    expect(layout.finishZone.depthM).toBeGreaterThan(0);
  });

  it('detects when the car crosses the fixed finish gate', () => {
    const { finishZone } = getFixedTestTrackLayout();

    expect(
      isInsideFinishZone(
        { xM: finishZone.center.xM, zM: finishZone.center.zM },
        finishZone
      )
    ).toBe(true);
    expect(
      isInsideFinishZone(
        {
          xM: finishZone.center.xM,
          zM: finishZone.center.zM + finishZone.depthM
        },
        finishZone
      )
    ).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  getScriptedMovingElementState,
  getScriptedMovingElementStates
} from '../src/world/scriptedMovingElements';
import { getFixedTestTrackLayout } from '../src/world/testTrackLayout';

describe('scripted moving elements', () => {
  it('derives deterministic live state for the lead vehicle path', () => {
    const layout = getFixedTestTrackLayout();
    const leadVehicle = layout.movingElements[0];
    const first = getScriptedMovingElementState(layout, leadVehicle, 0);
    const second = getScriptedMovingElementState(layout, leadVehicle, 1);

    expect(first).toEqual(
      expect.objectContaining({
        id: leadVehicle.id,
        kind: 'lead-vehicle',
        segmentId: leadVehicle.segmentId,
        speedMps: leadVehicle.speedMps
      })
    );
    expect(second.position.z).not.toBe(first.position.z);
    expect(getScriptedMovingElementStates(layout, 0)).toHaveLength(1);
  });
});

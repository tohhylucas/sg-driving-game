import { beforeEach, describe, expect, it } from 'vitest';
import { undoLastChange } from '../src/history';
import { state } from '../src/state';
import {
  createGiveWayLineMarking,
  getPlacementRotationDeg,
  getPlacementScaleM,
  isLineMarkingSymbol
} from '../src/symbols';
import {
  commitSymbolPlacement,
  startSymbolPlacement,
  updateSymbolPlacement
} from '../src/tools';

function resetSharedEditorState(): void {
  state.nodes = [];
  state.edges = [];
  state.decals = [];
  state.paintedLines = [];
  state.edgeDraft = [];
  state.edgeDraftCurveControls = [];
  state.calibrationStart = null;
  state.lastCalibration = null;
  state.symbolPlacementPreview = null;
  state.selection = null;
  state.undoStack = [];
  state.decalType = 'arrow_straight';
  state.currentSymbolScaleM = 5;
  state.metersPerPixel = 0.5;
  state.view = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    rotationRad: 0,
    rotationCenterPx: 0,
    rotationCenterPy: 0
  };
}

describe('map editor symbols', () => {
  beforeEach(() => {
    resetSharedEditorState();
  });

  it('treats give way as linework instead of a point decal', () => {
    expect(isLineMarkingSymbol('give_way_line')).toBe(true);
    expect(isLineMarkingSymbol('arrow_straight')).toBe(false);
  });

  it('creates a give way line that can meet road line endpoints', () => {
    expect(
      createGiveWayLineMarking({
        id: 'l1',
        center: { px: 100, py: 50 },
        rotationDeg: 0,
        lengthM: 10,
        widthM: 0.15,
        metersPerPixel: 0.5
      })
    ).toEqual({
      id: 'l1',
      style: 'give_way_line',
      widthM: 0.15,
      points: [
        { px: 90, py: 50 },
        { px: 110, py: 50 }
      ]
    });
  });

  it('derives placement rotation from a click-drag direction', () => {
    expect(
      getPlacementRotationDeg({
        center: { px: 50, py: 50 },
        pointer: { px: 50, py: 20 }
      })
    ).toBe(0);
    expect(
      getPlacementRotationDeg({
        center: { px: 50, py: 50 },
        pointer: { px: 80, py: 50 }
      })
    ).toBe(90);
    expect(
      getPlacementRotationDeg({
        center: { px: 50, py: 50 },
        pointer: { px: 50, py: 80 }
      })
    ).toBe(180);
  });

  it('derives placement scale from drag distance in calibrated meters', () => {
    expect(
      getPlacementScaleM({
        center: { px: 50, py: 50 },
        pointer: { px: 50, py: 30 },
        metersPerPixel: 0.25,
        fallbackScaleM: 4
      })
    ).toBe(5);
    expect(
      getPlacementScaleM({
        center: { px: 50, py: 50 },
        pointer: { px: 50, py: 50 },
        metersPerPixel: 0.25,
        fallbackScaleM: 4
      })
    ).toBe(4);
    expect(
      getPlacementScaleM({
        center: { px: 50, py: 50 },
        pointer: { px: 51, py: 50 },
        metersPerPixel: 0.1,
        fallbackScaleM: 4
      })
    ).toBe(0.5);
    expect(
      getPlacementScaleM({
        center: { px: 50, py: 50 },
        pointer: { px: 150, py: 50 },
        metersPerPixel: 1,
        fallbackScaleM: 4
      })
    ).toBe(20);
  });

  it('undoes the first placed symbol instead of restoring its placement preview', () => {
    startSymbolPlacement(40, 50);
    updateSymbolPlacement(40, 30);
    commitSymbolPlacement();

    expect(state.decals).toHaveLength(1);
    expect(state.symbolPlacementPreview).toBeNull();

    expect(undoLastChange(state)).toBe(true);
    expect(state.decals).toHaveLength(0);
    expect(state.symbolPlacementPreview).toBeNull();
    expect(state.selection).toBeNull();
  });

  it('undoes the first placed line marking symbol', () => {
    state.decalType = 'give_way_line';

    startSymbolPlacement(40, 50);
    updateSymbolPlacement(80, 50);
    commitSymbolPlacement();

    expect(state.paintedLines).toHaveLength(1);
    expect(state.symbolPlacementPreview).toBeNull();

    expect(undoLastChange(state)).toBe(true);
    expect(state.paintedLines).toHaveLength(0);
    expect(state.symbolPlacementPreview).toBeNull();
    expect(state.selection).toBeNull();
  });
});

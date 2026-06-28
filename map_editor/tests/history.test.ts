import { describe, expect, it } from 'vitest';
import { pushUndoSnapshot, undoLastChange } from '../src/history';
import { EditorState } from '../src/state';

describe('map editor undo history', () => {
  it('restores the previous editable map state', () => {
    const editor = new EditorState();
    editor.nodes = [{ id: 'n1', px: 10, py: 20 }];
    editor.decals = [
      {
        id: 'd1',
        type: 'arrow_straight',
        px: 30,
        py: 40,
        rotationDeg: 0,
        scaleM: 2
      }
    ];
    editor.paintedLines = [
      {
        id: 'l1',
        style: 'give_way_line',
        widthM: 0.15,
        points: [
          { px: 0, py: 0 },
          { px: 10, py: 0 }
        ]
      }
    ];
    editor.scenery = [
      {
        id: 's1',
        type: 'tree',
        px: 12,
        py: 14,
        rotationDeg: 90,
        scaleM: 4
      }
    ];
    editor.kerbLines = [
      {
        id: 'k1',
        widthM: 0.35,
        heightM: 0.18,
        points: [
          { px: 0, py: 5 },
          { px: 10, py: 5 }
        ]
      }
    ];
    editor.selection = { type: 'decal', id: 'd1' };

    pushUndoSnapshot(editor);

    editor.nodes.push({ id: 'n2', px: 50, py: 60 });
    editor.decals = [];
    editor.paintedLines = [];
    editor.scenery = [];
    editor.kerbLines = [];
    editor.selection = null;

    expect(undoLastChange(editor)).toBe(true);
    expect(editor.nodes).toEqual([{ id: 'n1', px: 10, py: 20 }]);
    expect(editor.decals).toHaveLength(1);
    expect(editor.paintedLines).toHaveLength(1);
    expect(editor.scenery).toHaveLength(1);
    expect(editor.kerbLines).toHaveLength(1);
    expect(editor.selection).toEqual({ type: 'decal', id: 'd1' });
  });

  it('reports no-op when there is no previous state', () => {
    const editor = new EditorState();

    expect(undoLastChange(editor)).toBe(false);
  });

  it('continues generated ids after imported ids', () => {
    const editor = new EditorState();

    editor.resetIdCounterFromIds(['n1', 'e3', 'd4', 'l5', 's6', 'k7']);

    expect(editor.createId('n')).toBe('n8');
  });
});

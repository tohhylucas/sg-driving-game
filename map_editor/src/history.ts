import type {
  CalibrationPreview,
  EditorSnapshot,
  EditorState,
  PxDecal,
  PxEdge,
  PxCurveControl,
  PxNode,
  PxPaintedLine,
  Selection,
  SymbolPlacementPreview
} from './state';

const MAX_UNDO_STEPS = 100;

function cloneNode(node: PxNode): PxNode {
  return { id: node.id, px: node.px, py: node.py };
}

function cloneEdge(edge: PxEdge): PxEdge {
  return {
    id: edge.id,
    nodeIds: [...edge.nodeIds],
    lanes: edge.lanes,
    laneWidthM: edge.laneWidthM,
    oneway: edge.oneway,
    curveControls: edge.curveControls.map(cloneCurveControl),
    markings: { ...edge.markings }
  };
}

function cloneCurveControl(control: PxCurveControl): PxCurveControl {
  return {
    fromNodeId: control.fromNodeId,
    toNodeId: control.toNodeId,
    control: { ...control.control }
  };
}

function cloneDecal(decal: PxDecal): PxDecal {
  return { ...decal };
}

function clonePaintedLine(line: PxPaintedLine): PxPaintedLine {
  return {
    id: line.id,
    style: line.style,
    widthM: line.widthM,
    points: line.points.map((point) => ({ ...point }))
  };
}

function cloneCalibrationPreview(
  preview: CalibrationPreview | null
): CalibrationPreview | null {
  if (!preview) {
    return null;
  }

  return {
    start: { ...preview.start },
    end: { ...preview.end },
    metersPerPixel: preview.metersPerPixel
  };
}

function cloneSelection(selection: Selection | null): Selection | null {
  return selection ? { ...selection } : null;
}

function cloneSymbolPlacementPreview(
  preview: SymbolPlacementPreview | null
): SymbolPlacementPreview | null {
  if (!preview) {
    return null;
  }

  return {
    type: preview.type,
    center: { ...preview.center },
    pointer: { ...preview.pointer },
    rotationDeg: preview.rotationDeg,
    scaleM: preview.scaleM
  };
}

export function createEditorSnapshot(editor: EditorState): EditorSnapshot {
  return {
    name: editor.name,
    imageWidthPx: editor.imageWidthPx,
    imageHeightPx: editor.imageHeightPx,
    metersPerPixel: editor.metersPerPixel,
    originPx: editor.originPx,
    originPy: editor.originPy,
    nodes: editor.nodes.map(cloneNode),
    edges: editor.edges.map(cloneEdge),
    decals: editor.decals.map(cloneDecal),
    paintedLines: editor.paintedLines.map(clonePaintedLine),
    decalType: editor.decalType,
    calibrationDistanceM: editor.calibrationDistanceM,
    edgeDraft: [...editor.edgeDraft],
    edgeDraftCurveControls: editor.edgeDraftCurveControls.map(cloneCurveControl),
    calibrationStart: editor.calibrationStart
      ? { ...editor.calibrationStart }
      : null,
    lastCalibration: cloneCalibrationPreview(editor.lastCalibration),
    currentSymbolScaleM: editor.currentSymbolScaleM,
    symbolPlacementPreview: cloneSymbolPlacementPreview(
      editor.symbolPlacementPreview
    ),
    selection: cloneSelection(editor.selection)
  };
}

export function restoreEditorSnapshot(
  editor: EditorState,
  snapshot: EditorSnapshot
): void {
  editor.name = snapshot.name;
  editor.imageWidthPx = snapshot.imageWidthPx;
  editor.imageHeightPx = snapshot.imageHeightPx;
  editor.metersPerPixel = snapshot.metersPerPixel;
  editor.originPx = snapshot.originPx;
  editor.originPy = snapshot.originPy;
  editor.nodes = snapshot.nodes.map(cloneNode);
  editor.edges = snapshot.edges.map(cloneEdge);
  editor.decals = snapshot.decals.map(cloneDecal);
  editor.paintedLines = snapshot.paintedLines.map(clonePaintedLine);
  editor.decalType = snapshot.decalType;
  editor.calibrationDistanceM = snapshot.calibrationDistanceM;
  editor.edgeDraft = [...snapshot.edgeDraft];
  editor.edgeDraftCurveControls =
    snapshot.edgeDraftCurveControls.map(cloneCurveControl);
  editor.calibrationStart = snapshot.calibrationStart
    ? { ...snapshot.calibrationStart }
    : null;
  editor.lastCalibration = cloneCalibrationPreview(snapshot.lastCalibration);
  editor.currentSymbolScaleM = snapshot.currentSymbolScaleM;
  editor.symbolPlacementPreview = cloneSymbolPlacementPreview(
    snapshot.symbolPlacementPreview
  );
  editor.selection = cloneSelection(snapshot.selection);
}

export function pushUndoSnapshot(
  editor: EditorState,
  snapshot: EditorSnapshot = createEditorSnapshot(editor)
): void {
  editor.undoStack.push(snapshot);

  if (editor.undoStack.length > MAX_UNDO_STEPS) {
    editor.undoStack.shift();
  }
}

export function undoLastChange(editor: EditorState): boolean {
  const snapshot = editor.undoStack.pop();

  if (!snapshot) {
    return false;
  }

  restoreEditorSnapshot(editor, snapshot);
  return true;
}

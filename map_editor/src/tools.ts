import {
  calculateMetersPerPixel,
  distanceToQuadraticBezier,
  distanceToSegment,
  type ImagePoint
} from './geometry';
import { createEditorSnapshot, pushUndoSnapshot } from './history';
import { findNearestSelection, screenToImage } from './render';
import {
  state,
  type EditorSnapshot,
  type PxCurveControl,
  type PxEdge,
  type Selection
} from './state';
import {
  DEFAULT_ROAD_MARKING_WIDTH_M
} from './constants';
import {
  createGiveWayLineMarking,
  getPlacementRotationDeg,
  getPlacementScaleM,
  isLineMarkingSymbol
} from './symbols';

export interface CanvasClickOptions {
  readonly curveControl?: boolean;
}

let symbolPlacementUndoSnapshot: EditorSnapshot | null = null;
let sceneryPlacementUndoSnapshot: EditorSnapshot | null = null;

function nodeForId(nodeId: string) {
  const node = state.nodes.find((candidate) => candidate.id === nodeId);

  if (!node) {
    throw new Error(`Missing node ${nodeId}.`);
  }

  return node;
}

function findCurveControl(
  controls: readonly PxCurveControl[],
  fromNodeId: string,
  toNodeId: string
): PxCurveControl | undefined {
  return controls.find(
    (control) =>
      control.fromNodeId === fromNodeId && control.toNodeId === toNodeId
  );
}

function upsertCurveControl(
  controls: PxCurveControl[],
  fromNodeId: string,
  toNodeId: string,
  controlPoint: ImagePoint
): void {
  const existing = findCurveControl(controls, fromNodeId, toNodeId);

  if (existing) {
    existing.control = controlPoint;
    return;
  }

  controls.push({
    fromNodeId,
    toNodeId,
    control: controlPoint
  });
}

function distanceToEdgeSegment(
  edge: PxEdge,
  fromNodeId: string,
  toNodeId: string,
  point: ImagePoint
): number {
  const start = nodeForId(fromNodeId);
  const end = nodeForId(toNodeId);
  const curveControl = findCurveControl(
    edge.curveControls,
    fromNodeId,
    toNodeId
  );

  return curveControl
    ? distanceToQuadraticBezier(point, start, curveControl.control, end)
    : distanceToSegment(point, start, end);
}

function findNearestEdgeSegment(
  point: ImagePoint,
  edgeId?: string
): { readonly edge: PxEdge; readonly fromNodeId: string; readonly toNodeId: string } | null {
  let best:
    | {
        readonly edge: PxEdge;
        readonly fromNodeId: string;
        readonly toNodeId: string;
        readonly distance: number;
      }
    | null = null;
  const candidates = edgeId
    ? state.edges.filter((edge) => edge.id === edgeId)
    : state.edges;

  for (const edge of candidates) {
    for (let index = 0; index < edge.nodeIds.length - 1; index += 1) {
      const fromNodeId = edge.nodeIds[index];
      const toNodeId = edge.nodeIds[index + 1];
      const distance = distanceToEdgeSegment(edge, fromNodeId, toNodeId, point);

      if (!best || distance < best.distance) {
        best = { edge, fromNodeId, toNodeId, distance };
      }
    }
  }

  return best
    ? {
        edge: best.edge,
        fromNodeId: best.fromNodeId,
        toNodeId: best.toNodeId
      }
    : null;
}

function applyRoadCurveControl(point: ImagePoint): boolean {
  if (state.tool === 'edge' && state.edgeDraft.length >= 2) {
    const fromNodeId = state.edgeDraft[state.edgeDraft.length - 2];
    const toNodeId = state.edgeDraft[state.edgeDraft.length - 1];
    pushUndoSnapshot(state);
    upsertCurveControl(
      state.edgeDraftCurveControls,
      fromNodeId,
      toNodeId,
      point
    );
    return true;
  }

  const selectedEdgeId =
    state.selection?.type === 'edge' ? state.selection.id : undefined;
  const segment = findNearestEdgeSegment(point, selectedEdgeId);

  if (!segment) {
    return false;
  }

  pushUndoSnapshot(state);
  upsertCurveControl(
    segment.edge.curveControls,
    segment.fromNodeId,
    segment.toNodeId,
    point
  );
  state.selection = { type: 'edge', id: segment.edge.id };
  return true;
}

export function handleCanvasClick(
  sx: number,
  sy: number,
  options: CanvasClickOptions = {}
): void {
  const point = screenToImage(sx, sy);

  if (
    options.curveControl &&
    (state.tool === 'edge' || state.tool === 'select')
  ) {
    applyRoadCurveControl(point);
    return;
  }

  if (state.tool === 'select') {
    state.selection = findNearestSelection(point.px, point.py);
    return;
  }

  if (state.tool === 'erase') {
    state.selection = findNearestSelection(point.px, point.py);
    deleteSelection();
    return;
  }

  if (state.tool === 'edge') {
    pushUndoSnapshot(state);
    const id = state.createId('n');
    state.nodes.push({ id, px: point.px, py: point.py });
    state.edgeDraft.push(id);
    state.selection = { type: 'node', id };
    return;
  }

  if (state.tool === 'decal') {
    startSymbolPlacement(sx, sy);
    commitSymbolPlacement();
    return;
  }

  if (state.tool === 'scenery') {
    startSceneryPlacement(sx, sy);
    commitSceneryPlacement();
    return;
  }

  if (state.tool === 'kerb') {
    pushUndoSnapshot(state);
    state.kerbDraft.push(point);
    state.selection = null;
    return;
  }

  if (state.tool === 'origin') {
    pushUndoSnapshot(state);
    state.originPx = point.px;
    state.originPy = point.py;
    return;
  }

  if (state.tool === 'calibrate') {
    if (!state.calibrationStart) {
      pushUndoSnapshot(state);
      state.calibrationStart = point;
      state.lastCalibration = null;
      return;
    }

    pushUndoSnapshot(state);
    state.metersPerPixel = calculateMetersPerPixel(
      state.calibrationStart,
      point,
      state.calibrationDistanceM
    );
    state.lastCalibration = {
      start: state.calibrationStart,
      end: point,
      metersPerPixel: state.metersPerPixel
    };

    state.calibrationStart = null;
  }
}

export function finishEdge(): void {
  if (state.edgeDraft.length >= 2) {
    pushUndoSnapshot(state);
    const edge = state.createDefaultEdge(
      [...state.edgeDraft],
      state.edgeDraftCurveControls
    );
    state.edges.push(edge);
    state.selection = { type: 'edge', id: edge.id };
  }

  state.edgeDraft = [];
  state.edgeDraftCurveControls = [];
}

export function finishKerbLine(): void {
  if (state.kerbDraft.length >= 2) {
    pushUndoSnapshot(state);
    const kerbLine = state.createKerbLine([...state.kerbDraft]);
    state.kerbLines.push(kerbLine);
    state.selection = { type: 'kerbLine', id: kerbLine.id };
  }

  state.kerbDraft = [];
}

export function commitPendingRoadPathForExport(): boolean {
  let committed = false;

  if (state.edgeDraft.length >= 2) {
    finishEdge();
    committed = true;
  }

  if (state.kerbDraft.length >= 2) {
    finishKerbLine();
    committed = true;
  }

  return committed;
}

export function cancelDraft(): void {
  state.edgeDraft = [];
  state.edgeDraftCurveControls = [];
  state.kerbDraft = [];
  state.calibrationStart = null;
  state.symbolPlacementPreview = null;
  state.sceneryPlacementPreview = null;
  symbolPlacementUndoSnapshot = null;
  sceneryPlacementUndoSnapshot = null;
}

function selectionMatches(selection: Selection, type: Selection['type']): boolean {
  return selection.type === type;
}

export function deleteSelection(): void {
  const selection = state.selection;

  if (!selection) {
    return;
  }

  pushUndoSnapshot(state);

  if (selectionMatches(selection, 'node')) {
    state.nodes = state.nodes.filter((node) => node.id !== selection.id);
    state.edges = state.edges.filter(
      (edge) => !edge.nodeIds.includes(selection.id)
    );
    state.edgeDraft = state.edgeDraft.filter((nodeId) => nodeId !== selection.id);
  } else if (selectionMatches(selection, 'edge')) {
    state.edges = state.edges.filter((edge) => edge.id !== selection.id);
  } else if (selectionMatches(selection, 'paintedLine')) {
    state.paintedLines = state.paintedLines.filter(
      (line) => line.id !== selection.id
    );
  } else if (selectionMatches(selection, 'decal')) {
    state.decals = state.decals.filter((decal) => decal.id !== selection.id);
  } else if (selectionMatches(selection, 'scenery')) {
    state.scenery = state.scenery.filter(
      (scenery) => scenery.id !== selection.id
    );
  } else {
    state.kerbLines = state.kerbLines.filter(
      (line) => line.id !== selection.id
    );
  }

  state.selection = null;
}

function rotatePaintedLine(lineId: string, deltaDeg: number): boolean {
  const line = state.paintedLines.find((candidate) => candidate.id === lineId);

  if (!line || line.points.length < 2) {
    return false;
  }

  const center = line.points.reduce(
    (sum, point) => ({
      px: sum.px + point.px / line.points.length,
      py: sum.py + point.py / line.points.length
    }),
    { px: 0, py: 0 }
  );
  const radians = (deltaDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  line.points = line.points.map((point) => {
    const dx = point.px - center.px;
    const dy = point.py - center.py;

    return {
      px: center.px + dx * cos - dy * sin,
      py: center.py + dx * sin + dy * cos
    };
  });

  return true;
}

export function rotateSelectedMarking(deltaDeg: number): void {
  const selection = state.selection;

  if (!selection) {
    return;
  }

  if (selection.type === 'paintedLine') {
    pushUndoSnapshot(state);
    if (!rotatePaintedLine(selection.id, deltaDeg)) {
      state.undoStack.pop();
    }
    return;
  }

  if (selection.type === 'decal') {
    const decal = state.decals.find((candidate) => candidate.id === selection.id);

    if (decal) {
      pushUndoSnapshot(state);
      decal.rotationDeg = (decal.rotationDeg + deltaDeg + 360) % 360;
    }
  }

  if (selection.type === 'scenery') {
    const scenery = state.scenery.find(
      (candidate) => candidate.id === selection.id
    );

    if (scenery) {
      pushUndoSnapshot(state);
      scenery.rotationDeg = (scenery.rotationDeg + deltaDeg + 360) % 360;
    }
  }
}

export function startSymbolPlacement(sx: number, sy: number): void {
  const point = screenToImage(sx, sy);

  symbolPlacementUndoSnapshot = createEditorSnapshot(state);
  state.symbolPlacementPreview = {
    type: state.decalType,
    center: point,
    pointer: point,
    rotationDeg: 0,
    scaleM: state.currentSymbolScaleM
  };
  state.selection = null;
}

export function updateSymbolPlacement(sx: number, sy: number): void {
  const preview = state.symbolPlacementPreview;

  if (!preview) {
    return;
  }

  preview.pointer = screenToImage(sx, sy);
  preview.rotationDeg = getPlacementRotationDeg({
    center: preview.center,
    pointer: preview.pointer
  });
  preview.scaleM = getPlacementScaleM({
    center: preview.center,
    pointer: preview.pointer,
    metersPerPixel: state.metersPerPixel,
    fallbackScaleM: state.currentSymbolScaleM
  });
  state.currentSymbolScaleM = preview.scaleM;
}

export function commitSymbolPlacement(): void {
  const preview = state.symbolPlacementPreview;

  if (!preview) {
    symbolPlacementUndoSnapshot = null;
    return;
  }

  const undoSnapshot = symbolPlacementUndoSnapshot;
  symbolPlacementUndoSnapshot = null;

  if (undoSnapshot) {
    pushUndoSnapshot(state, undoSnapshot);
  } else {
    state.symbolPlacementPreview = null;
    pushUndoSnapshot(state);
    state.symbolPlacementPreview = preview;
  }

  if (isLineMarkingSymbol(preview.type)) {
    const line = createGiveWayLineMarking({
      id: state.createId('l'),
      center: preview.center,
      rotationDeg: preview.rotationDeg,
      lengthM: preview.scaleM,
      widthM: DEFAULT_ROAD_MARKING_WIDTH_M,
      metersPerPixel: state.metersPerPixel
    });
    state.paintedLines.push(line);
    state.selection = { type: 'paintedLine', id: line.id };
  } else {
    const decal = {
      id: state.createId('d'),
      type: preview.type,
      px: preview.center.px,
      py: preview.center.py,
      rotationDeg: preview.rotationDeg,
      scaleM: preview.scaleM
    };
    state.decals.push(decal);
    state.selection = { type: 'decal', id: decal.id };
  }

  state.currentSymbolScaleM = preview.scaleM;
  state.symbolPlacementPreview = null;
}

export function startSceneryPlacement(sx: number, sy: number): void {
  const point = screenToImage(sx, sy);

  sceneryPlacementUndoSnapshot = createEditorSnapshot(state);
  state.sceneryPlacementPreview = {
    type: state.sceneryType,
    center: point,
    pointer: point,
    rotationDeg: 0,
    scaleM: state.currentSceneryScaleM
  };
  state.selection = null;
}

export function updateSceneryPlacement(sx: number, sy: number): void {
  const preview = state.sceneryPlacementPreview;

  if (!preview) {
    return;
  }

  preview.pointer = screenToImage(sx, sy);
  preview.rotationDeg = getPlacementRotationDeg({
    center: preview.center,
    pointer: preview.pointer
  });
  preview.scaleM = getPlacementScaleM({
    center: preview.center,
    pointer: preview.pointer,
    metersPerPixel: state.metersPerPixel,
    fallbackScaleM: state.currentSceneryScaleM
  });
  state.currentSceneryScaleM = preview.scaleM;
}

export function commitSceneryPlacement(): void {
  const preview = state.sceneryPlacementPreview;

  if (!preview) {
    sceneryPlacementUndoSnapshot = null;
    return;
  }

  const undoSnapshot = sceneryPlacementUndoSnapshot;
  sceneryPlacementUndoSnapshot = null;

  if (undoSnapshot) {
    pushUndoSnapshot(state, undoSnapshot);
  } else {
    state.sceneryPlacementPreview = null;
    pushUndoSnapshot(state);
    state.sceneryPlacementPreview = preview;
  }

  const scenery = {
    id: state.createId('s'),
    type: preview.type,
    px: preview.center.px,
    py: preview.center.py,
    rotationDeg: preview.rotationDeg,
    scaleM: preview.scaleM
  };

  state.scenery.push(scenery);
  state.selection = { type: 'scenery', id: scenery.id };
  state.currentSceneryScaleM = preview.scaleM;
  state.sceneryPlacementPreview = null;
}

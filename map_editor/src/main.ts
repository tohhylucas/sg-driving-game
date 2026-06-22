import './styles.css';

import { VIEW_CONFIG } from './constants';
import { downloadMapData } from './exportMap';
import { clamp, imageToScreen } from './geometry';
import { pushUndoSnapshot, undoLastChange } from './history';
import {
  importMapData,
  parseMapDataJson,
  type ImportedEditableMap
} from './importMap';
import { DECAL_TYPES, MARKING_STYLES, type MarkingStyle } from './schema';
import { state, type PxDecal, type PxEdge, type Tool } from './state';
import { render, screenToImage } from './render';
import {
  cancelDraft,
  commitPendingRoadPathForExport,
  commitSymbolPlacement,
  deleteSelection,
  finishEdge,
  handleCanvasClick,
  rotateSelectedMarking,
  startSymbolPlacement,
  updateSymbolPlacement
} from './tools';
import { loadImageFromFile } from './upload';

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing element #${id}.`);
  }

  return element as T;
}

const canvas = getElement<HTMLCanvasElement>('map-canvas');
const context = canvas.getContext('2d');

if (!context) {
  throw new Error('Canvas 2D context is unavailable.');
}

const renderingContext: CanvasRenderingContext2D = context;

const imageFileInput = getElement<HTMLInputElement>('image-file');
const jsonFileInput = getElement<HTMLInputElement>('json-file');
const mapNameInput = getElement<HTMLInputElement>('map-name');
const calibrationDistanceInput = getElement<HTMLInputElement>('calibration-distance');
const mapRotationInput = getElement<HTMLInputElement>('map-rotation');
const decalTypeSelect = getElement<HTMLSelectElement>('decal-type');
const symbolScaleInput = getElement<HTMLInputElement>('symbol-scale');
const inspectorToggleButton = getElement<HTMLButtonElement>('inspector-toggle');
const shortcutsToggleButton = getElement<HTMLButtonElement>('shortcuts-toggle');
const shortcutsPopover = getElement<HTMLDivElement>('shortcuts-popover');
const rotateMapLeftButton = getElement<HTMLButtonElement>('rotate-map-left');
const rotateMapRightButton = getElement<HTMLButtonElement>('rotate-map-right');
const resetMapRotationButton = getElement<HTMLButtonElement>('reset-map-rotation');
const exportButton = getElement<HTMLButtonElement>('export');
const statusLine = getElement<HTMLDivElement>('status');
const scaleReadout = getElement<HTMLElement>('scale-readout');
const originReadout = getElement<HTMLElement>('origin-readout');
const countsReadout = getElement<HTMLElement>('counts-readout');
const symbolSizeReadout = getElement<HTMLElement>('symbol-size-readout');
const selectionHeading = getElement<HTMLHeadingElement>('selection-heading');
const selectionSummary = getElement<HTMLParagraphElement>('selection-summary');
const edgeControls = getElement<HTMLDivElement>('edge-controls');
const edgeLanesInput = getElement<HTMLInputElement>('edge-lanes');
const edgeLaneWidthInput = getElement<HTMLInputElement>('edge-lane-width');
const edgeCenterMarkingSelect = getElement<HTMLSelectElement>('edge-center-marking');
const edgeLeftMarkingSelect = getElement<HTMLSelectElement>('edge-left-marking');
const edgeRightMarkingSelect = getElement<HTMLSelectElement>('edge-right-marking');
const edgeOnewayInput = getElement<HTMLInputElement>('edge-oneway');
const decalControls = getElement<HTMLDivElement>('decal-controls');
const decalRotationInput = getElement<HTMLInputElement>('decal-rotation');
const decalScaleInput = getElement<HTMLInputElement>('decal-scale');

function fillSelect(
  select: HTMLSelectElement,
  values: readonly string[]
): void {
  for (const value of values) {
    select.add(new Option(value, value));
  }
}

fillSelect(decalTypeSelect, DECAL_TYPES);
fillSelect(edgeCenterMarkingSelect, MARKING_STYLES);
fillSelect(edgeLeftMarkingSelect, MARKING_STYLES);
fillSelect(edgeRightMarkingSelect, MARKING_STYLES);

function resizeCanvas(): void {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width));
  canvas.height = Math.max(1, Math.floor(rect.height));
}

function fitMapToCanvas(): void {
  if (state.imageWidthPx <= 0 || state.imageHeightPx <= 0) {
    return;
  }

  const availableWidth = Math.max(1, canvas.width - VIEW_CONFIG.fitPaddingPx * 2);
  const availableHeight = Math.max(1, canvas.height - VIEW_CONFIG.fitPaddingPx * 2);
  const scale = Math.min(
    availableWidth / state.imageWidthPx,
    availableHeight / state.imageHeightPx
  );

  state.view = {
    scale: clamp(scale, VIEW_CONFIG.minScale, VIEW_CONFIG.maxScale),
    offsetX: (canvas.width - state.imageWidthPx * scale) / 2,
    offsetY: (canvas.height - state.imageHeightPx * scale) / 2,
    rotationRad: 0,
    rotationCenterPx: state.imageWidthPx / 2,
    rotationCenterPy: state.imageHeightPx / 2
  };
  mapRotationInput.value = '0';
}

function applyImportedMap(imported: ImportedEditableMap): void {
  const existingImage = state.image;
  const keepExistingImage =
    existingImage?.naturalWidth === imported.imageWidthPx &&
    existingImage.naturalHeight === imported.imageHeightPx;

  state.name = imported.name;
  state.image = keepExistingImage ? existingImage : null;
  state.imageWidthPx = imported.imageWidthPx;
  state.imageHeightPx = imported.imageHeightPx;
  state.metersPerPixel = imported.metersPerPixel;
  state.originPx = imported.originPx;
  state.originPy = imported.originPy;
  state.nodes = imported.nodes.map((node) => ({ ...node }));
  state.edges = imported.edges.map((edge) => ({
    ...edge,
    nodeIds: [...edge.nodeIds],
    markings: { ...edge.markings },
    curveControls: edge.curveControls.map((curveControl) => ({
      fromNodeId: curveControl.fromNodeId,
      toNodeId: curveControl.toNodeId,
      control: { ...curveControl.control }
    }))
  }));
  state.decals = imported.decals.map((decal) => ({ ...decal }));
  state.paintedLines = imported.paintedLines.map((line) => ({
    ...line,
    points: line.points.map((point) => ({ ...point }))
  }));
  state.edgeDraft = [];
  state.edgeDraftCurveControls = [];
  state.calibrationStart = null;
  state.hoverImagePoint = null;
  state.lastCalibration = null;
  state.symbolPlacementPreview = null;
  state.selection = null;
  state.resetIdCounterFromIds([
    ...state.nodes.map((node) => node.id),
    ...state.edges.map((edge) => edge.id),
    ...state.decals.map((decal) => decal.id),
    ...state.paintedLines.map((line) => line.id)
  ]);
}

function updateActiveToolButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('button[data-tool]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tool === state.tool);
  });
}

function selectedEdge(): PxEdge | null {
  if (state.selection?.type !== 'edge') {
    return null;
  }

  return state.edges.find((edge) => edge.id === state.selection?.id) ?? null;
}

function selectedDecal(): PxDecal | null {
  if (state.selection?.type !== 'decal') {
    return null;
  }

  return state.decals.find((decal) => decal.id === state.selection?.id) ?? null;
}

function selectedPaintedLine(): string | null {
  return state.selection?.type === 'paintedLine' ? state.selection.id : null;
}

function getToolHint(): string {
  if (state.tool === 'select') {
    return 'Select/Edit: click an existing item. Ctrl-click a road path segment to add or move its curve pivot.';
  }

  if (state.tool === 'edge') {
    return state.edgeDraft.length >= 2
      ? 'Draw Road Path: click the next road point, Ctrl-click to bend the latest segment, then press Enter.'
      : 'Draw Road Path: click points along the road center path, then press Enter.';
  }

  if (state.tool === 'decal') {
    return state.symbolPlacementPreview
      ? 'Place Symbol: drag direction rotates and distance sets size; release to place.'
      : 'Place Symbol: click-drag from the center; direction rotates and distance sets size.';
  }

  if (state.tool === 'calibrate') {
    return state.calibrationStart
      ? 'Calibrate Scale: click the second point to apply the known distance.'
      : 'Calibrate Scale: click the first point of the known distance.';
  }

  if (state.tool === 'erase') {
    return 'Erase: click a road, line marking, node, or symbol to remove it.';
  }

  return 'Set Origin: click the image point that should become world 0,0.';
}

function updateInspector(): void {
  scaleReadout.textContent = `${state.metersPerPixel.toFixed(4)} m/px`;
  originReadout.textContent = `${state.originPx.toFixed(1)}, ${state.originPy.toFixed(1)} px`;
  countsReadout.textContent = `${state.nodes.length} road points, ${state.edges.length} roads, ${state.paintedLines.length} line markings, ${state.decals.length} symbols`;
  symbolSizeReadout.textContent = `${state.currentSymbolScaleM.toFixed(2)} m`;
  symbolScaleInput.value = String(state.currentSymbolScaleM);

  const edge = selectedEdge();
  const decal = selectedDecal();
  const paintedLineId = selectedPaintedLine();

  edgeControls.hidden = !edge;
  decalControls.hidden = !decal;

  if (edge) {
    const curveCount = edge.curveControls.length;
    selectionHeading.textContent = 'Selected Road Path';
    selectionSummary.textContent = `Road path ${edge.id}: ${edge.nodeIds.length} points, ${edge.lanes} lane${edge.lanes === 1 ? '' : 's'}, ${edge.laneWidthM.toFixed(1)} m lane width, ${curveCount} curved segment${curveCount === 1 ? '' : 's'}.`;
    edgeLanesInput.value = String(edge.lanes);
    edgeLaneWidthInput.value = String(edge.laneWidthM);
    edgeCenterMarkingSelect.value = edge.markings.center;
    edgeLeftMarkingSelect.value = edge.markings.leftEdge;
    edgeRightMarkingSelect.value = edge.markings.rightEdge;
    edgeOnewayInput.checked = edge.oneway;
  } else if (decal) {
    selectionHeading.textContent = 'Selected Symbol';
    selectionSummary.textContent = `Symbol ${decal.id}: ${decal.type}.`;
    decalRotationInput.value = String(decal.rotationDeg);
    decalScaleInput.value = String(decal.scaleM);
  } else if (paintedLineId) {
    selectionHeading.textContent = 'Selected Line Marking';
    selectionSummary.textContent = `Line marking ${paintedLineId}. Press Delete to remove it.`;
  } else if (state.selection?.type === 'node') {
    selectionHeading.textContent = 'Selected Road Point';
    selectionSummary.textContent = `Road point ${state.selection.id}.`;
  } else {
    selectionHeading.textContent = 'Selected Item';
    selectionSummary.textContent = 'Nothing selected.';
  }

  const imageState = state.image
    ? `${state.imageWidthPx}x${state.imageHeightPx}px image`
    : 'No image loaded';
  statusLine.textContent = `${imageState} | ${getToolHint()} | undo steps: ${state.undoStack.length} | line markings: ${state.paintedLines.length}`;
}

function syncToolbarInputs(): void {
  mapNameInput.value = state.name;
  calibrationDistanceInput.value = String(state.calibrationDistanceM);
  symbolScaleInput.value = String(state.currentSymbolScaleM);
}

function setInspectorOpen(open: boolean): void {
  document.body.classList.toggle('inspector-open', open);
  inspectorToggleButton.setAttribute('aria-expanded', String(open));
  inspectorToggleButton.textContent = open ? 'Hide Panel' : 'Map Panel';
}

function setShortcutsOpen(open: boolean): void {
  shortcutsPopover.hidden = !open;
  shortcutsToggleButton.setAttribute('aria-expanded', String(open));
}

function setMapRotation(degrees: number): void {
  state.view = {
    ...state.view,
    rotationRad: (degrees * Math.PI) / 180
  };
  mapRotationInput.value = String(Math.round(degrees * 10) / 10);
  updateInspector();
}

function getMapRotationDeg(): number {
  return (state.view.rotationRad * 180) / Math.PI;
}

function isFormTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

document.querySelectorAll<HTMLButtonElement>('button[data-tool]').forEach((button) => {
  button.addEventListener('click', () => {
    state.tool = button.dataset.tool as Tool;
    updateActiveToolButtons();
    updateInspector();
  });
});

mapNameInput.addEventListener('input', () => {
  state.name = mapNameInput.value;
});

calibrationDistanceInput.addEventListener('input', () => {
  const distanceM = Number(calibrationDistanceInput.value);

  if (Number.isFinite(distanceM) && distanceM > 0) {
    state.calibrationDistanceM = distanceM;
  }
});

mapRotationInput.addEventListener('input', () => {
  const degrees = Number(mapRotationInput.value);

  if (Number.isFinite(degrees)) {
    setMapRotation(degrees);
  }
});

rotateMapLeftButton.addEventListener('click', () => {
  setMapRotation(getMapRotationDeg() - 15);
});

rotateMapRightButton.addEventListener('click', () => {
  setMapRotation(getMapRotationDeg() + 15);
});

resetMapRotationButton.addEventListener('click', () => {
  setMapRotation(0);
});

decalTypeSelect.addEventListener('change', () => {
  state.decalType = decalTypeSelect.value as typeof state.decalType;
});

symbolScaleInput.addEventListener('input', () => {
  const scaleM = Number(symbolScaleInput.value);

  if (Number.isFinite(scaleM) && scaleM > 0) {
    state.currentSymbolScaleM = scaleM;

    if (state.symbolPlacementPreview) {
      state.symbolPlacementPreview.scaleM = scaleM;
    }

    updateInspector();
  }
});

imageFileInput.addEventListener('change', async () => {
  const file = imageFileInput.files?.[0];

  if (!file) {
    return;
  }

  const image = await loadImageFromFile(file);
  const imageName = file.name.replace(/\.[^.]+$/, '') || state.name;
  state.resetForImage(image, imageName);
  mapNameInput.value = state.name;
  fitMapToCanvas();
  updateInspector();
});

jsonFileInput.addEventListener('change', async () => {
  const file = jsonFileInput.files?.[0];

  if (!file) {
    return;
  }

  try {
    const imported = importMapData(parseMapDataJson(await file.text()));
    pushUndoSnapshot(state);
    applyImportedMap(imported);
    syncToolbarInputs();
    fitMapToCanvas();
    updateActiveToolButtons();
    updateInspector();
    statusLine.textContent = `Imported ${imported.name}: ${imported.nodes.length} road points, ${imported.edges.length} roads, ${imported.paintedLines.length} line markings, ${imported.decals.length} symbols.`;
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Unable to import map JSON.');
  } finally {
    jsonFileInput.value = '';
  }
});

inspectorToggleButton.addEventListener('click', () => {
  setInspectorOpen(!document.body.classList.contains('inspector-open'));
});

shortcutsToggleButton.addEventListener('click', () => {
  setShortcutsOpen(shortcutsPopover.hidden !== false);
});

exportButton.addEventListener('click', () => {
  try {
    const committedRoadPath = commitPendingRoadPathForExport();
    downloadMapData(state);

    if (committedRoadPath) {
      updateInspector();
    }
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Unable to export map.');
  }
});

edgeLanesInput.addEventListener('input', () => {
  const edge = selectedEdge();

  if (edge) {
    pushUndoSnapshot(state);
    edge.lanes = Math.max(1, Math.round(Number(edgeLanesInput.value)));
  }
});

edgeLaneWidthInput.addEventListener('input', () => {
  const edge = selectedEdge();

  if (edge) {
    pushUndoSnapshot(state);
    edge.laneWidthM = Number(edgeLaneWidthInput.value);
  }
});

edgeCenterMarkingSelect.addEventListener('change', () => {
  const edge = selectedEdge();

  if (edge) {
    pushUndoSnapshot(state);
    edge.markings = {
      ...edge.markings,
      center: edgeCenterMarkingSelect.value as MarkingStyle
    };
  }
});

edgeLeftMarkingSelect.addEventListener('change', () => {
  const edge = selectedEdge();

  if (edge) {
    pushUndoSnapshot(state);
    edge.markings = {
      ...edge.markings,
      leftEdge: edgeLeftMarkingSelect.value as MarkingStyle
    };
  }
});

edgeRightMarkingSelect.addEventListener('change', () => {
  const edge = selectedEdge();

  if (edge) {
    pushUndoSnapshot(state);
    edge.markings = {
      ...edge.markings,
      rightEdge: edgeRightMarkingSelect.value as MarkingStyle
    };
  }
});

edgeOnewayInput.addEventListener('change', () => {
  const edge = selectedEdge();

  if (edge) {
    pushUndoSnapshot(state);
    edge.oneway = edgeOnewayInput.checked;
  }
});

decalRotationInput.addEventListener('input', () => {
  const decal = selectedDecal();

  if (decal) {
    pushUndoSnapshot(state);
    decal.rotationDeg = Number(decalRotationInput.value) % 360;
  }
});

decalScaleInput.addEventListener('input', () => {
  const decal = selectedDecal();

  if (decal) {
    pushUndoSnapshot(state);
    decal.scaleM = Number(decalScaleInput.value);
    state.currentSymbolScaleM = decal.scaleM;
  }
});

let panning = false;
let spaceDown = false;
let placingSymbol = false;
let lastPointerX = 0;
let lastPointerY = 0;

canvas.addEventListener('mousedown', (event) => {
  if (spaceDown || event.button === 1) {
    panning = true;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    return;
  }

  if (state.tool === 'decal') {
    placingSymbol = true;
    startSymbolPlacement(event.offsetX, event.offsetY);
    updateInspector();
    return;
  }

  handleCanvasClick(event.offsetX, event.offsetY, {
    curveControl: event.ctrlKey
  });
  updateInspector();
});

canvas.addEventListener('mousemove', (event) => {
  state.hoverImagePoint = screenToImage(event.offsetX, event.offsetY);

  if (placingSymbol) {
    updateSymbolPlacement(event.offsetX, event.offsetY);
    updateInspector();
    return;
  }

  if (!panning) {
    return;
  }

  state.view = {
    ...state.view,
    offsetX: state.view.offsetX + event.clientX - lastPointerX,
    offsetY: state.view.offsetY + event.clientY - lastPointerY
  };
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
});

canvas.addEventListener('mouseleave', () => {
  state.hoverImagePoint = null;
});

window.addEventListener('mouseup', () => {
  if (placingSymbol) {
    placingSymbol = false;
    commitSymbolPlacement();
    updateInspector();
  }

  panning = false;
});

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();

  const beforeZoom = screenToImage(event.offsetX, event.offsetY);
  const factor = event.deltaY < 0 ? VIEW_CONFIG.zoomStep : 1 / VIEW_CONFIG.zoomStep;
  const scale = clamp(
    state.view.scale * factor,
    VIEW_CONFIG.minScale,
    VIEW_CONFIG.maxScale
  );
  const anchorScreenWithoutOffset = imageToScreen(
    {
      ...state.view,
      scale,
      offsetX: 0,
      offsetY: 0
    },
    beforeZoom
  );

  state.view = {
    ...state.view,
    scale,
    offsetX: event.offsetX - anchorScreenWithoutOffset.x,
    offsetY: event.offsetY - anchorScreenWithoutOffset.y
  };
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    spaceDown = true;
    event.preventDefault();
  }

  if (isFormTarget(event.target)) {
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undoLastChange(state);
    syncToolbarInputs();
    updateInspector();
    return;
  }

  if (event.key === 'Enter') {
    finishEdge();
  } else if (event.key === 'Escape') {
    placingSymbol = false;
    cancelDraft();
    setShortcutsOpen(false);
    state.selection = null;
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    deleteSelection();
  } else if (event.key.toLowerCase() === 'q') {
    rotateSelectedMarking(-15);
  } else if (event.key.toLowerCase() === 'e') {
    rotateSelectedMarking(15);
  }

  updateInspector();
});

window.addEventListener('keyup', (event) => {
  if (event.code === 'Space') {
    spaceDown = false;
  }
});

window.addEventListener('resize', () => {
  resizeCanvas();
});

resizeCanvas();
updateActiveToolButtons();
updateInspector();

function frame(): void {
  render(renderingContext);
  requestAnimationFrame(frame);
}

frame();

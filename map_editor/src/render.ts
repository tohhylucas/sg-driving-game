import {
  DEFAULT_KERB_HEIGHT_M,
  DEFAULT_KERB_WIDTH_M,
  DEFAULT_ROAD_MARKING_WIDTH_M,
  VIEW_CONFIG
} from './constants';
import {
  distanceToQuadraticBezier,
  distanceToSegment,
  quadraticBezierPoint,
  screenToImage as toImagePoint
} from './geometry';
import { createGiveWayLineMarking, isLineMarkingSymbol } from './symbols';
import {
  state,
  type PxCurveControl,
  type PxDecal,
  type PxEdge,
  type PxKerbLine,
  type PxNode,
  type PxPaintedLine,
  type PxScenery,
  type Selection
} from './state';

export function screenToImage(sx: number, sy: number) {
  return toImagePoint(state.view, { x: sx, y: sy });
}

function nodeForId(nodeId: string): PxNode {
  const node = state.nodes.find((candidate) => candidate.id === nodeId);

  if (!node) {
    throw new Error(`Missing node ${nodeId}.`);
  }

  return node;
}

function isSelected(type: Selection['type'], id: string): boolean {
  return state.selection?.type === type && state.selection.id === id;
}

function findCurveControl(
  edge: PxEdge,
  fromNodeId: string,
  toNodeId: string
): PxCurveControl | undefined {
  return edge.curveControls.find(
    (control) =>
      control.fromNodeId === fromNodeId && control.toNodeId === toNodeId
  );
}

function drawEdge(
  context: CanvasRenderingContext2D,
  edge: PxEdge,
  color: string,
  lineWidthPx: number
): void {
  context.strokeStyle = color;
  context.lineWidth = lineWidthPx / state.view.scale;
  context.beginPath();

  for (let index = 0; index < edge.nodeIds.length; index += 1) {
    const nodeId = edge.nodeIds[index];
    const node = nodeForId(nodeId);

    if (index === 0) {
      context.moveTo(node.px, node.py);
      continue;
    }

    const fromNodeId = edge.nodeIds[index - 1];
    const curveControl = findCurveControl(edge, fromNodeId, nodeId);

    if (curveControl) {
      context.quadraticCurveTo(
        curveControl.control.px,
        curveControl.control.py,
        node.px,
        node.py
      );
    } else {
      context.lineTo(node.px, node.py);
    }
  }

  context.stroke();
}

function getEdgeLabelPoint(edge: PxEdge): { px: number; py: number } | null {
  if (edge.nodeIds.length === 0) {
    return null;
  }

  if (edge.nodeIds.length === 1) {
    return nodeForId(edge.nodeIds[0]);
  }

  const segments: Array<{
    readonly start: PxNode;
    readonly end: PxNode;
    readonly control?: PxCurveControl;
    readonly length: number;
  }> = [];
  let totalLength = 0;

  for (let index = 0; index < edge.nodeIds.length - 1; index += 1) {
    const start = nodeForId(edge.nodeIds[index]);
    const end = nodeForId(edge.nodeIds[index + 1]);
    const curveControl = findCurveControl(
      edge,
      edge.nodeIds[index],
      edge.nodeIds[index + 1]
    );
    let length = 0;
    let previous: { px: number; py: number } = start;

    if (curveControl) {
      for (let sample = 1; sample <= 16; sample += 1) {
        const current = quadraticBezierPoint(
          start,
          curveControl.control,
          end,
          sample / 16
        );
        length += Math.hypot(current.px - previous.px, current.py - previous.py);
        previous = current;
      }
    } else {
      length = Math.hypot(end.px - start.px, end.py - start.py);
    }

    totalLength += length;
    segments.push({ start, end, control: curveControl, length });
  }

  if (totalLength <= 0) {
    return nodeForId(edge.nodeIds[0]);
  }

  let traveled = 0;
  const target = totalLength / 2;

  for (const segment of segments) {
    if (traveled + segment.length >= target) {
      const t = (target - traveled) / segment.length;

      return segment.control
        ? quadraticBezierPoint(
            segment.start,
            segment.control.control,
            segment.end,
            t
          )
        : {
            px: segment.start.px + (segment.end.px - segment.start.px) * t,
            py: segment.start.py + (segment.end.py - segment.start.py) * t
          };
    }

    traveled += segment.length;
  }

  return segments[segments.length - 1].end;
}

function drawEdgeCurveControls(
  context: CanvasRenderingContext2D,
  edge: PxEdge
): void {
  context.save();

  for (const curveControl of edge.curveControls) {
    const start = nodeForId(curveControl.fromNodeId);
    const end = nodeForId(curveControl.toNodeId);
    const radius = 5 / state.view.scale;

    context.strokeStyle = 'rgba(255, 204, 0, 0.74)';
    context.lineWidth = 1.5 / state.view.scale;
    context.setLineDash([5 / state.view.scale, 5 / state.view.scale]);
    context.beginPath();
    context.moveTo(start.px, start.py);
    context.lineTo(curveControl.control.px, curveControl.control.py);
    context.lineTo(end.px, end.py);
    context.stroke();
    context.setLineDash([]);

    context.fillStyle = '#ffcc00';
    context.strokeStyle = '#0f1419';
    context.lineWidth = 1.5 / state.view.scale;
    context.beginPath();
    context.arc(
      curveControl.control.px,
      curveControl.control.py,
      radius,
      0,
      Math.PI * 2
    );
    context.fill();
    context.stroke();
  }

  context.restore();
}

function drawEdgeLaneBadge(
  context: CanvasRenderingContext2D,
  edge: PxEdge
): void {
  const point = getEdgeLabelPoint(edge);

  if (!point) {
    return;
  }

  const selected = isSelected('edge', edge.id);
  const fontSize = 12 / state.view.scale;
  const paddingX = 6 / state.view.scale;
  const paddingY = 3 / state.view.scale;
  const text = `${edge.lanes} lane${edge.lanes === 1 ? '' : 's'}`;

  context.save();
  context.font = `600 ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const textWidth = context.measureText(text).width;
  const width = textWidth + paddingX * 2;
  const height = fontSize + paddingY * 2;

  context.fillStyle = selected ? 'rgba(255, 255, 255, 0.94)' : 'rgba(18, 55, 74, 0.92)';
  context.strokeStyle = selected ? '#12374a' : '#64d2ff';
  context.lineWidth = 1.5 / state.view.scale;
  context.beginPath();
  context.roundRect(
    point.px - width / 2,
    point.py - height / 2,
    width,
    height,
    4 / state.view.scale
  );
  context.fill();
  context.stroke();
  context.fillStyle = selected ? '#12374a' : '#e7edf3';
  context.fillText(text, point.px, point.py);
  context.restore();
}

function drawSelectionRing(
  context: CanvasRenderingContext2D,
  px: number,
  py: number
): void {
  context.strokeStyle = '#ffffff';
  context.lineWidth = 2 / state.view.scale;
  context.beginPath();
  context.arc(px, py, 8 / state.view.scale, 0, Math.PI * 2);
  context.stroke();
}

function drawPaintedLine(
  context: CanvasRenderingContext2D,
  line: PxPaintedLine,
  selected: boolean
): void {
  if (line.points.length < 2) {
    return;
  }

  context.strokeStyle = selected
    ? '#ffffff'
    : line.style === 'give_way_line'
      ? '#f8fafc'
    : line.style === 'solid_yellow'
      ? '#ffd447'
      : '#00d5ff';
  context.lineWidth =
    Math.max(line.widthM / state.metersPerPixel, 2 / state.view.scale) +
    (selected ? 2 / state.view.scale : 0);
  context.setLineDash(
    line.style === 'give_way_line'
      ? [10 / state.view.scale, 8 / state.view.scale]
      : []
  );
  context.beginPath();

  line.points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.px, point.py);
    } else {
      context.lineTo(point.px, point.py);
    }
  });

  context.stroke();
  context.setLineDash([]);

  if (selected) {
    for (const point of line.points) {
      drawSelectionRing(context, point.px, point.py);
    }
  }
}

function drawKerbLine(
  context: CanvasRenderingContext2D,
  line: PxKerbLine,
  selected: boolean
): void {
  if (line.points.length < 2) {
    return;
  }

  const widthPx = Math.max(
    line.widthM / state.metersPerPixel,
    3 / state.view.scale
  );

  context.save();
  context.lineCap = 'butt';
  context.lineJoin = 'round';
  context.strokeStyle = selected ? '#64d2ff' : '#111827';
  context.lineWidth = widthPx + (selected ? 4 / state.view.scale : 0);
  context.beginPath();
  line.points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.px, point.py);
    } else {
      context.lineTo(point.px, point.py);
    }
  });
  context.stroke();

  context.strokeStyle = '#ffffff';
  context.lineWidth = widthPx * 0.7;

  for (let index = 0; index < line.points.length - 1; index += 1) {
    drawKerbStripeSegment(context, line.points[index], line.points[index + 1]);
  }

  if (selected) {
    for (const point of line.points) {
      drawSelectionRing(context, point.px, point.py);
    }
  }

  context.restore();
}

function drawKerbStripeSegment(
  context: CanvasRenderingContext2D,
  start: { readonly px: number; readonly py: number },
  end: { readonly px: number; readonly py: number }
): void {
  const lengthPx = Math.hypot(end.px - start.px, end.py - start.py);
  const stripeLengthPx = Math.max(12 / state.view.scale, 0.8 / state.metersPerPixel);

  if (lengthPx <= 0) {
    return;
  }

  let offsetPx = 0;
  let stripeIndex = 0;

  while (offsetPx < lengthPx) {
    const nextOffsetPx = Math.min(offsetPx + stripeLengthPx, lengthPx);

    if (stripeIndex % 2 === 0) {
      const fromT = offsetPx / lengthPx;
      const toT = nextOffsetPx / lengthPx;

      context.beginPath();
      context.moveTo(
        start.px + (end.px - start.px) * fromT,
        start.py + (end.py - start.py) * fromT
      );
      context.lineTo(
        start.px + (end.px - start.px) * toT,
        start.py + (end.py - start.py) * toT
      );
      context.stroke();
    }

    offsetPx = nextOffsetPx;
    stripeIndex += 1;
  }
}

function drawKerbDraft(context: CanvasRenderingContext2D): void {
  if (state.kerbDraft.length === 0) {
    return;
  }

  const points = state.hoverImagePoint
    ? [...state.kerbDraft, state.hoverImagePoint]
    : state.kerbDraft;

  drawKerbLine(
    context,
    {
      id: 'kerb-draft',
      widthM: DEFAULT_KERB_WIDTH_M,
      heightM: DEFAULT_KERB_HEIGHT_M,
      points
    },
    true
  );
}

function drawArrowHead(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  directionRad: number,
  size: number
): void {
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(
    x - Math.cos(directionRad - Math.PI / 5) * size,
    y - Math.sin(directionRad - Math.PI / 5) * size
  );
  context.moveTo(x, y);
  context.lineTo(
    x - Math.cos(directionRad + Math.PI / 5) * size,
    y - Math.sin(directionRad + Math.PI / 5) * size
  );
  context.stroke();
}

function drawStraightArrow(context: CanvasRenderingContext2D, size: number): void {
  context.beginPath();
  context.moveTo(0, size * 0.45);
  context.lineTo(0, -size * 0.45);
  context.stroke();
  drawArrowHead(context, 0, -size * 0.45, -Math.PI / 2, size * 0.18);
}

function drawTurnArrow(
  context: CanvasRenderingContext2D,
  size: number,
  side: -1 | 1
): void {
  context.beginPath();
  context.moveTo(0, size * 0.45);
  context.lineTo(0, 0);
  context.lineTo(side * size * 0.42, 0);
  context.stroke();
  drawArrowHead(context, side * size * 0.42, 0, side === -1 ? Math.PI : 0, size * 0.16);
}

function drawStraightTurnArrow(
  context: CanvasRenderingContext2D,
  size: number,
  side: -1 | 1
): void {
  drawStraightArrow(context, size);
  context.beginPath();
  context.moveTo(0, -size * 0.05);
  context.lineTo(side * size * 0.38, -size * 0.05);
  context.stroke();
  drawArrowHead(
    context,
    side * size * 0.38,
    -size * 0.05,
    side === -1 ? Math.PI : 0,
    size * 0.14
  );
}

function drawUturnArrow(context: CanvasRenderingContext2D, size: number): void {
  context.beginPath();
  context.moveTo(size * 0.28, size * 0.45);
  context.lineTo(size * 0.28, -size * 0.15);
  context.arc(0, -size * 0.15, size * 0.28, 0, Math.PI, true);
  context.lineTo(-size * 0.28, size * 0.16);
  context.stroke();
  drawArrowHead(context, -size * 0.28, size * 0.16, Math.PI / 2, size * 0.14);
}

function drawZebraCrossing(context: CanvasRenderingContext2D, size: number): void {
  const stripeCount = 5;
  const stripeWidth = size * 0.11;
  const gap = size * 0.08;
  const totalWidth = stripeCount * stripeWidth + (stripeCount - 1) * gap;
  let x = -totalWidth / 2;

  for (let index = 0; index < stripeCount; index += 1) {
    context.fillRect(x, -size * 0.36, stripeWidth, size * 0.72);
    x += stripeWidth + gap;
  }
}

function drawKeepLeftChevron(context: CanvasRenderingContext2D, size: number): void {
  context.beginPath();
  context.moveTo(size * 0.2, -size * 0.38);
  context.lineTo(-size * 0.28, 0);
  context.lineTo(size * 0.2, size * 0.38);
  context.moveTo(size * 0.42, -size * 0.38);
  context.lineTo(-size * 0.06, 0);
  context.lineTo(size * 0.42, size * 0.38);
  context.stroke();
}

function drawScenery(
  context: CanvasRenderingContext2D,
  scenery: PxScenery,
  forceSelected = false
): void {
  const selected = forceSelected || isSelected('scenery', scenery.id);
  const size = Math.max(
    scenery.scaleM / state.metersPerPixel,
    18 / state.view.scale
  );

  context.save();
  context.translate(scenery.px, scenery.py);
  context.rotate((scenery.rotationDeg * Math.PI) / 180);

  if (scenery.type === 'tree') {
    context.fillStyle = selected ? '#ffffff' : '#7c4a25';
    context.fillRect(-size * 0.08, -size * 0.08, size * 0.16, size * 0.24);
    context.fillStyle = selected ? '#d9f99d' : '#15803d';
    context.beginPath();
    context.arc(0, -size * 0.12, size * 0.32, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = selected ? '#bbf7d0' : '#22c55e';
    context.beginPath();
    context.arc(-size * 0.15, -size * 0.04, size * 0.22, 0, Math.PI * 2);
    context.arc(size * 0.16, -size * 0.02, size * 0.24, 0, Math.PI * 2);
    context.fill();
  } else {
    context.fillStyle = selected ? '#d9f99d' : 'rgba(34, 197, 94, 0.78)';
    context.beginPath();
    context.ellipse(0, 0, size * 0.42, size * 0.28, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = selected ? '#ffffff' : '#166534';
    context.lineWidth = Math.max(size * 0.04, 1.5 / state.view.scale);

    for (const offset of [-0.24, -0.08, 0.08, 0.24]) {
      context.beginPath();
      context.moveTo(size * offset, size * 0.22);
      context.lineTo(size * offset * 0.3, -size * 0.24);
      context.stroke();
    }
  }

  context.restore();

  if (selected) {
    drawSelectionRing(context, scenery.px, scenery.py);
  }
}

function drawDecal(
  context: CanvasRenderingContext2D,
  decal: PxDecal,
  forceSelected = false
): void {
  const selected = forceSelected || isSelected('decal', decal.id);
  const size = Math.max(decal.scaleM / state.metersPerPixel, 16 / state.view.scale);

  context.save();
  context.translate(decal.px, decal.py);
  context.rotate((decal.rotationDeg * Math.PI) / 180);
  context.strokeStyle = selected ? '#ffffff' : '#f8fafc';
  context.fillStyle = selected ? '#ffffff' : '#f8fafc';
  context.lineWidth = Math.max(size * 0.08, 2 / state.view.scale);
  context.lineCap = 'round';
  context.lineJoin = 'round';

  if (decal.type === 'arrow_straight') {
    drawStraightArrow(context, size);
  } else if (decal.type === 'arrow_left') {
    drawTurnArrow(context, size, -1);
  } else if (decal.type === 'arrow_right') {
    drawTurnArrow(context, size, 1);
  } else if (decal.type === 'arrow_straight_left') {
    drawStraightTurnArrow(context, size, -1);
  } else if (decal.type === 'arrow_straight_right') {
    drawStraightTurnArrow(context, size, 1);
  } else if (decal.type === 'arrow_uturn') {
    drawUturnArrow(context, size);
  } else if (decal.type === 'stop_line') {
    context.fillRect(-size * 0.55, -size * 0.08, size * 1.1, size * 0.16);
  } else if (decal.type === 'zebra_crossing') {
    drawZebraCrossing(context, size);
  } else if (decal.type === 'keep_left_chevron') {
    drawKeepLeftChevron(context, size);
  } else {
    context.setLineDash([size * 0.16, size * 0.1]);
    context.beginPath();
    context.moveTo(-size * 0.55, 0);
    context.lineTo(size * 0.55, 0);
    context.stroke();
    context.setLineDash([]);
  }

  context.restore();

  if (selected) {
    drawSelectionRing(context, decal.px, decal.py);
  }
}

function drawSceneryPlacementPreview(context: CanvasRenderingContext2D): void {
  const preview = state.sceneryPlacementPreview;

  if (!preview) {
    return;
  }

  drawScenery(
    context,
    {
      id: 'scenery-preview',
      type: preview.type,
      px: preview.center.px,
      py: preview.center.py,
      rotationDeg: preview.rotationDeg,
      scaleM: preview.scaleM
    },
    true
  );
}

function drawCalibration(
  context: CanvasRenderingContext2D
): void {
  const activeStart = state.calibrationStart;
  const activeEnd = activeStart ? state.hoverImagePoint : null;

  const drawPair = (
    start: { px: number; py: number },
    end: { px: number; py: number } | null,
    color: string
  ): void => {
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 2 / state.view.scale;
    context.beginPath();
    context.arc(start.px, start.py, 6 / state.view.scale, 0, Math.PI * 2);
    context.fill();

    if (end) {
      context.beginPath();
      context.moveTo(start.px, start.py);
      context.lineTo(end.px, end.py);
      context.stroke();
      context.beginPath();
      context.arc(end.px, end.py, 6 / state.view.scale, 0, Math.PI * 2);
      context.fill();
    }
  };

  if (state.lastCalibration) {
    drawPair(
      state.lastCalibration.start,
      state.lastCalibration.end,
      'rgba(38, 208, 124, 0.95)'
    );
  }

  if (activeStart) {
    drawPair(activeStart, activeEnd, 'rgba(255, 204, 0, 0.95)');
  }
}

function drawSymbolPlacementPreview(context: CanvasRenderingContext2D): void {
  const preview = state.symbolPlacementPreview;

  if (!preview) {
    return;
  }

  if (isLineMarkingSymbol(preview.type)) {
    drawPaintedLine(
      context,
      createGiveWayLineMarking({
        id: 'symbol-preview',
        center: preview.center,
        rotationDeg: preview.rotationDeg,
        lengthM: preview.scaleM,
        widthM: DEFAULT_ROAD_MARKING_WIDTH_M,
        metersPerPixel: state.metersPerPixel
      }),
      true
    );
    return;
  }

  drawDecal(
    context,
    {
      id: 'symbol-preview',
      type: preview.type,
      px: preview.center.px,
      py: preview.center.py,
      rotationDeg: preview.rotationDeg,
      scaleM: preview.scaleM
    },
    true
  );
}

export function render(context: CanvasRenderingContext2D): void {
  const { canvas } = context;

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#0f1419';
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.translate(state.view.offsetX, state.view.offsetY);
  context.scale(state.view.scale, state.view.scale);
  context.translate(state.view.rotationCenterPx, state.view.rotationCenterPy);
  context.rotate(state.view.rotationRad);
  context.translate(-state.view.rotationCenterPx, -state.view.rotationCenterPy);

  if (state.image) {
    context.drawImage(state.image, 0, 0);
  }

  for (const line of state.paintedLines) {
    drawPaintedLine(
      context,
      line,
      isSelected('paintedLine', line.id)
    );
  }

  for (const kerbLine of state.kerbLines) {
    drawKerbLine(
      context,
      kerbLine,
      isSelected('kerbLine', kerbLine.id)
    );
  }

  for (const edge of state.edges) {
    drawEdge(
      context,
      edge,
      isSelected('edge', edge.id) ? '#ffffff' : '#26d07c',
      isSelected('edge', edge.id) ? 5 : 3
    );
  }

  for (const edge of state.edges) {
    if (isSelected('edge', edge.id)) {
      drawEdgeCurveControls(context, edge);
    }
  }

  for (const edge of state.edges) {
    drawEdgeLaneBadge(context, edge);
  }

  if (state.edgeDraft.length > 0) {
    drawEdge(
      context,
      {
        id: 'edge-draft',
        nodeIds: state.edgeDraft,
        lanes: 1,
        laneWidthM: 1,
        oneway: false,
        curveControls: state.edgeDraftCurveControls,
        markings: {
          center: 'none',
          leftEdge: 'none',
          rightEdge: 'none'
        }
      },
      '#64d2ff',
      2
    );
    drawEdgeCurveControls(context, {
      id: 'edge-draft',
      nodeIds: state.edgeDraft,
      lanes: 1,
      laneWidthM: 1,
      oneway: false,
      curveControls: state.edgeDraftCurveControls,
      markings: {
        center: 'none',
        leftEdge: 'none',
        rightEdge: 'none'
      }
    });
  }

  drawKerbDraft(context);

  for (const node of state.nodes) {
    context.fillStyle = isSelected('node', node.id) ? '#ffffff' : '#64d2ff';
    context.beginPath();
    context.arc(node.px, node.py, 4 / state.view.scale, 0, Math.PI * 2);
    context.fill();
  }

  for (const decal of state.decals) {
    drawDecal(context, decal);
  }

  drawSymbolPlacementPreview(context);

  for (const scenery of state.scenery) {
    drawScenery(context, scenery);
  }

  drawSceneryPlacementPreview(context);

  context.strokeStyle = '#ffcc00';
  context.lineWidth = 2 / state.view.scale;
  context.beginPath();
  context.moveTo(state.originPx - 10 / state.view.scale, state.originPy);
  context.lineTo(state.originPx + 10 / state.view.scale, state.originPy);
  context.moveTo(state.originPx, state.originPy - 10 / state.view.scale);
  context.lineTo(state.originPx, state.originPy + 10 / state.view.scale);
  context.stroke();

  drawCalibration(context);
}

export function findNearestSelection(px: number, py: number): Selection | null {
  const radius = VIEW_CONFIG.selectionRadiusPx / state.view.scale;
  let best: Selection | null = null;
  let bestDistance = radius;

  for (const decal of state.decals) {
    const distance = Math.hypot(px - decal.px, py - decal.py);

    if (distance < bestDistance) {
      best = { type: 'decal', id: decal.id };
      bestDistance = distance;
    }
  }

  for (const scenery of state.scenery) {
    const distance = Math.hypot(px - scenery.px, py - scenery.py);

    if (distance < bestDistance) {
      best = { type: 'scenery', id: scenery.id };
      bestDistance = distance;
    }
  }

  for (const node of state.nodes) {
    const distance = Math.hypot(px - node.px, py - node.py);

    if (distance < bestDistance) {
      best = { type: 'node', id: node.id };
      bestDistance = distance;
    }
  }

  for (const line of state.paintedLines) {
    for (let index = 0; index < line.points.length - 1; index += 1) {
      const distance = distanceToSegment(
        { px, py },
        line.points[index],
        line.points[index + 1]
      );

      if (distance < bestDistance) {
        best = { type: 'paintedLine', id: line.id };
        bestDistance = distance;
      }
    }
  }

  for (const line of state.kerbLines) {
    for (let index = 0; index < line.points.length - 1; index += 1) {
      const distance = distanceToSegment(
        { px, py },
        line.points[index],
        line.points[index + 1]
      );

      if (distance < bestDistance) {
        best = { type: 'kerbLine', id: line.id };
        bestDistance = distance;
      }
    }
  }

  for (const edge of state.edges) {
    for (let index = 0; index < edge.nodeIds.length - 1; index += 1) {
      const start = nodeForId(edge.nodeIds[index]);
      const end = nodeForId(edge.nodeIds[index + 1]);
      const curveControl = findCurveControl(
        edge,
        edge.nodeIds[index],
        edge.nodeIds[index + 1]
      );
      const distance = curveControl
        ? distanceToQuadraticBezier(
            { px, py },
            start,
            curveControl.control,
            end
          )
        : distanceToSegment(
            { px, py },
            { px: start.px, py: start.py },
            { px: end.px, py: end.py }
          );

      if (distance < bestDistance) {
        best = { type: 'edge', id: edge.id };
        bestDistance = distance;
      }
    }
  }

  return best;
}

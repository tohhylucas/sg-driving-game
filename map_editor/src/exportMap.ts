import { imageToWorld } from './geometry';
import type { EditableMap } from './state';
import type { MapData } from './schema';

const COORDINATE_SYSTEM =
  '+X right, +Y up, -Z down-screen from origin' as const;

function validateEditableMap(editable: EditableMap): void {
  if (editable.metersPerPixel <= 0) {
    throw new Error('Meters per pixel must be greater than zero.');
  }

  const nodeIds = new Set(editable.nodes.map((node) => node.id));

  for (const edge of editable.edges) {
    if (edge.nodeIds.length < 2) {
      throw new Error(`Edge ${edge.id} must contain at least two nodes.`);
    }

    if (edge.lanes < 1) {
      throw new Error(`Edge ${edge.id} must have at least one lane.`);
    }

    if (edge.laneWidthM <= 0) {
      throw new Error(`Edge ${edge.id} lane width must be greater than zero.`);
    }

    for (const nodeId of edge.nodeIds) {
      if (!nodeIds.has(nodeId)) {
        throw new Error(`Edge ${edge.id} references missing node ${nodeId}.`);
      }
    }

    for (const curveControl of edge.curveControls ?? []) {
      const fromIndex = edge.nodeIds.indexOf(curveControl.fromNodeId);
      const toIndex = edge.nodeIds.indexOf(curveControl.toNodeId);

      if (fromIndex === -1) {
        throw new Error(
          `Edge ${edge.id} curve references missing node ${curveControl.fromNodeId}.`
        );
      }

      if (toIndex === -1) {
        throw new Error(
          `Edge ${edge.id} curve references missing node ${curveControl.toNodeId}.`
        );
      }

      if (toIndex !== fromIndex + 1) {
        throw new Error(
          `Edge ${edge.id} curve controls must reference adjacent road path nodes.`
        );
      }
    }
  }

  for (const decal of editable.decals) {
    if (decal.scaleM <= 0) {
      throw new Error(`Decal ${decal.id} scale must be greater than zero.`);
    }
  }
}

export function buildMapData(editable: EditableMap): MapData {
  validateEditableMap(editable);

  const transform = {
    originPx: editable.originPx,
    originPy: editable.originPy,
    metersPerPixel: editable.metersPerPixel
  };

  return {
    version: 1,
    meta: {
      name: editable.name,
      imageWidthPx: editable.imageWidthPx,
      imageHeightPx: editable.imageHeightPx,
      metersPerPixel: editable.metersPerPixel,
      originPx: editable.originPx,
      originPy: editable.originPy,
      coordinateSystem: COORDINATE_SYSTEM
    },
    nodes: editable.nodes.map((node) => ({
      id: node.id,
      ...imageToWorld({ px: node.px, py: node.py }, transform)
    })),
    edges: editable.edges.map((edge) => {
      const curveControls = (edge.curveControls ?? []).map((curveControl) => ({
        fromNodeId: curveControl.fromNodeId,
        toNodeId: curveControl.toNodeId,
        control: imageToWorld(curveControl.control, transform)
      }));

      return {
        id: edge.id,
        nodeIds: [...edge.nodeIds],
        lanes: edge.lanes,
        laneWidthM: edge.laneWidthM,
        oneway: edge.oneway,
        markings: { ...edge.markings },
        ...(curveControls.length > 0 ? { curveControls } : {})
      };
    }),
    decals: editable.decals.map((decal) => ({
      id: decal.id,
      type: decal.type,
      ...imageToWorld({ px: decal.px, py: decal.py }, transform),
      rotationDeg: decal.rotationDeg,
      scaleM: decal.scaleM
    })),
    paintedLines: editable.paintedLines.map((line) => ({
      id: line.id,
      style: line.style,
      widthM: line.widthM,
      points: line.points.map((point, index) => ({
        id: `${line.id}-p${index + 1}`,
        ...imageToWorld(point, transform)
      }))
    }))
  };
}

export function downloadMapData(editable: EditableMap): void {
  const blob = new Blob([JSON.stringify(buildMapData(editable), null, 2)], {
    type: 'application/json'
  });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = 'mapData.json';
  link.click();
  URL.revokeObjectURL(url);
}

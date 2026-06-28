import {
  DEFAULT_LANE_WIDTH_M,
  DEFAULT_ROAD_LANES
} from './constants';
import { DEFAULT_EDGE_MARKINGS } from './state';
import type {
  EdgeMarkings,
  MapCurveControl,
  MapData,
  MapDecal,
  MapEdge,
  MapKerbLine,
  MapNode,
  MapPaintedLine,
  MapScenery,
  MarkingStyle,
  PaintedLineStyle
} from './schema';
import {
  DECAL_TYPES,
  MARKING_STYLES,
  SCENERY_TYPES,
  type DecalType,
  type SceneryType
} from './schema';
import type {
  EditableMap,
  PxKerbLine,
  PxDecal,
  PxEdge,
  PxNode,
  PxPaintedLine,
  PxScenery
} from './state';

const COORDINATE_SYSTEM =
  '+X right, +Y up, -Z down-screen from origin' as const;
const PAINTED_LINE_STYLES: readonly PaintedLineStyle[] = [
  'solid_white',
  'solid_yellow',
  'give_way_line'
];

export interface ImportedEditableMap extends EditableMap {
  readonly nodes: readonly PxNode[];
  readonly edges: readonly PxEdge[];
  readonly decals: readonly PxDecal[];
  readonly paintedLines: readonly PxPaintedLine[];
  readonly scenery: readonly PxScenery[];
  readonly kerbLines: readonly PxKerbLine[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string') {
    throw new Error(`${key} must be a string.`);
  }

  return value;
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${key} must be a finite number.`);
  }

  return value;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new Error(`${key} must be a boolean.`);
  }

  return value;
}

function readArray(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key];

  if (!Array.isArray(value)) {
    throw new Error(`${key} must be an array.`);
  }

  return value;
}

function readOptionalArray(
  record: Record<string, unknown>,
  key: string
): unknown[] {
  return record[key] === undefined ? [] : readArray(record, key);
}

function readMarkingStyle(
  record: Record<string, unknown>,
  key: string
): MarkingStyle {
  const value = record[key];

  if (
    typeof value !== 'string' ||
    !MARKING_STYLES.includes(value as MarkingStyle)
  ) {
    throw new Error(`${key} must be a supported road marking style.`);
  }

  return value as MarkingStyle;
}

function readPaintedLineStyle(
  record: Record<string, unknown>,
  key: string
): PaintedLineStyle {
  const value = record[key];

  if (
    typeof value !== 'string' ||
    !PAINTED_LINE_STYLES.includes(value as PaintedLineStyle)
  ) {
    throw new Error(`${key} must be a supported line marking style.`);
  }

  return value as PaintedLineStyle;
}

function readDecalType(record: Record<string, unknown>, key: string): DecalType {
  const value = record[key];

  if (typeof value !== 'string' || !DECAL_TYPES.includes(value as DecalType)) {
    throw new Error(`${key} must be a supported road symbol type.`);
  }

  return value as DecalType;
}

function readSceneryType(
  record: Record<string, unknown>,
  key: string
): SceneryType {
  const value = record[key];

  if (
    typeof value !== 'string' ||
    !SCENERY_TYPES.includes(value as SceneryType)
  ) {
    throw new Error(`${key} must be a supported scenery type.`);
  }

  return value as SceneryType;
}

function readMarkings(value: unknown): EdgeMarkings {
  if (value === undefined) {
    return { ...DEFAULT_EDGE_MARKINGS };
  }

  const record = readRecord(value, 'edge markings');

  return {
    center: readMarkingStyle(record, 'center'),
    leftEdge: readMarkingStyle(record, 'leftEdge'),
    rightEdge: readMarkingStyle(record, 'rightEdge')
  };
}

function readMapNode(value: unknown): MapNode {
  const record = readRecord(value, 'map node');

  return {
    id: readString(record, 'id'),
    xM: readNumber(record, 'xM'),
    yM: readNumber(record, 'yM'),
    zM: readNumber(record, 'zM')
  };
}

function readCurveControl(value: unknown): MapCurveControl {
  const record = readRecord(value, 'curve control');

  return {
    fromNodeId: readString(record, 'fromNodeId'),
    toNodeId: readString(record, 'toNodeId'),
    control: readMapNode({
      id: 'curve-control',
      ...readRecord(record.control, 'curve control point')
    })
  };
}

function readMapEdge(value: unknown): MapEdge {
  const record = readRecord(value, 'map edge');
  const curveControls =
    record.curveControls === undefined
      ? []
      : readArray(record, 'curveControls').map(readCurveControl);

  return {
    id: readString(record, 'id'),
    nodeIds: readArray(record, 'nodeIds').map((nodeId) => {
      if (typeof nodeId !== 'string') {
        throw new Error('nodeIds must contain only strings.');
      }

      return nodeId;
    }),
    lanes: readNumber(record, 'lanes'),
    laneWidthM: readNumber(record, 'laneWidthM'),
    oneway: readBoolean(record, 'oneway'),
    markings: readMarkings(record.markings),
    ...(curveControls.length > 0 ? { curveControls } : {})
  };
}

function readMapDecal(value: unknown): MapDecal {
  const record = readRecord(value, 'map decal');

  return {
    id: readString(record, 'id'),
    type: readDecalType(record, 'type'),
    xM: readNumber(record, 'xM'),
    yM: readNumber(record, 'yM'),
    zM: readNumber(record, 'zM'),
    rotationDeg: readNumber(record, 'rotationDeg'),
    scaleM: readNumber(record, 'scaleM')
  };
}

function readMapScenery(value: unknown): MapScenery {
  const record = readRecord(value, 'map scenery');

  return {
    id: readString(record, 'id'),
    type: readSceneryType(record, 'type'),
    xM: readNumber(record, 'xM'),
    yM: readNumber(record, 'yM'),
    zM: readNumber(record, 'zM'),
    rotationDeg: readNumber(record, 'rotationDeg'),
    scaleM: readNumber(record, 'scaleM')
  };
}

function readPaintedLine(value: unknown): MapPaintedLine {
  const record = readRecord(value, 'line marking');

  return {
    id: readString(record, 'id'),
    style: readPaintedLineStyle(record, 'style'),
    widthM: readNumber(record, 'widthM'),
    points: readArray(record, 'points').map(readMapNode)
  };
}

function readKerbLine(value: unknown): MapKerbLine {
  const record = readRecord(value, 'kerb line');

  return {
    id: readString(record, 'id'),
    widthM: readNumber(record, 'widthM'),
    heightM: readNumber(record, 'heightM'),
    points: readArray(record, 'points').map(readMapNode)
  };
}

function readMapData(value: unknown): MapData {
  const record = readRecord(value, 'map data');

  if (readNumber(record, 'version') !== 1) {
    throw new Error('Only mapData.json version 1 can be imported.');
  }

  const meta = readRecord(record.meta, 'map metadata');
  const coordinateSystem = readString(meta, 'coordinateSystem');

  if (coordinateSystem !== COORDINATE_SYSTEM) {
    throw new Error('Imported map uses an unsupported coordinate system.');
  }

  const metersPerPixel = readNumber(meta, 'metersPerPixel');

  if (metersPerPixel <= 0) {
    throw new Error('Imported map metersPerPixel must be greater than zero.');
  }

  return {
    version: 1,
    meta: {
      name: readString(meta, 'name'),
      imageWidthPx: readNumber(meta, 'imageWidthPx'),
      imageHeightPx: readNumber(meta, 'imageHeightPx'),
      metersPerPixel,
      originPx: readNumber(meta, 'originPx'),
      originPy: readNumber(meta, 'originPy'),
      coordinateSystem: COORDINATE_SYSTEM
    },
    nodes: readArray(record, 'nodes').map(readMapNode),
    edges: readArray(record, 'edges').map(readMapEdge),
    decals: readArray(record, 'decals').map(readMapDecal),
    paintedLines: readOptionalArray(record, 'paintedLines').map(readPaintedLine),
    scenery: readOptionalArray(record, 'scenery').map(readMapScenery),
    kerbLines: readOptionalArray(record, 'kerbLines').map(readKerbLine)
  };
}

function importedEdges(mapData: MapData): PxEdge[] {
  if (mapData.edges.length > 0) {
    return mapData.edges.map((edge) => ({
      id: edge.id,
      nodeIds: [...edge.nodeIds],
      lanes: edge.lanes,
      laneWidthM: edge.laneWidthM,
      oneway: edge.oneway,
      markings: { ...edge.markings },
      curveControls: (edge.curveControls ?? []).map((curveControl) => ({
        fromNodeId: curveControl.fromNodeId,
        toNodeId: curveControl.toNodeId,
        control: worldToImage(curveControl.control, mapData.meta)
      }))
    }));
  }

  if (mapData.nodes.length < 2) {
    return [];
  }

  return [
    {
      id: 'e1',
      nodeIds: mapData.nodes.map((node) => node.id),
      lanes: DEFAULT_ROAD_LANES,
      laneWidthM: DEFAULT_LANE_WIDTH_M,
      oneway: false,
      markings: { ...DEFAULT_EDGE_MARKINGS },
      curveControls: []
    }
  ];
}

function worldToImage(
  point: Pick<MapNode, 'xM' | 'zM'>,
  meta: MapData['meta']
): { readonly px: number; readonly py: number } {
  return {
    px: meta.originPx + point.xM / meta.metersPerPixel,
    py: meta.originPy - point.zM / meta.metersPerPixel
  };
}

function importNode(node: MapNode, meta: MapData['meta']): PxNode {
  return {
    id: node.id,
    ...worldToImage(node, meta)
  };
}

export function importMapData(mapData: MapData): ImportedEditableMap {
  return {
    name: mapData.meta.name,
    imageWidthPx: mapData.meta.imageWidthPx,
    imageHeightPx: mapData.meta.imageHeightPx,
    metersPerPixel: mapData.meta.metersPerPixel,
    originPx: mapData.meta.originPx,
    originPy: mapData.meta.originPy,
    nodes: mapData.nodes.map((node) => importNode(node, mapData.meta)),
    edges: importedEdges(mapData),
    decals: mapData.decals.map((decal) => ({
      id: decal.id,
      type: decal.type,
      ...worldToImage(decal, mapData.meta),
      rotationDeg: decal.rotationDeg,
      scaleM: decal.scaleM
    })),
    paintedLines: mapData.paintedLines.map((line) => ({
      id: line.id,
      style: line.style,
      widthM: line.widthM,
      points: line.points.map((point) => worldToImage(point, mapData.meta))
    })),
    scenery: mapData.scenery.map((scenery) => ({
      id: scenery.id,
      type: scenery.type,
      ...worldToImage(scenery, mapData.meta),
      rotationDeg: scenery.rotationDeg,
      scaleM: scenery.scaleM
    })),
    kerbLines: mapData.kerbLines.map((line) => ({
      id: line.id,
      widthM: line.widthM,
      heightM: line.heightM,
      points: line.points.map((point) => worldToImage(point, mapData.meta))
    }))
  };
}

export function parseMapDataJson(jsonText: string): MapData {
  return readMapData(JSON.parse(jsonText) as unknown);
}

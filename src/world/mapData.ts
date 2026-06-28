export type MapMarkingStyle =
  | 'none'
  | 'solid_white'
  | 'dashed_white'
  | 'double_white'
  | 'solid_yellow';

export interface MapEdgeMarkings {
  readonly center: MapMarkingStyle;
  readonly leftEdge: MapMarkingStyle;
  readonly rightEdge: MapMarkingStyle;
}

export interface MapNode {
  readonly id: string;
  readonly xM: number;
  readonly yM: number;
  readonly zM: number;
}

export interface MapCurveControl {
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly control: MapNode;
}

export interface MapEdge {
  readonly id: string;
  readonly nodeIds: readonly string[];
  readonly lanes: number;
  readonly laneWidthM: number;
  readonly oneway: boolean;
  readonly markings: MapEdgeMarkings;
  readonly curveControls?: readonly MapCurveControl[];
}

export type MapDecalType =
  | 'arrow_straight'
  | 'arrow_left'
  | 'arrow_right'
  | 'arrow_straight_left'
  | 'arrow_straight_right'
  | 'arrow_uturn'
  | 'stop_line'
  | 'give_way_line'
  | 'zebra_crossing'
  | 'keep_left_chevron';

export interface MapDecal {
  readonly id: string;
  readonly type: MapDecalType;
  readonly xM: number;
  readonly yM: number;
  readonly zM: number;
  readonly rotationDeg: number;
  readonly scaleM: number;
}

export type MapPaintedLineStyle =
  | 'solid_white'
  | 'solid_yellow'
  | 'give_way_line';

export interface MapPaintedLine {
  readonly id: string;
  readonly style: MapPaintedLineStyle;
  readonly widthM: number;
  readonly points: readonly MapNode[];
}

export interface MapData {
  readonly version: 1;
  readonly meta: {
    readonly name: string;
    readonly imageWidthPx: number;
    readonly imageHeightPx: number;
    readonly metersPerPixel: number;
    readonly originPx: number;
    readonly originPy: number;
    readonly coordinateSystem: '+X right, +Y up, -Z down-screen from origin';
  };
  readonly nodes: readonly MapNode[];
  readonly edges: readonly MapEdge[];
  readonly decals: readonly MapDecal[];
  readonly paintedLines: readonly MapPaintedLine[];
}

const COORDINATE_SYSTEM =
  '+X right, +Y up, -Z down-screen from origin' as const;
const MARKING_STYLES: readonly MapMarkingStyle[] = [
  'none',
  'solid_white',
  'dashed_white',
  'double_white',
  'solid_yellow'
];
const DECAL_TYPES: readonly MapDecalType[] = [
  'arrow_straight',
  'arrow_left',
  'arrow_right',
  'arrow_straight_left',
  'arrow_straight_right',
  'arrow_uturn',
  'stop_line',
  'give_way_line',
  'zebra_crossing',
  'keep_left_chevron'
];
const PAINTED_LINE_STYLES: readonly MapPaintedLineStyle[] = [
  'solid_white',
  'solid_yellow',
  'give_way_line'
];

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

function readMarkingStyle(
  record: Record<string, unknown>,
  key: string
): MapMarkingStyle {
  const value = record[key];

  if (
    typeof value !== 'string' ||
    !MARKING_STYLES.includes(value as MapMarkingStyle)
  ) {
    throw new Error(`${key} must be a supported road marking style.`);
  }

  return value as MapMarkingStyle;
}

function readDecalType(
  record: Record<string, unknown>,
  key: string
): MapDecalType {
  const value = record[key];

  if (typeof value !== 'string' || !DECAL_TYPES.includes(value as MapDecalType)) {
    throw new Error(`${key} must be a supported road symbol type.`);
  }

  return value as MapDecalType;
}

function readPaintedLineStyle(
  record: Record<string, unknown>,
  key: string
): MapPaintedLineStyle {
  const value = record[key];

  if (
    typeof value !== 'string' ||
    !PAINTED_LINE_STYLES.includes(value as MapPaintedLineStyle)
  ) {
    throw new Error(`${key} must be a supported painted line style.`);
  }

  return value as MapPaintedLineStyle;
}

function readNode(value: unknown): MapNode {
  const record = readRecord(value, 'map node');

  return {
    id: readString(record, 'id'),
    xM: readNumber(record, 'xM'),
    yM: readNumber(record, 'yM'),
    zM: readNumber(record, 'zM')
  };
}

function readMarkings(value: unknown): MapEdgeMarkings {
  const record = readRecord(value, 'edge markings');

  return {
    center: readMarkingStyle(record, 'center'),
    leftEdge: readMarkingStyle(record, 'leftEdge'),
    rightEdge: readMarkingStyle(record, 'rightEdge')
  };
}

function readCurveControl(value: unknown): MapCurveControl {
  const record = readRecord(value, 'curve control');

  return {
    fromNodeId: readString(record, 'fromNodeId'),
    toNodeId: readString(record, 'toNodeId'),
    control: readNode({
      id: 'curve-control',
      ...readRecord(record.control, 'curve control point')
    })
  };
}

function readEdge(value: unknown): MapEdge {
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

function readDecal(value: unknown): MapDecal {
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

function readPaintedLine(value: unknown): MapPaintedLine {
  const record = readRecord(value, 'painted line');

  return {
    id: readString(record, 'id'),
    style: readPaintedLineStyle(record, 'style'),
    widthM: readNumber(record, 'widthM'),
    points: readArray(record, 'points').map(readNode)
  };
}

export function parseMapData(value: unknown): MapData {
  const record = readRecord(value, 'map data');

  if (readNumber(record, 'version') !== 1) {
    throw new Error('Only mapData.json version 1 can be loaded.');
  }

  const meta = readRecord(record.meta, 'map metadata');
  const metersPerPixel = readNumber(meta, 'metersPerPixel');
  const coordinateSystem = readString(meta, 'coordinateSystem');

  if (coordinateSystem !== COORDINATE_SYSTEM) {
    throw new Error('Map data uses an unsupported coordinate system.');
  }

  if (metersPerPixel <= 0) {
    throw new Error('metersPerPixel must be greater than zero.');
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
    nodes: readArray(record, 'nodes').map(readNode),
    edges: readArray(record, 'edges').map(readEdge),
    decals: readArray(record, 'decals').map(readDecal),
    paintedLines: readArray(record, 'paintedLines').map(readPaintedLine)
  };
}

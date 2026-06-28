export type MarkingStyle =
  | 'none'
  | 'solid_white'
  | 'dashed_white'
  | 'double_white'
  | 'solid_yellow';

export const MARKING_STYLES: readonly MarkingStyle[] = [
  'none',
  'solid_white',
  'dashed_white',
  'double_white',
  'solid_yellow'
];

export interface EdgeMarkings {
  readonly center: MarkingStyle;
  readonly leftEdge: MarkingStyle;
  readonly rightEdge: MarkingStyle;
}

export interface MapCurveControl {
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly control: {
    readonly xM: number;
    readonly yM: number;
    readonly zM: number;
  };
}

export type DecalType =
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

export const DECAL_TYPES: readonly DecalType[] = [
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

export type PaintedLineStyle = 'solid_white' | 'solid_yellow' | 'give_way_line';

export interface MapNode {
  readonly id: string;
  readonly xM: number;
  readonly yM: number;
  readonly zM: number;
}

export interface MapEdge {
  readonly id: string;
  readonly nodeIds: readonly string[];
  readonly lanes: number;
  readonly laneWidthM: number;
  readonly oneway: boolean;
  readonly markings: EdgeMarkings;
  readonly curveControls?: readonly MapCurveControl[];
}

export interface MapDecal {
  readonly id: string;
  readonly type: DecalType;
  readonly xM: number;
  readonly yM: number;
  readonly zM: number;
  readonly rotationDeg: number;
  readonly scaleM: number;
}

export interface MapPaintedLine {
  readonly id: string;
  readonly style: PaintedLineStyle;
  readonly widthM: number;
  readonly points: readonly MapNode[];
}

export type SceneryType = 'tree' | 'grass';

export const SCENERY_TYPES: readonly SceneryType[] = ['tree', 'grass'];

export interface MapScenery {
  readonly id: string;
  readonly type: SceneryType;
  readonly xM: number;
  readonly yM: number;
  readonly zM: number;
  readonly rotationDeg: number;
  readonly scaleM: number;
}

export interface MapKerbLine {
  readonly id: string;
  readonly widthM: number;
  readonly heightM: number;
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
  readonly scenery: readonly MapScenery[];
  readonly kerbLines: readonly MapKerbLine[];
}

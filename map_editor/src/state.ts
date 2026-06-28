import {
  DEFAULT_DECAL_SCALE_M,
  DEFAULT_KERB_HEIGHT_M,
  DEFAULT_KERB_WIDTH_M,
  DEFAULT_LANE_WIDTH_M,
  DEFAULT_MAP_NAME,
  DEFAULT_METERS_PER_PIXEL,
  DEFAULT_ROAD_LANES
} from './constants';
import type { ImagePoint, ViewTransform } from './geometry';
import type {
  DecalType,
  EdgeMarkings,
  MarkingStyle,
  PaintedLineStyle,
  SceneryType
} from './schema';

export type Tool =
  | 'select'
  | 'edge'
  | 'decal'
  | 'scenery'
  | 'kerb'
  | 'calibrate'
  | 'origin'
  | 'erase';

export interface PxNode {
  readonly id: string;
  px: number;
  py: number;
}

export interface PxEdge {
  readonly id: string;
  nodeIds: string[];
  lanes: number;
  laneWidthM: number;
  oneway: boolean;
  markings: EdgeMarkings;
  curveControls: PxCurveControl[];
}

export interface PxCurveControl {
  readonly fromNodeId: string;
  readonly toNodeId: string;
  control: ImagePoint;
}

export interface PxDecal {
  readonly id: string;
  type: DecalType;
  px: number;
  py: number;
  rotationDeg: number;
  scaleM: number;
}

export interface PxPaintedLine {
  readonly id: string;
  readonly style: PaintedLineStyle;
  readonly widthM: number;
  points: ImagePoint[];
}

export interface PxScenery {
  readonly id: string;
  type: SceneryType;
  px: number;
  py: number;
  rotationDeg: number;
  scaleM: number;
}

export interface PxKerbLine {
  readonly id: string;
  readonly widthM: number;
  readonly heightM: number;
  points: ImagePoint[];
}

export interface CalibrationPreview {
  readonly start: ImagePoint;
  readonly end: ImagePoint;
  readonly metersPerPixel: number;
}

export interface SymbolPlacementPreview {
  readonly type: DecalType;
  readonly center: ImagePoint;
  pointer: ImagePoint;
  rotationDeg: number;
  scaleM: number;
}

export interface SceneryPlacementPreview {
  readonly type: SceneryType;
  readonly center: ImagePoint;
  pointer: ImagePoint;
  rotationDeg: number;
  scaleM: number;
}

export interface EditableMap {
  readonly name: string;
  readonly imageWidthPx: number;
  readonly imageHeightPx: number;
  readonly metersPerPixel: number;
  readonly originPx: number;
  readonly originPy: number;
  readonly nodes: readonly PxNode[];
  readonly edges: readonly PxEdge[];
  readonly decals: readonly PxDecal[];
  readonly paintedLines: readonly PxPaintedLine[];
  readonly scenery: readonly PxScenery[];
  readonly kerbLines: readonly PxKerbLine[];
}

export interface EditorSnapshot {
  readonly name: string;
  readonly imageWidthPx: number;
  readonly imageHeightPx: number;
  readonly metersPerPixel: number;
  readonly originPx: number;
  readonly originPy: number;
  readonly nodes: readonly PxNode[];
  readonly edges: readonly PxEdge[];
  readonly decals: readonly PxDecal[];
  readonly paintedLines: readonly PxPaintedLine[];
  readonly scenery: readonly PxScenery[];
  readonly kerbLines: readonly PxKerbLine[];
  readonly decalType: DecalType;
  readonly sceneryType: SceneryType;
  readonly calibrationDistanceM: number;
  readonly edgeDraft: readonly string[];
  readonly edgeDraftCurveControls: readonly PxCurveControl[];
  readonly kerbDraft: readonly ImagePoint[];
  readonly calibrationStart: ImagePoint | null;
  readonly lastCalibration: CalibrationPreview | null;
  readonly currentSymbolScaleM: number;
  readonly currentSceneryScaleM: number;
  readonly symbolPlacementPreview: SymbolPlacementPreview | null;
  readonly sceneryPlacementPreview: SceneryPlacementPreview | null;
  readonly selection: Selection | null;
}

export type Selection =
  | { readonly type: 'node'; readonly id: string }
  | { readonly type: 'edge'; readonly id: string }
  | { readonly type: 'decal'; readonly id: string }
  | { readonly type: 'paintedLine'; readonly id: string }
  | { readonly type: 'scenery'; readonly id: string }
  | { readonly type: 'kerbLine'; readonly id: string };

export const DEFAULT_EDGE_MARKINGS: EdgeMarkings = {
  center: 'dashed_white',
  leftEdge: 'solid_white',
  rightEdge: 'solid_white'
};

export class EditorState {
  name = DEFAULT_MAP_NAME;
  image: HTMLImageElement | null = null;
  imageWidthPx = 0;
  imageHeightPx = 0;
  metersPerPixel = DEFAULT_METERS_PER_PIXEL;
  originPx = 0;
  originPy = 0;
  nodes: PxNode[] = [];
  edges: PxEdge[] = [];
  decals: PxDecal[] = [];
  paintedLines: PxPaintedLine[] = [];
  scenery: PxScenery[] = [];
  kerbLines: PxKerbLine[] = [];
  tool: Tool = 'select';
  decalType: DecalType = 'arrow_straight';
  sceneryType: SceneryType = 'tree';
  calibrationDistanceM = DEFAULT_LANE_WIDTH_M;
  currentSymbolScaleM = DEFAULT_DECAL_SCALE_M;
  currentSceneryScaleM = DEFAULT_DECAL_SCALE_M;
  edgeDraft: string[] = [];
  edgeDraftCurveControls: PxCurveControl[] = [];
  kerbDraft: ImagePoint[] = [];
  calibrationStart: ImagePoint | null = null;
  hoverImagePoint: ImagePoint | null = null;
  lastCalibration: CalibrationPreview | null = null;
  symbolPlacementPreview: SymbolPlacementPreview | null = null;
  sceneryPlacementPreview: SceneryPlacementPreview | null = null;
  selection: Selection | null = null;
  undoStack: EditorSnapshot[] = [];
  view: ViewTransform = {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    rotationRad: 0,
    rotationCenterPx: 0,
    rotationCenterPy: 0
  };
  private idCounter = 1;

  createId(prefix: string): string {
    const id = `${prefix}${this.idCounter}`;
    this.idCounter += 1;
    return id;
  }

  resetIdCounterFromIds(ids: readonly string[]): void {
    let highestIdNumber = 0;

    for (const id of ids) {
      const match = /^([a-z]+)(\d+)$/i.exec(id);

      if (match) {
        highestIdNumber = Math.max(highestIdNumber, Number(match[2]));
      }
    }

    this.idCounter = highestIdNumber + 1;
  }

  resetForImage(image: HTMLImageElement, name: string): void {
    this.name = name || DEFAULT_MAP_NAME;
    this.image = image;
    this.imageWidthPx = image.naturalWidth;
    this.imageHeightPx = image.naturalHeight;
    this.originPx = image.naturalWidth / 2;
    this.originPy = image.naturalHeight / 2;
    this.nodes = [];
    this.edges = [];
    this.decals = [];
    this.paintedLines = [];
    this.scenery = [];
    this.kerbLines = [];
    this.edgeDraft = [];
    this.edgeDraftCurveControls = [];
    this.kerbDraft = [];
    this.calibrationStart = null;
    this.hoverImagePoint = null;
    this.lastCalibration = null;
    this.symbolPlacementPreview = null;
    this.sceneryPlacementPreview = null;
    this.selection = null;
    this.undoStack = [];
  }

  createDefaultEdge(
    nodeIds: string[],
    curveControls: readonly PxCurveControl[] = []
  ): PxEdge {
    return {
      id: this.createId('e'),
      nodeIds,
      lanes: DEFAULT_ROAD_LANES,
      laneWidthM: DEFAULT_LANE_WIDTH_M,
      oneway: false,
      curveControls: curveControls.map((control) => ({
        fromNodeId: control.fromNodeId,
        toNodeId: control.toNodeId,
        control: { ...control.control }
      })),
      markings: { ...DEFAULT_EDGE_MARKINGS }
    };
  }

  createDecal(point: ImagePoint): PxDecal {
    return {
      id: this.createId('d'),
      type: this.decalType,
      px: point.px,
      py: point.py,
      rotationDeg: 0,
      scaleM: DEFAULT_DECAL_SCALE_M
    };
  }

  createKerbLine(points: ImagePoint[]): PxKerbLine {
    return {
      id: this.createId('k'),
      widthM: DEFAULT_KERB_WIDTH_M,
      heightM: DEFAULT_KERB_HEIGHT_M,
      points: points.map((point) => ({ ...point }))
    };
  }

  setEdgeMarking(
    edgeId: string,
    side: keyof EdgeMarkings,
    value: MarkingStyle
  ): void {
    const edge = this.edges.find((candidate) => candidate.id === edgeId);

    if (edge) {
      edge.markings = { ...edge.markings, [side]: value };
    }
  }
}

export const state = new EditorState();

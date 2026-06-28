import * as THREE from 'three';
import {
  MAP_DATA_TRACK_CONFIG,
  ROAD_CONFIG
} from '../config/constants';
import { makeGroup, makeHorizontalPlaneMesh } from '../utils/three';
import { getCenterDashCenterZMs } from './roadLayout';
import type {
  MapData,
  MapEdgeMarkings,
  MapMarkingStyle,
  MapNode,
  MapPaintedLineStyle
} from './mapData';

interface MapRoadSegment {
  readonly id: string;
  readonly center: Pick<MapNode, 'xM' | 'zM'>;
  readonly end: Pick<MapNode, 'xM' | 'zM'>;
  readonly headingRad: number;
  readonly lengthM: number;
  readonly markings: MapEdgeMarkings;
  readonly start: Pick<MapNode, 'xM' | 'zM'>;
  readonly widthM: number;
}

const HALF = 0.5;
const MIN_SEGMENT_LENGTH_M = 0.001;

export class MapDataTrack {
  readonly object: THREE.Group = makeGroup('MapDataTrack');
  readonly roadSegmentCount: number;

  constructor(mapData: MapData) {
    const roadSegments = createMapRoadSegments(mapData);

    this.roadSegmentCount = roadSegments.length;
    this.object.userData.mapName = mapData.meta.name;

    for (const segment of roadSegments) {
      this.object.add(createRoadSegmentGroup(segment));
    }

    for (const line of mapData.paintedLines) {
      for (let index = 0; index < line.points.length - 1; index += 1) {
        this.object.add(
          createLineSegmentGroup({
            id: `${line.id}-${index + 1}`,
            color: paintedLineColor(line.style),
            start: line.points[index],
            end: line.points[index + 1],
            widthM: line.widthM
          })
        );
      }
    }
  }
}

export function createMapRoadSegments(mapData: MapData): MapRoadSegment[] {
  const nodeById = new Map(mapData.nodes.map((node) => [node.id, node]));
  const roadSegments: MapRoadSegment[] = [];

  for (const edge of mapData.edges) {
    if (edge.lanes < 1 || edge.laneWidthM <= 0) {
      throw new Error(`Map edge ${edge.id} has invalid lane metadata.`);
    }

    for (let index = 0; index < edge.nodeIds.length - 1; index += 1) {
      const fromNodeId = edge.nodeIds[index];
      const toNodeId = edge.nodeIds[index + 1];
      const start = nodeById.get(fromNodeId);
      const end = nodeById.get(toNodeId);

      if (!start || !end) {
        throw new Error(`Map edge ${edge.id} references a missing node.`);
      }

      const curveControl = edge.curveControls?.find(
        (control) =>
          control.fromNodeId === fromNodeId && control.toNodeId === toNodeId
      );
      const points = curveControl
        ? sampleQuadraticCurve(start, curveControl.control, end)
        : [start, end];

      for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex += 1) {
        const segment = createRoadSegment({
          id:
            curveControl !== undefined
              ? `${edge.id}-${fromNodeId}-${toNodeId}-${pointIndex + 1}`
              : `${edge.id}-${fromNodeId}-${toNodeId}`,
          start: points[pointIndex],
          end: points[pointIndex + 1],
          widthM: edge.lanes * edge.laneWidthM,
          markings: edge.markings
        });

        if (segment.lengthM > MIN_SEGMENT_LENGTH_M) {
          roadSegments.push(segment);
        }
      }
    }
  }

  return roadSegments;
}

function sampleQuadraticCurve(
  start: MapNode,
  control: MapNode,
  end: MapNode
): MapNode[] {
  const points: MapNode[] = [start];

  for (
    let index = 1;
    index <= MAP_DATA_TRACK_CONFIG.curveSamplesPerSegment;
    index += 1
  ) {
    const t = index / MAP_DATA_TRACK_CONFIG.curveSamplesPerSegment;
    const inverseT = 1 - t;

    points.push({
      id: `${start.id}-${end.id}-sample-${index}`,
      xM:
        inverseT * inverseT * start.xM +
        2 * inverseT * t * control.xM +
        t * t * end.xM,
      yM:
        inverseT * inverseT * start.yM +
        2 * inverseT * t * control.yM +
        t * t * end.yM,
      zM:
        inverseT * inverseT * start.zM +
        2 * inverseT * t * control.zM +
        t * t * end.zM
    });
  }

  return points;
}

function createRoadSegment({
  id,
  start,
  end,
  widthM,
  markings
}: {
  readonly id: string;
  readonly end: Pick<MapNode, 'xM' | 'zM'>;
  readonly markings: MapEdgeMarkings;
  readonly start: Pick<MapNode, 'xM' | 'zM'>;
  readonly widthM: number;
}): MapRoadSegment {
  const deltaXM = end.xM - start.xM;
  const deltaZM = end.zM - start.zM;

  return {
    id,
    start,
    end,
    widthM,
    markings,
    center: {
      xM: (start.xM + end.xM) / 2,
      zM: (start.zM + end.zM) / 2
    },
    lengthM: Math.hypot(deltaXM, deltaZM),
    headingRad: Math.atan2(-deltaXM, -deltaZM)
  };
}

function createRoadSegmentGroup(segment: MapRoadSegment): THREE.Group {
  const group = makeGroup(`MapDataRoadSegment-${segment.id}`);

  group.position.set(segment.center.xM, 0, segment.center.zM);
  group.rotation.y = segment.headingRad;
  group.add(
    makeHorizontalPlaneMesh({
      name: `MapDataRoadSurface-${segment.id}`,
      widthM: segment.widthM,
      lengthM: segment.lengthM,
      color: ROAD_CONFIG.surfaceColor,
      yM: ROAD_CONFIG.surfaceYOffsetM
    })
  );
  addMarking(group, {
    id: `${segment.id}-left-edge`,
    localXM: -segment.widthM * HALF + ROAD_CONFIG.edgeLineWidthM * HALF,
    lengthM: segment.lengthM,
    style: segment.markings.leftEdge
  });
  addMarking(group, {
    id: `${segment.id}-right-edge`,
    localXM: segment.widthM * HALF - ROAD_CONFIG.edgeLineWidthM * HALF,
    lengthM: segment.lengthM,
    style: segment.markings.rightEdge
  });
  addMarking(group, {
    id: `${segment.id}-center`,
    localXM: ROAD_CONFIG.centerLineXM,
    lengthM: segment.lengthM,
    style: segment.markings.center
  });

  return group;
}

function addMarking(
  group: THREE.Group,
  {
    id,
    localXM,
    lengthM,
    style
  }: {
    readonly id: string;
    readonly lengthM: number;
    readonly localXM: number;
    readonly style: MapMarkingStyle;
  }
): void {
  if (style === 'none') {
    return;
  }

  if (style === 'dashed_white') {
    for (const dashCenterZM of getCenterDashCenterZMs(lengthM)) {
      group.add(
        makeMarkingMesh({
          id: `${id}-dash`,
          color: ROAD_CONFIG.centerLineColor,
          localXM,
          localZM: dashCenterZM,
          lengthM: ROAD_CONFIG.centerDashLengthM,
          widthM: ROAD_CONFIG.centerLineWidthM
        })
      );
    }

    return;
  }

  if (style === 'double_white') {
    for (const offsetM of [
      -MAP_DATA_TRACK_CONFIG.doubleLineOffsetM,
      MAP_DATA_TRACK_CONFIG.doubleLineOffsetM
    ]) {
      group.add(
        makeMarkingMesh({
          id: `${id}-double`,
          color: ROAD_CONFIG.centerLineColor,
          localXM: localXM + offsetM,
          localZM: 0,
          lengthM,
          widthM: ROAD_CONFIG.centerLineWidthM
        })
      );
    }

    return;
  }

  group.add(
    makeMarkingMesh({
      id,
      color: markingColor(style),
      localXM,
      localZM: 0,
      lengthM,
      widthM: ROAD_CONFIG.centerLineWidthM
    })
  );
}

function makeMarkingMesh({
  id,
  color,
  lengthM,
  localXM,
  localZM,
  widthM
}: {
  readonly color: number;
  readonly id: string;
  readonly lengthM: number;
  readonly localXM: number;
  readonly localZM: number;
  readonly widthM: number;
}): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  return makeHorizontalPlaneMesh({
    name: `MapDataMarking-${id}`,
    widthM,
    lengthM,
    color,
    xM: localXM,
    yM: ROAD_CONFIG.markingYOffsetM,
    zM: localZM
  });
}

function createLineSegmentGroup({
  id,
  color,
  end,
  start,
  widthM
}: {
  readonly color: number;
  readonly end: Pick<MapNode, 'xM' | 'zM'>;
  readonly id: string;
  readonly start: Pick<MapNode, 'xM' | 'zM'>;
  readonly widthM: number;
}): THREE.Group {
  const segment = createRoadSegment({
    id,
    start,
    end,
    widthM,
    markings: {
      center: 'none',
      leftEdge: 'none',
      rightEdge: 'none'
    }
  });
  const group = makeGroup(`MapDataPaintedLine-${id}`);

  group.position.set(segment.center.xM, 0, segment.center.zM);
  group.rotation.y = segment.headingRad;
  group.add(
    makeHorizontalPlaneMesh({
      name: `MapDataPaintedLineMesh-${id}`,
      widthM,
      lengthM: segment.lengthM,
      color,
      yM: ROAD_CONFIG.markingYOffsetM
    })
  );

  return group;
}

function markingColor(style: MapMarkingStyle): number {
  return style === 'solid_yellow'
    ? MAP_DATA_TRACK_CONFIG.yellowMarkingColor
    : ROAD_CONFIG.centerLineColor;
}

function paintedLineColor(style: MapPaintedLineStyle): number {
  return style === 'solid_yellow'
    ? MAP_DATA_TRACK_CONFIG.yellowMarkingColor
    : ROAD_CONFIG.centerLineColor;
}

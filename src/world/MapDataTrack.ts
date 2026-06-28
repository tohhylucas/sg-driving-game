import * as THREE from 'three';
import {
  MAP_DATA_TRACK_CONFIG,
  ROAD_CONFIG
} from '../config/constants';
import { makeGroup, makeHorizontalPlaneMesh } from '../utils/three';
import { getCenterDashCenterZMs } from './roadLayout';
import type {
  MapData,
  MapDecal,
  MapDecalType,
  MapEdgeMarkings,
  MapKerbLine,
  MapMarkingStyle,
  MapNode,
  MapPaintedLineStyle,
  MapScenery,
  MapSceneryType
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
const DEG_TO_RAD = Math.PI / 180;
const HORIZONTAL_SHAPE_ROTATION_X_RAD = -Math.PI / 2;
const DECAL_MARKING_Y_M = ROAD_CONFIG.markingYOffsetM + 0.004;
const DECAL_SHAPE_CONFIG = {
  minStrokeWidthM: ROAD_CONFIG.centerLineWidthM,
  strokeWidthRatio: 0.08,
  arrowHeadAngleRad: Math.PI / 5,
  straightArrowHeadRatio: 0.18,
  turnArrowHeadRatio: 0.16,
  straightTurnArrowHeadRatio: 0.14,
  stopLineLengthRatio: 1.1,
  stopLineWidthRatio: 0.16,
  zebraStripeCount: 5,
  zebraStripeWidthRatio: 0.11,
  zebraStripeGapRatio: 0.08,
  zebraStripeLengthRatio: 0.72,
  giveWayLengthRatio: 1.1,
  giveWayDashRatio: 0.16,
  giveWayGapRatio: 0.1
} as const;

interface LocalDecalPoint {
  readonly imageYM: number;
  readonly xM: number;
}

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

    for (const decal of mapData.decals) {
      this.object.add(createDecalGroup(decal));
    }

    for (const kerbLine of mapData.kerbLines) {
      for (let index = 0; index < kerbLine.points.length - 1; index += 1) {
        this.object.add(createKerbSegmentGroup(kerbLine, index));
      }
    }

    for (const scenery of mapData.scenery) {
      this.object.add(createSceneryGroup(scenery));
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

function createDecalGroup(decal: MapDecal): THREE.Group {
  const group = makeGroup(`MapDataDecal-${decal.id}-${decal.type}`);

  group.position.set(decal.xM, decal.yM, decal.zM);
  group.rotation.y = decal.rotationDeg * DEG_TO_RAD;
  addDecalSymbol(group, decal.type, decal.scaleM);

  return group;
}

function createKerbSegmentGroup(
  kerbLine: MapKerbLine,
  pointIndex: number
): THREE.Group {
  const segment = createRoadSegment({
    id: `${kerbLine.id}-${pointIndex + 1}`,
    start: kerbLine.points[pointIndex],
    end: kerbLine.points[pointIndex + 1],
    widthM: kerbLine.widthM,
    markings: {
      center: 'none',
      leftEdge: 'none',
      rightEdge: 'none'
    }
  });
  const group = makeGroup(`MapDataKerbLine-${kerbLine.id}-${pointIndex + 1}`);

  group.position.set(segment.center.xM, 0, segment.center.zM);
  group.rotation.y = segment.headingRad;

  let offsetM = 0;
  let brickIndex = 1;

  while (offsetM < segment.lengthM) {
    const brickLengthM = Math.min(
      MAP_DATA_TRACK_CONFIG.kerbBrickLengthM,
      segment.lengthM - offsetM
    );
    const color =
      brickIndex % 2 === 1
        ? MAP_DATA_TRACK_CONFIG.kerbWhiteColor
        : MAP_DATA_TRACK_CONFIG.kerbBlackColor;

    group.add(
      makeKerbBrickMesh({
        id: `${kerbLine.id}-${pointIndex + 1}-${brickIndex}`,
        color,
        heightM: kerbLine.heightM,
        lengthM: brickLengthM,
        localZM: segment.lengthM * HALF - offsetM - brickLengthM * HALF,
        widthM: kerbLine.widthM
      })
    );
    offsetM += brickLengthM;
    brickIndex += 1;
  }

  return group;
}

function makeKerbBrickMesh({
  id,
  color,
  heightM,
  lengthM,
  localZM,
  widthM
}: {
  readonly color: number;
  readonly heightM: number;
  readonly id: string;
  readonly lengthM: number;
  readonly localZM: number;
  readonly widthM: number;
}): THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial> {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(widthM, heightM, lengthM),
    new THREE.MeshBasicMaterial({ color })
  );

  mesh.name = `MapDataKerbBrick-${id}`;
  mesh.position.set(
    0,
    ROAD_CONFIG.surfaceYOffsetM + heightM * HALF,
    localZM
  );

  return mesh;
}

function createSceneryGroup(scenery: MapScenery): THREE.Group {
  const group = makeGroup(`MapDataScenery-${scenery.id}-${scenery.type}`);

  group.position.set(scenery.xM, scenery.yM, scenery.zM);
  group.rotation.y = scenery.rotationDeg * DEG_TO_RAD;
  addSceneryMeshes(group, scenery.type, scenery.scaleM);

  return group;
}

function addSceneryMeshes(
  group: THREE.Group,
  type: MapSceneryType,
  scaleM: number
): void {
  if (type === 'tree') {
    addTreeMeshes(group, scaleM);
    return;
  }

  addGrassMeshes(group, scaleM);
}

function addTreeMeshes(group: THREE.Group, scaleM: number): void {
  const trunkHeightM = scaleM * MAP_DATA_TRACK_CONFIG.treeTrunkHeightRatio;
  const trunkRadiusM = scaleM * MAP_DATA_TRACK_CONFIG.treeTrunkRadiusRatio;
  const canopyRadiusM = scaleM * MAP_DATA_TRACK_CONFIG.treeCanopyRadiusRatio;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(
      trunkRadiusM,
      trunkRadiusM * MAP_DATA_TRACK_CONFIG.treeTrunkBaseRadiusRatio,
      trunkHeightM,
      MAP_DATA_TRACK_CONFIG.treeTrunkSegments
    ),
    new THREE.MeshBasicMaterial({ color: MAP_DATA_TRACK_CONFIG.treeTrunkColor })
  );
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(
      canopyRadiusM,
      MAP_DATA_TRACK_CONFIG.treeCanopyWidthSegments,
      MAP_DATA_TRACK_CONFIG.treeCanopyHeightSegments
    ),
    new THREE.MeshBasicMaterial({ color: MAP_DATA_TRACK_CONFIG.treeCanopyColor })
  );

  trunk.name = 'MapDataTreeTrunk';
  trunk.position.y = MAP_DATA_TRACK_CONFIG.sceneryYOffsetM + trunkHeightM * HALF;
  canopy.name = 'MapDataTreeCanopy';
  canopy.position.y =
    MAP_DATA_TRACK_CONFIG.sceneryYOffsetM +
    trunkHeightM +
    canopyRadiusM * MAP_DATA_TRACK_CONFIG.treeCanopyYOffsetRatio;
  group.add(trunk, canopy);
}

function addGrassMeshes(group: THREE.Group, scaleM: number): void {
  group.add(makeGrassPatchMesh(scaleM));

  MAP_DATA_TRACK_CONFIG.grassBladeTemplates.forEach((template, index) => {
    group.add(
      makeGrassBladeMesh({
        id: `${index + 1}`,
        color: MAP_DATA_TRACK_CONFIG.grassBladeColors[template.colorIndex],
        heightM: Math.max(
          scaleM * template.heightRatio,
          MAP_DATA_TRACK_CONFIG.grassBladeMinHeightM
        ),
        widthM: Math.max(
          scaleM * template.widthRatio,
          MAP_DATA_TRACK_CONFIG.grassBladeMinWidthM
        ),
        localXM: scaleM * template.offsetXRatio,
        localZM: scaleM * template.offsetZRatio,
        yawRad: template.yawDeg * DEG_TO_RAD,
        leanRad: template.leanDeg * DEG_TO_RAD
      })
    );
  });
}

function makeGrassPatchMesh(
  scaleM: number
): THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial> {
  const radiusM = scaleM * MAP_DATA_TRACK_CONFIG.grassPatchRadiusRatio;
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radiusM * MAP_DATA_TRACK_CONFIG.grassPatchTopRadiusRatio,
      radiusM,
      MAP_DATA_TRACK_CONFIG.grassPatchHeightM,
      MAP_DATA_TRACK_CONFIG.grassPatchSegments
    ),
    new THREE.MeshBasicMaterial({ color: MAP_DATA_TRACK_CONFIG.grassPatchColor })
  );

  mesh.name = 'MapDataGrassPatch';
  mesh.position.y =
    MAP_DATA_TRACK_CONFIG.sceneryYOffsetM +
    MAP_DATA_TRACK_CONFIG.grassPatchHeightM * HALF;

  return mesh;
}

function makeGrassBladeMesh({
  id,
  color,
  heightM,
  leanRad,
  localXM,
  localZM,
  widthM,
  yawRad
}: {
  readonly color: number;
  readonly heightM: number;
  readonly id: string;
  readonly leanRad: number;
  readonly localXM: number;
  readonly localZM: number;
  readonly widthM: number;
  readonly yawRad: number;
}): THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial> {
  const halfBaseWidthM = widthM * HALF;
  const halfTipWidthM =
    halfBaseWidthM * MAP_DATA_TRACK_CONFIG.grassBladeTipWidthRatio;
  const sideControlXM =
    halfBaseWidthM * MAP_DATA_TRACK_CONFIG.grassBladeCurveSideControlRatio;
  const midHeightM =
    heightM * MAP_DATA_TRACK_CONFIG.grassBladeCurveMidHeightRatio;
  const shoulderHeightM =
    heightM * MAP_DATA_TRACK_CONFIG.grassBladeCurveShoulderHeightRatio;
  const tipControlHeightM =
    heightM * MAP_DATA_TRACK_CONFIG.grassBladeCurveTipControlHeightRatio;
  const shape = new THREE.Shape();

  shape.moveTo(-halfBaseWidthM, 0);
  shape.quadraticCurveTo(
    -sideControlXM,
    midHeightM,
    -halfTipWidthM,
    shoulderHeightM
  );
  shape.quadraticCurveTo(-halfTipWidthM * HALF, tipControlHeightM, 0, heightM);
  shape.quadraticCurveTo(
    halfTipWidthM * HALF,
    tipControlHeightM,
    halfTipWidthM,
    shoulderHeightM
  );
  shape.quadraticCurveTo(sideControlXM, midHeightM, halfBaseWidthM, 0);
  shape.closePath();

  const mesh = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
  );

  mesh.name = `MapDataGrassBlade-${id}`;
  mesh.position.set(localXM, MAP_DATA_TRACK_CONFIG.sceneryYOffsetM, localZM);
  mesh.rotation.y = yawRad;
  mesh.rotation.z = leanRad;

  return mesh;
}

function addDecalSymbol(
  group: THREE.Group,
  type: MapDecalType,
  sizeM: number
): void {
  const strokeWidthM = Math.max(
    sizeM * DECAL_SHAPE_CONFIG.strokeWidthRatio,
    DECAL_SHAPE_CONFIG.minStrokeWidthM
  );

  switch (type) {
    case 'arrow_straight':
      addStraightArrow(group, sizeM, strokeWidthM);
      return;
    case 'arrow_left':
      addTurnArrow(group, sizeM, strokeWidthM, -1);
      return;
    case 'arrow_right':
      addTurnArrow(group, sizeM, strokeWidthM, 1);
      return;
    case 'arrow_straight_left':
      addStraightTurnArrow(group, sizeM, strokeWidthM, -1);
      return;
    case 'arrow_straight_right':
      addStraightTurnArrow(group, sizeM, strokeWidthM, 1);
      return;
    case 'arrow_uturn':
      addUTurnArrow(group, sizeM, strokeWidthM);
      return;
    case 'stop_line':
      addStopLine(group, sizeM);
      return;
    case 'give_way_line':
      addGiveWayLine(group, sizeM, strokeWidthM);
      return;
    case 'zebra_crossing':
      addZebraCrossing(group, sizeM);
      return;
    case 'keep_left_chevron':
      addKeepLeftChevron(group, sizeM, strokeWidthM);
      return;
  }
}

function addStraightArrow(
  group: THREE.Group,
  sizeM: number,
  strokeWidthM: number
): void {
  addDecalLine(
    group,
    'straight-shaft',
    { xM: 0, imageYM: sizeM * 0.45 },
    { xM: 0, imageYM: -sizeM * 0.45 },
    strokeWidthM
  );
  addArrowHead(
    group,
    'straight-head',
    { xM: 0, imageYM: -sizeM * 0.45 },
    -Math.PI / 2,
    sizeM * DECAL_SHAPE_CONFIG.straightArrowHeadRatio,
    strokeWidthM
  );
}

function addTurnArrow(
  group: THREE.Group,
  sizeM: number,
  strokeWidthM: number,
  side: -1 | 1
): void {
  addDecalPolyline(
    group,
    `turn-${side}`,
    [
      { xM: 0, imageYM: sizeM * 0.45 },
      { xM: 0, imageYM: 0 },
      { xM: side * sizeM * 0.42, imageYM: 0 }
    ],
    strokeWidthM
  );
  addArrowHead(
    group,
    `turn-${side}-head`,
    { xM: side * sizeM * 0.42, imageYM: 0 },
    side === -1 ? Math.PI : 0,
    sizeM * DECAL_SHAPE_CONFIG.turnArrowHeadRatio,
    strokeWidthM
  );
}

function addStraightTurnArrow(
  group: THREE.Group,
  sizeM: number,
  strokeWidthM: number,
  side: -1 | 1
): void {
  addStraightArrow(group, sizeM, strokeWidthM);
  addDecalLine(
    group,
    `straight-turn-${side}-branch`,
    { xM: 0, imageYM: -sizeM * 0.05 },
    { xM: side * sizeM * 0.38, imageYM: -sizeM * 0.05 },
    strokeWidthM
  );
  addArrowHead(
    group,
    `straight-turn-${side}-head`,
    { xM: side * sizeM * 0.38, imageYM: -sizeM * 0.05 },
    side === -1 ? Math.PI : 0,
    sizeM * DECAL_SHAPE_CONFIG.straightTurnArrowHeadRatio,
    strokeWidthM
  );
}

function addUTurnArrow(
  group: THREE.Group,
  sizeM: number,
  strokeWidthM: number
): void {
  addDecalPolyline(
    group,
    'uturn-stem',
    [
      { xM: sizeM * 0.28, imageYM: sizeM * 0.45 },
      { xM: sizeM * 0.28, imageYM: -sizeM * 0.15 },
      { xM: -sizeM * 0.28, imageYM: -sizeM * 0.15 },
      { xM: -sizeM * 0.28, imageYM: sizeM * 0.16 }
    ],
    strokeWidthM
  );
  addArrowHead(
    group,
    'uturn-head',
    { xM: -sizeM * 0.28, imageYM: sizeM * 0.16 },
    Math.PI / 2,
    sizeM * DECAL_SHAPE_CONFIG.straightTurnArrowHeadRatio,
    strokeWidthM
  );
}

function addStopLine(group: THREE.Group, sizeM: number): void {
  const widthM = sizeM * DECAL_SHAPE_CONFIG.stopLineLengthRatio;
  const heightM = sizeM * DECAL_SHAPE_CONFIG.stopLineWidthRatio;

  addDecalRectangle(
    group,
    'stop-line',
    -widthM * HALF,
    -heightM * HALF,
    widthM,
    heightM
  );
}

function addGiveWayLine(
  group: THREE.Group,
  sizeM: number,
  strokeWidthM: number
): void {
  const totalWidthM = sizeM * DECAL_SHAPE_CONFIG.giveWayLengthRatio;
  const dashLengthM = sizeM * DECAL_SHAPE_CONFIG.giveWayDashRatio;
  const gapM = sizeM * DECAL_SHAPE_CONFIG.giveWayGapRatio;
  let xM = -totalWidthM * HALF;
  let dashIndex = 1;

  while (xM < totalWidthM * HALF) {
    const endXM = Math.min(xM + dashLengthM, totalWidthM * HALF);

    addDecalLine(
      group,
      `give-way-${dashIndex}`,
      { xM, imageYM: 0 },
      { xM: endXM, imageYM: 0 },
      strokeWidthM
    );
    xM = endXM + gapM;
    dashIndex += 1;
  }
}

function addZebraCrossing(group: THREE.Group, sizeM: number): void {
  const stripeWidthM = sizeM * DECAL_SHAPE_CONFIG.zebraStripeWidthRatio;
  const gapM = sizeM * DECAL_SHAPE_CONFIG.zebraStripeGapRatio;
  const totalWidthM =
    DECAL_SHAPE_CONFIG.zebraStripeCount * stripeWidthM +
    (DECAL_SHAPE_CONFIG.zebraStripeCount - 1) * gapM;
  let xM = -totalWidthM * HALF;

  for (let index = 0; index < DECAL_SHAPE_CONFIG.zebraStripeCount; index += 1) {
    addDecalRectangle(
      group,
      `zebra-${index + 1}`,
      xM,
      -sizeM * DECAL_SHAPE_CONFIG.zebraStripeLengthRatio * HALF,
      stripeWidthM,
      sizeM * DECAL_SHAPE_CONFIG.zebraStripeLengthRatio
    );
    xM += stripeWidthM + gapM;
  }
}

function addKeepLeftChevron(
  group: THREE.Group,
  sizeM: number,
  strokeWidthM: number
): void {
  addDecalPolyline(
    group,
    'keep-left-outer',
    [
      { xM: sizeM * 0.2, imageYM: -sizeM * 0.38 },
      { xM: -sizeM * 0.28, imageYM: 0 },
      { xM: sizeM * 0.2, imageYM: sizeM * 0.38 }
    ],
    strokeWidthM
  );
  addDecalPolyline(
    group,
    'keep-left-inner',
    [
      { xM: sizeM * 0.42, imageYM: -sizeM * 0.38 },
      { xM: -sizeM * 0.06, imageYM: 0 },
      { xM: sizeM * 0.42, imageYM: sizeM * 0.38 }
    ],
    strokeWidthM
  );
}

function addArrowHead(
  group: THREE.Group,
  id: string,
  tip: LocalDecalPoint,
  directionRad: number,
  sizeM: number,
  strokeWidthM: number
): void {
  for (const side of [-1, 1] as const) {
    const angleRad =
      directionRad + side * DECAL_SHAPE_CONFIG.arrowHeadAngleRad;

    addDecalLine(
      group,
      `${id}-${side}`,
      tip,
      {
        xM: tip.xM - Math.cos(angleRad) * sizeM,
        imageYM: tip.imageYM - Math.sin(angleRad) * sizeM
      },
      strokeWidthM
    );
  }
}

function addDecalPolyline(
  group: THREE.Group,
  id: string,
  points: readonly LocalDecalPoint[],
  strokeWidthM: number
): void {
  for (let index = 0; index < points.length - 1; index += 1) {
    addDecalLine(
      group,
      `${id}-${index + 1}`,
      points[index],
      points[index + 1],
      strokeWidthM
    );
  }
}

function addDecalLine(
  group: THREE.Group,
  id: string,
  start: LocalDecalPoint,
  end: LocalDecalPoint,
  widthM: number
): void {
  const segment = createRoadSegment({
    id,
    start: localDecalPointToWorld(start),
    end: localDecalPointToWorld(end),
    widthM,
    markings: {
      center: 'none',
      leftEdge: 'none',
      rightEdge: 'none'
    }
  });

  if (segment.lengthM <= MIN_SEGMENT_LENGTH_M) {
    return;
  }

  const lineGroup = makeGroup(`MapDataDecalLine-${id}`);

  lineGroup.position.set(segment.center.xM, 0, segment.center.zM);
  lineGroup.rotation.y = segment.headingRad;
  lineGroup.add(
    makeHorizontalPlaneMesh({
      name: `MapDataDecalMesh-${id}`,
      widthM,
      lengthM: segment.lengthM,
      color: ROAD_CONFIG.centerLineColor,
      yM: DECAL_MARKING_Y_M
    })
  );
  group.add(lineGroup);
}

function addDecalRectangle(
  group: THREE.Group,
  id: string,
  xM: number,
  imageYM: number,
  widthM: number,
  heightM: number
): void {
  addDecalShape(group, id, [
    { xM, imageYM },
    { xM: xM + widthM, imageYM },
    { xM: xM + widthM, imageYM: imageYM + heightM },
    { xM, imageYM: imageYM + heightM }
  ]);
}

function addDecalShape(
  group: THREE.Group,
  id: string,
  points: readonly LocalDecalPoint[]
): void {
  const mesh = createHorizontalShapeMesh(
    `MapDataDecalMesh-${id}`,
    points,
    ROAD_CONFIG.centerLineColor
  );

  group.add(mesh);
}

function createHorizontalShapeMesh(
  name: string,
  points: readonly LocalDecalPoint[],
  color: number
): THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial> {
  const shape = new THREE.Shape();

  shape.moveTo(points[0].xM, points[0].imageYM);
  for (let index = 1; index < points.length; index += 1) {
    shape.lineTo(points[index].xM, points[index].imageYM);
  }
  shape.closePath();

  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(HORIZONTAL_SHAPE_ROTATION_X_RAD);

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
  );

  mesh.name = name;
  mesh.position.y = DECAL_MARKING_Y_M;

  return mesh;
}

function localDecalPointToWorld(
  point: LocalDecalPoint
): Pick<MapNode, 'xM' | 'zM'> {
  return {
    xM: point.xM,
    zM: -point.imageYM
  };
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

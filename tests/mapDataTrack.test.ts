import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MAP_DATA_TRACK_CONFIG, ROAD_CONFIG } from '../src/config/constants';
import {
  MapDataTrack,
  createMapRoadSegments
} from '../src/world/MapDataTrack';
import type { MapData, MapDecalType } from '../src/world/mapData';

const baseMapData: MapData = {
  version: 1,
  meta: {
    name: 'Unit Test Map',
    imageWidthPx: 100,
    imageHeightPx: 100,
    metersPerPixel: 0.2,
    originPx: 50,
    originPy: 50,
    coordinateSystem: '+X right, +Y up, -Z down-screen from origin'
  },
  nodes: [
    { id: 'n1', xM: -1.75, yM: 0, zM: 0 },
    { id: 'n2', xM: -1.75, yM: 0, zM: -10 }
  ],
  edges: [
    {
      id: 'e1',
      nodeIds: ['n1', 'n2'],
      lanes: 2,
      laneWidthM: 3.5,
      oneway: false,
      markings: {
        center: 'dashed_white',
        leftEdge: 'solid_white',
        rightEdge: 'solid_white'
      }
    }
  ],
  decals: [],
  paintedLines: [],
  scenery: [],
  kerbLines: []
};

const supportedDecalTypes: readonly MapDecalType[] = [
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

describe('map data track rendering', () => {
  it('converts a map edge into oriented road render segments', () => {
    const [segment] = createMapRoadSegments(baseMapData);

    expect(segment.widthM).toBe(7);
    expect(segment.lengthM).toBe(10);
    expect(segment.center.xM).toBeCloseTo(-1.75);
    expect(segment.center.zM).toBeCloseTo(-5);
    expect(segment.headingRad).toBeCloseTo(0);
  });

  it('samples quadratic curve controls into renderable road segments', () => {
    const segments = createMapRoadSegments({
      ...baseMapData,
      edges: [
        {
          ...baseMapData.edges[0],
          curveControls: [
            {
              fromNodeId: 'n1',
              toNodeId: 'n2',
              control: { id: 'curve', xM: 4, yM: 0, zM: -5 }
            }
          ]
        }
      ]
    });

    expect(segments).toHaveLength(
      MAP_DATA_TRACK_CONFIG.curveSamplesPerSegment
    );
    expect(segments[0].start.xM).toBeCloseTo(-1.75);
    expect(segments.at(-1)?.end.zM).toBeCloseTo(-10);
  });

  it('renders road surfaces and markings from map data', () => {
    const track = new MapDataTrack(baseMapData);
    const segment = track.object.getObjectByName(
      'MapDataRoadSegment-e1-n1-n2'
    );

    expect(track.roadSegmentCount).toBe(1);
    expect(segment).toBeInstanceOf(THREE.Group);

    const surface = segment?.getObjectByName('MapDataRoadSurface-e1-n1-n2');
    const leftEdge = segment?.getObjectByName(
      'MapDataMarking-e1-n1-n2-left-edge'
    );

    expect(surface).toBeInstanceOf(THREE.Mesh);
    expect(leftEdge).toBeInstanceOf(THREE.Mesh);

    const surfaceMesh = surface as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.MeshBasicMaterial
    >;

    expect(surfaceMesh.geometry.parameters.width).toBe(7);
    expect(surfaceMesh.material.color.getHex()).toBe(ROAD_CONFIG.surfaceColor);
  });

  it('renders all editor road-symbol decals from map data', () => {
    const track = new MapDataTrack({
      ...baseMapData,
      decals: supportedDecalTypes.map((type, index) => ({
        id: `d${index + 1}`,
        type,
        xM: index,
        yM: 0,
        zM: -index,
        rotationDeg: index * 15,
        scaleM: 3
      }))
    });

    for (const [index, type] of supportedDecalTypes.entries()) {
      const group = track.object.getObjectByName(
        `MapDataDecal-d${index + 1}-${type}`
      );

      expect(group).toBeInstanceOf(THREE.Group);
      expect(group?.children.length).toBeGreaterThan(0);
      expect(group?.position.x).toBeCloseTo(index);
      expect(group?.position.z).toBeCloseTo(-index);
      expect(group?.rotation.y).toBeCloseTo((index * 15 * Math.PI) / 180);
    }
  });

  it('renders editor scenery and raised black-white kerbs from map data', () => {
    const track = new MapDataTrack({
      ...baseMapData,
      scenery: [
        {
          id: 's1',
          type: 'tree',
          xM: -6,
          yM: 0,
          zM: -4,
          rotationDeg: 30,
          scaleM: 4
        },
        {
          id: 's2',
          type: 'grass',
          xM: 4,
          yM: 0,
          zM: -4,
          rotationDeg: 0,
          scaleM: 3
        }
      ],
      kerbLines: [
        {
          id: 'k1',
          widthM: 0.35,
          heightM: 0.18,
          points: [
            { id: 'k1-p1', xM: -5, yM: 0, zM: 0 },
            { id: 'k1-p2', xM: -5, yM: 0, zM: -4 }
          ]
        }
      ]
    });

    const tree = track.object.getObjectByName('MapDataScenery-s1-tree');
    const grass = track.object.getObjectByName('MapDataScenery-s2-grass');
    const kerb = track.object.getObjectByName('MapDataKerbLine-k1-1');

    expect(tree).toBeInstanceOf(THREE.Group);
    expect(tree?.getObjectByName('MapDataTreeTrunk')).toBeInstanceOf(THREE.Mesh);
    expect(tree?.getObjectByName('MapDataTreeCanopy')).toBeInstanceOf(THREE.Mesh);
    expect(tree?.rotation.y).toBeCloseTo((30 * Math.PI) / 180);
    expect(grass).toBeInstanceOf(THREE.Group);

    const grassPatch = grass?.getObjectByName('MapDataGrassPatch');
    const grassBlades = grass?.children.filter((child) =>
      child.name.startsWith('MapDataGrassBlade-')
    );
    const firstGrassBlade = grass?.getObjectByName('MapDataGrassBlade-1');

    expect(grassPatch).toBeInstanceOf(THREE.Mesh);
    expect(grassBlades).toHaveLength(
      MAP_DATA_TRACK_CONFIG.grassBladeTemplates.length
    );
    expect(firstGrassBlade).toBeInstanceOf(THREE.Mesh);
    expect(
      (firstGrassBlade as THREE.Mesh).geometry
    ).toBeInstanceOf(THREE.ShapeGeometry);
    expect(
      (firstGrassBlade as THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>)
        .material.side
    ).toBe(THREE.DoubleSide);
    expect(
      new Set(
        grassBlades?.map((blade) =>
          (
            blade as THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>
          ).material.color.getHex()
        )
      ).size
    ).toBeGreaterThan(1);
    expect(kerb).toBeInstanceOf(THREE.Group);

    const firstBrick = kerb?.getObjectByName('MapDataKerbBrick-k1-1-1');
    const secondBrick = kerb?.getObjectByName('MapDataKerbBrick-k1-1-2');

    expect(firstBrick).toBeInstanceOf(THREE.Mesh);
    expect(secondBrick).toBeInstanceOf(THREE.Mesh);
    expect(
      (
        firstBrick as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>
      ).material.color.getHex()
    ).toBe(MAP_DATA_TRACK_CONFIG.kerbWhiteColor);
    expect(
      (
        secondBrick as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>
      ).material.color.getHex()
    ).toBe(MAP_DATA_TRACK_CONFIG.kerbBlackColor);
  });
});

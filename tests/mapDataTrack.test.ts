import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MAP_DATA_TRACK_CONFIG, ROAD_CONFIG } from '../src/config/constants';
import {
  MapDataTrack,
  createMapRoadSegments
} from '../src/world/MapDataTrack';
import type { MapData } from '../src/world/mapData';

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
  paintedLines: []
};

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
});

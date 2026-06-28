import { describe, expect, it } from 'vitest';
import type { MapData } from '../src/world/mapData';
import { World } from '../src/world/World';

const previewMapData: MapData = {
  version: 1,
  meta: {
    name: 'Preview Map',
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

describe('world map preview', () => {
  it('uses the fixed test track by default', () => {
    const world = new World();

    expect(world.object.getObjectByName('TestTrack')).toBeDefined();
    expect(world.object.getObjectByName('MapDataTrack')).toBeUndefined();
  });

  it('uses a mapData track for explicit preview maps', () => {
    const world = new World(undefined, previewMapData);

    expect(world.object.getObjectByName('TestTrack')).toBeUndefined();
    expect(world.object.getObjectByName('MapDataTrack')).toBeDefined();
    expect(world.previewMapTrack?.roadSegmentCount).toBe(1);
  });
});

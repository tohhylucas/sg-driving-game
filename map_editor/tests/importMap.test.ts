import { describe, expect, it } from 'vitest';
import { buildMapData } from '../src/exportMap';
import { importMapData, parseMapDataJson } from '../src/importMap';
import type { EditableMap } from '../src/state';

describe('map editor import', () => {
  it('imports exported map data back into editable pixel geometry', () => {
    const editable: EditableMap = {
      name: 'Importable Map',
      imageWidthPx: 320,
      imageHeightPx: 200,
      metersPerPixel: 0.5,
      originPx: 160,
      originPy: 100,
      nodes: [
        { id: 'n1', px: 160, py: 100 },
        { id: 'n2', px: 180, py: 120 }
      ],
      edges: [
        {
          id: 'e3',
          nodeIds: ['n1', 'n2'],
          lanes: 2,
          laneWidthM: 3.5,
          oneway: false,
          curveControls: [
            {
              fromNodeId: 'n1',
              toNodeId: 'n2',
              control: { px: 170, py: 80 }
            }
          ],
          markings: {
            center: 'dashed_white',
            leftEdge: 'solid_white',
            rightEdge: 'solid_white'
          }
        }
      ],
      decals: [
        {
          id: 'd4',
          type: 'arrow_left',
          px: 140,
          py: 90,
          rotationDeg: 45,
          scaleM: 3
        }
      ],
      paintedLines: [
        {
          id: 'l5',
          style: 'give_way_line',
          widthM: 0.15,
          points: [
            { px: 150, py: 100 },
            { px: 170, py: 100 }
          ]
        }
      ]
    };

    expect(importMapData(buildMapData(editable))).toEqual(editable);
  });

  it('parses valid mapData JSON and rejects unsupported coordinate systems', () => {
    const json = JSON.stringify({
      version: 1,
      meta: {
        name: 'Parsed Map',
        imageWidthPx: 100,
        imageHeightPx: 100,
        metersPerPixel: 1,
        originPx: 50,
        originPy: 50,
        coordinateSystem: '+X right, +Y up, -Z down-screen from origin'
      },
      nodes: [],
      edges: [],
      decals: [],
      paintedLines: []
    });

    expect(parseMapDataJson(json).meta.name).toBe('Parsed Map');

    expect(() =>
      parseMapDataJson(
        json.replace(
          '+X right, +Y up, -Z down-screen from origin',
          'unsupported'
        )
      )
    ).toThrow('Imported map uses an unsupported coordinate system.');
  });

  it('imports node-only legacy exports as one visible road path', () => {
    const mapData = parseMapDataJson(
      JSON.stringify({
        version: 1,
        meta: {
          name: 'Node Only Draft',
          imageWidthPx: 100,
          imageHeightPx: 100,
          metersPerPixel: 1,
          originPx: 50,
          originPy: 50,
          coordinateSystem: '+X right, +Y up, -Z down-screen from origin'
        },
        nodes: [
          { id: 'n1', xM: 0, yM: 0, zM: 0 },
          { id: 'n2', xM: 10, yM: 0, zM: -10 }
        ],
        edges: [],
        decals: []
      })
    );

    expect(importMapData(mapData).edges).toEqual([
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
        },
        curveControls: []
      }
    ]);
  });
});

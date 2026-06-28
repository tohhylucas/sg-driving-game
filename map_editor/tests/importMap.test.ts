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
      ],
      scenery: [
        {
          id: 's6',
          type: 'grass',
          px: 190,
          py: 110,
          rotationDeg: 15,
          scaleM: 4
        }
      ],
      kerbLines: [
        {
          id: 'k7',
          widthM: 0.35,
          heightM: 0.18,
          points: [
            { px: 160, py: 80 },
            { px: 180, py: 80 }
          ]
        }
      ]
    };

    expect(importMapData(buildMapData(editable))).toEqual(editable);
  });

  it('round trips a non-center origin with symbols and line markings', () => {
    const editable: EditableMap = {
      name: 'Shifted Origin Symbols',
      imageWidthPx: 240,
      imageHeightPx: 180,
      metersPerPixel: 0.25,
      originPx: 40,
      originPy: 90,
      nodes: [
        { id: 'n1', px: 44, py: 82 },
        { id: 'n2', px: 60, py: 100 }
      ],
      edges: [
        {
          id: 'e1',
          nodeIds: ['n1', 'n2'],
          lanes: 2,
          laneWidthM: 3.5,
          oneway: false,
          curveControls: [
            {
              fromNodeId: 'n1',
              toNodeId: 'n2',
              control: { px: 52, py: 70 }
            }
          ],
          markings: {
            center: 'double_white',
            leftEdge: 'solid_white',
            rightEdge: 'solid_yellow'
          }
        }
      ],
      decals: [
        {
          id: 'd1',
          type: 'arrow_straight_right',
          px: 52,
          py: 86,
          rotationDeg: 90,
          scaleM: 3
        },
        {
          id: 'd2',
          type: 'stop_line',
          px: 36,
          py: 94,
          rotationDeg: 180,
          scaleM: 2.5
        }
      ],
      paintedLines: [
        {
          id: 'l1',
          style: 'give_way_line',
          widthM: 0.15,
          points: [
            { px: 40, py: 90 },
            { px: 48, py: 90 }
          ]
        }
      ],
      scenery: [
        {
          id: 's1',
          type: 'tree',
          px: 56,
          py: 78,
          rotationDeg: 45,
          scaleM: 4
        },
        {
          id: 's2',
          type: 'grass',
          px: 32,
          py: 98,
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
            { px: 36, py: 90 },
            { px: 52, py: 90 }
          ]
        }
      ]
    };

    const mapData = buildMapData(editable);

    expect(mapData.nodes).toEqual([
      { id: 'n1', xM: 1, yM: 0, zM: 2 },
      { id: 'n2', xM: 5, yM: 0, zM: -2.5 }
    ]);
    expect(mapData.decals).toEqual([
      {
        id: 'd1',
        type: 'arrow_straight_right',
        xM: 3,
        yM: 0,
        zM: 1,
        rotationDeg: 90,
        scaleM: 3
      },
      {
        id: 'd2',
        type: 'stop_line',
        xM: -1,
        yM: 0,
        zM: -1,
        rotationDeg: 180,
        scaleM: 2.5
      }
    ]);
    expect(mapData.paintedLines[0]?.points).toEqual([
      { id: 'l1-p1', xM: 0, yM: 0, zM: 0 },
      { id: 'l1-p2', xM: 2, yM: 0, zM: 0 }
    ]);
    expect(mapData.scenery).toEqual([
      {
        id: 's1',
        type: 'tree',
        xM: 4,
        yM: 0,
        zM: 3,
        rotationDeg: 45,
        scaleM: 4
      },
      {
        id: 's2',
        type: 'grass',
        xM: -2,
        yM: 0,
        zM: -2,
        rotationDeg: 0,
        scaleM: 3
      }
    ]);
    expect(mapData.kerbLines).toEqual([
      {
        id: 'k1',
        widthM: 0.35,
        heightM: 0.18,
        points: [
          { id: 'k1-p1', xM: -1, yM: 0, zM: 0 },
          { id: 'k1-p2', xM: 3, yM: 0, zM: 0 }
        ]
      }
    ]);
    expect(importMapData(mapData)).toEqual(editable);
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

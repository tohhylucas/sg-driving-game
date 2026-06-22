import { describe, expect, it } from 'vitest';
import { buildMapData } from '../src/exportMap';
import { state, type EditableMap } from '../src/state';
import { commitPendingRoadPathForExport } from '../src/tools';

describe('map editor export', () => {
  it('exports editable pixel data into the game map contract', () => {
    const editable: EditableMap = {
      name: 'Test Circuit',
      imageWidthPx: 200,
      imageHeightPx: 100,
      metersPerPixel: 0.5,
      originPx: 100,
      originPy: 50,
      nodes: [
        { id: 'n1', px: 100, py: 50 },
        { id: 'n2', px: 120, py: 70 }
      ],
      edges: [
        {
          id: 'e1',
          nodeIds: ['n1', 'n2'],
          lanes: 2,
          laneWidthM: 3.5,
          oneway: false,
          curveControls: [],
          markings: {
            center: 'dashed_white',
            leftEdge: 'solid_white',
            rightEdge: 'solid_white'
          }
        }
      ],
      decals: [
        {
          id: 'd1',
          type: 'arrow_straight',
          px: 90,
          py: 40,
          rotationDeg: 180,
          scaleM: 2
        }
      ],
      paintedLines: [
        {
          id: 'l1',
          style: 'solid_white',
          widthM: 0.15,
          points: [
            { px: 100, py: 50 },
            { px: 100, py: 70 }
          ]
        }
      ]
    };

    expect(buildMapData(editable)).toEqual({
      version: 1,
      meta: {
        name: 'Test Circuit',
        imageWidthPx: 200,
        imageHeightPx: 100,
        metersPerPixel: 0.5,
        originPx: 100,
        originPy: 50,
        coordinateSystem: '+X right, +Y up, -Z down-screen from origin'
      },
      nodes: [
        { id: 'n1', xM: 0, yM: 0, zM: 0 },
        { id: 'n2', xM: 10, yM: 0, zM: -10 }
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
      decals: [
        {
          id: 'd1',
          type: 'arrow_straight',
          xM: -5,
          yM: 0,
          zM: 5,
          rotationDeg: 180,
          scaleM: 2
        }
      ],
      paintedLines: [
        {
          id: 'l1',
          style: 'solid_white',
          widthM: 0.15,
          points: [
            { id: 'l1-p1', xM: 0, yM: 0, zM: 0 },
            { id: 'l1-p2', xM: 0, yM: 0, zM: -10 }
          ]
        }
      ]
    });
  });

  it('rejects edges that reference missing nodes', () => {
    const editable: EditableMap = {
      name: 'Broken Map',
      imageWidthPx: 100,
      imageHeightPx: 100,
      metersPerPixel: 1,
      originPx: 0,
      originPy: 0,
      nodes: [{ id: 'n1', px: 0, py: 0 }],
      edges: [
        {
          id: 'e1',
          nodeIds: ['n1', 'missing-node'],
          lanes: 2,
          laneWidthM: 3.5,
          oneway: false,
          curveControls: [],
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

    expect(() => buildMapData(editable)).toThrow(
      'Edge e1 references missing node missing-node.'
    );
  });

  it('exports road path curve controls in game coordinates', () => {
    const editable: EditableMap = {
      name: 'Curved Road',
      imageWidthPx: 200,
      imageHeightPx: 100,
      metersPerPixel: 0.5,
      originPx: 100,
      originPy: 50,
      nodes: [
        { id: 'n1', px: 100, py: 50 },
        { id: 'n2', px: 120, py: 70 }
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
              control: { px: 110, py: 30 }
            }
          ],
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

    expect(buildMapData(editable).edges[0]).toEqual({
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
      curveControls: [
        {
          fromNodeId: 'n1',
          toNodeId: 'n2',
          control: { xM: 5, yM: 0, zM: 10 }
        }
      ]
    });
  });

  it('commits a pending road path before export so lines round trip', () => {
    state.nodes = [
      { id: 'n1', px: 100, py: 50 },
      { id: 'n2', px: 120, py: 70 }
    ];
    state.edges = [];
    state.decals = [];
    state.paintedLines = [];
    state.edgeDraft = ['n1', 'n2'];
    state.edgeDraftCurveControls = [];
    state.name = 'Pending Road';
    state.imageWidthPx = 200;
    state.imageHeightPx = 100;
    state.metersPerPixel = 0.5;
    state.originPx = 100;
    state.originPy = 50;
    state.undoStack = [];
    state.resetIdCounterFromIds([]);

    expect(commitPendingRoadPathForExport()).toBe(true);
    expect(buildMapData(state).edges).toEqual([
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
    ]);
  });
});

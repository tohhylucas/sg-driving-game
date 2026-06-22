import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ROAD_CONFIG } from '../src/config/constants';
import { TestTrack } from '../src/world/TestTrack';

describe('TestTrack rendering', () => {
  it('renders the T-junction side road with an obvious solid white floor line', () => {
    const track = new TestTrack();
    const sideRoadGroup = track.object.getObjectByName(
      'RoadSegment-t-junction-side-road'
    );

    expect(sideRoadGroup).toBeInstanceOf(THREE.Group);

    const solidLine = sideRoadGroup?.getObjectByName(
      'SideRoadSolidLine-t-junction-side-road'
    );
    const genericDash = sideRoadGroup?.children.find((child) =>
      child.name.startsWith('CenterLineDash-t-junction-side-road')
    );

    expect(solidLine).toBeInstanceOf(THREE.Mesh);
    expect(genericDash).toBeUndefined();

    const mesh = solidLine as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.MeshBasicMaterial
    >;

    expect(mesh.position.x).toBeCloseTo(ROAD_CONFIG.centerLineXM);
    expect(mesh.geometry.parameters.width).toBe(
      ROAD_CONFIG.sideRoadSolidLineWidthM
    );
    expect(mesh.geometry.parameters.height).toBeGreaterThan(
      ROAD_CONFIG.roadWidthM
    );
    expect(mesh.material.color.getHex()).toBe(ROAD_CONFIG.stopLineColor);
  });
});

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CarState } from '../src/types';
import { ChaseCamera } from '../src/camera/ChaseCamera';
import { COCKPIT_CAMERA_CONFIG } from '../src/config/constants';

describe('ChaseCamera', () => {
  const carState: CarState = {
    position: { x: 10, y: 0.01, z: -5 },
    headingRad: 0,
    speedMps: 0
  };

  it('follows behind the car with configurable lateral offset', () => {
    const lateralOffsetM = 1.25;
    const chaseCamera = new ChaseCamera({ lateralOffsetM });

    chaseCamera.update(carState);

    expect(chaseCamera.camera.position.x).toBeCloseTo(
      carState.position.x + lateralOffsetM
    );
    expect(chaseCamera.camera.position.y).toBeGreaterThan(carState.position.y);
    expect(chaseCamera.camera.position.z).toBeGreaterThan(carState.position.z);
  });

  it('supports a configurable lateral view offset', () => {
    const centeredCamera = new ChaseCamera({ viewLateralOffsetM: 0 });
    const offsetCamera = new ChaseCamera({ viewLateralOffsetM: 1 });
    const centeredDirection = new THREE.Vector3();
    const offsetDirection = new THREE.Vector3();

    centeredCamera.update(carState);
    offsetCamera.update(carState);
    centeredCamera.camera.getWorldDirection(centeredDirection);
    offsetCamera.camera.getWorldDirection(offsetDirection);

    expect(offsetDirection.x).toBeGreaterThan(centeredDirection.x);
  });

  it('applies the configured right-hand-drive cockpit viewpoint offset', () => {
    const chaseCamera = new ChaseCamera(COCKPIT_CAMERA_CONFIG);
    const direction = new THREE.Vector3();

    chaseCamera.update(carState);
    chaseCamera.camera.getWorldDirection(direction);

    expect(chaseCamera.camera.position.x).toBeGreaterThan(carState.position.x);
    expect(direction.x).toBeGreaterThan(0);
  });
});

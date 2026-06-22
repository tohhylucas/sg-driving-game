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

  it('applies the configured right-hand-drive driver-seat viewpoint', () => {
    const chaseCamera = new ChaseCamera(COCKPIT_CAMERA_CONFIG);
    const direction = new THREE.Vector3();

    chaseCamera.update(carState);
    chaseCamera.camera.getWorldDirection(direction);

    expect(chaseCamera.camera.position.x).toBeGreaterThan(carState.position.x);
    expect(chaseCamera.camera.position.y).toBeLessThan(
      carState.position.y + 2
    );
    expect(chaseCamera.camera.position.z).toBeLessThan(carState.position.z);
    expect(direction.z).toBeLessThan(-0.9);
  });

  it('rotates side-look direction without translating the driver-seat position', () => {
    const centeredCamera = new ChaseCamera(COCKPIT_CAMERA_CONFIG);
    const leftLookCamera = new ChaseCamera(COCKPIT_CAMERA_CONFIG);
    const rightLookCamera = new ChaseCamera(COCKPIT_CAMERA_CONFIG);
    const centeredDirection = new THREE.Vector3();
    const leftDirection = new THREE.Vector3();
    const rightDirection = new THREE.Vector3();

    centeredCamera.update(carState);
    leftLookCamera.update(carState, { lookYawRad: -Math.PI / 2 });
    rightLookCamera.update(carState, { lookYawRad: Math.PI / 2 });
    centeredCamera.camera.getWorldDirection(centeredDirection);
    leftLookCamera.camera.getWorldDirection(leftDirection);
    rightLookCamera.camera.getWorldDirection(rightDirection);

    expect(leftLookCamera.camera.position.x).toBeCloseTo(
      centeredCamera.camera.position.x
    );
    expect(leftLookCamera.camera.position.z).toBeCloseTo(
      centeredCamera.camera.position.z
    );
    expect(rightLookCamera.camera.position.x).toBeCloseTo(
      centeredCamera.camera.position.x
    );
    expect(rightLookCamera.camera.position.z).toBeCloseTo(
      centeredCamera.camera.position.z
    );
    expect(leftDirection.x).toBeLessThan(centeredDirection.x);
    expect(rightDirection.x).toBeGreaterThan(centeredDirection.x);
  });
});

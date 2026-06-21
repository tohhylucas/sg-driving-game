import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MirrorCamera } from '../src/camera/MirrorCamera';
import { MIRROR_CONFIG } from '../src/config/constants';
import type { CarState } from '../src/types';

describe('MirrorCamera', () => {
  const carState: CarState = {
    position: { x: 0, y: 0.01, z: 0 },
    headingRad: 0,
    speedMps: 0
  };

  it('uses configured render target dimensions', () => {
    const mirror = new MirrorCamera(MIRROR_CONFIG.rearview.camera);

    expect(mirror.renderTarget.width).toBe(
      MIRROR_CONFIG.rearview.camera.renderTargetWidthPx
    );
    expect(mirror.renderTarget.height).toBe(
      MIRROR_CONFIG.rearview.camera.renderTargetHeightPx
    );

    mirror.dispose();
  });

  it('points the rearview camera behind the forward-facing car', () => {
    const mirror = new MirrorCamera(MIRROR_CONFIG.rearview.camera);
    const direction = new THREE.Vector3();

    mirror.update(carState);
    mirror.camera.getWorldDirection(direction);

    expect(direction.z).toBeGreaterThan(0);

    mirror.dispose();
  });

  it('points side mirrors behind and toward their side of the car', () => {
    const left = new MirrorCamera(MIRROR_CONFIG.leftSide.camera);
    const right = new MirrorCamera(MIRROR_CONFIG.rightSide.camera);
    const leftDirection = new THREE.Vector3();
    const rightDirection = new THREE.Vector3();

    left.update(carState);
    right.update(carState);
    left.camera.getWorldDirection(leftDirection);
    right.camera.getWorldDirection(rightDirection);

    expect(leftDirection.z).toBeGreaterThan(0);
    expect(leftDirection.x).toBeLessThan(0);
    expect(rightDirection.z).toBeGreaterThan(0);
    expect(rightDirection.x).toBeGreaterThan(0);

    left.dispose();
    right.dispose();
  });
});

import { describe, expect, it } from 'vitest';
import {
  calculateMetersPerPixel,
  distanceToQuadraticBezier,
  imageToScreen,
  imageToWorld,
  quadraticBezierPoint,
  screenToImage
} from '../src/geometry';

describe('map editor geometry helpers', () => {
  it('calibrates meters per pixel from two image points and a known distance', () => {
    expect(
      calculateMetersPerPixel(
        { px: 10, py: 10 },
        { px: 10, py: 45 },
        3.5
      )
    ).toBeCloseTo(0.1);
  });

  it('rejects invalid calibration distances', () => {
    expect(() =>
      calculateMetersPerPixel(
        { px: 10, py: 10 },
        { px: 10, py: 10 },
        3.5
      )
    ).toThrow('Calibration points must be different.');

    expect(() =>
      calculateMetersPerPixel(
        { px: 10, py: 10 },
        { px: 20, py: 10 },
        0
      )
    ).toThrow('Calibration distance must be greater than zero.');
  });

  it('maps image pixels to game meters with +X right and -Z down-screen', () => {
    expect(
      imageToWorld(
        { px: 125, py: 160 },
        { originPx: 100, originPy: 100, metersPerPixel: 0.2 }
      )
    ).toEqual({ xM: 5, yM: 0, zM: -12 });
  });

  it('converts screen coordinates through pan and zoom into image pixels', () => {
    expect(
      screenToImage(
        {
          scale: 2,
          offsetX: 40,
          offsetY: 10,
          rotationRad: 0,
          rotationCenterPx: 0,
          rotationCenterPy: 0
        },
        { x: 140, y: 70 }
      )
    ).toEqual({ px: 50, py: 30 });
  });

  it('round-trips image and screen points through a rotated map view', () => {
    const view = {
      scale: 2,
      offsetX: 200,
      offsetY: 100,
      rotationRad: Math.PI / 2,
      rotationCenterPx: 50,
      rotationCenterPy: 50
    };
    const imagePoint = { px: 70, py: 50 };

    const screenPoint = imageToScreen(view, imagePoint);

    expect(screenPoint.x).toBeCloseTo(300);
    expect(screenPoint.y).toBeCloseTo(240);
    expect(screenToImage(view, screenPoint)).toEqual({
      px: expect.closeTo(imagePoint.px),
      py: expect.closeTo(imagePoint.py)
    });
  });

  it('evaluates quadratic road-path curve points and distances', () => {
    const start = { px: 0, py: 0 };
    const control = { px: 50, py: 100 };
    const end = { px: 100, py: 0 };

    expect(quadraticBezierPoint(start, control, end, 0.5)).toEqual({
      px: 50,
      py: 50
    });
    expect(
      distanceToQuadraticBezier({ px: 50, py: 52 }, start, control, end)
    ).toBeLessThan(3);
  });
});

import { describe, expect, it } from 'vitest';
import {
  formatSpeedKmh,
  metersPerSecondToKmh,
  steerToWheelRotationDeg
} from '../src/ui/cockpitMetrics';

describe('cockpit metrics', () => {
  it('converts car speed to non-negative km/h for the speedometer', () => {
    expect(metersPerSecondToKmh(10)).toBeCloseTo(36);
    expect(metersPerSecondToKmh(-2)).toBeCloseTo(7.2);
  });

  it('formats speed as a rounded whole km/h value', () => {
    expect(formatSpeedKmh(7.2)).toBe('7');
    expect(formatSpeedKmh(7.6)).toBe('8');
  });

  it('maps normalized steer input to bounded wheel rotation', () => {
    expect(steerToWheelRotationDeg(0)).toBe(0);
    expect(steerToWheelRotationDeg(1)).toBeLessThan(0);
    expect(steerToWheelRotationDeg(2)).toBe(
      steerToWheelRotationDeg(1)
    );
  });
});

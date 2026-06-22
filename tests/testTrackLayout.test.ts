import { describe, expect, it } from 'vitest';
import { ROAD_CONFIG } from '../src/config/constants';
import { getFixedTestTrackLayout } from '../src/world/testTrackLayout';

describe('fixed test track layout', () => {
  it('defines a closed deterministic driving loop with Singapore keep-left lane data', () => {
    const layout = getFixedTestTrackLayout();

    expect(layout.defaultDrivingLane.side).toBe('left');
    expect(layout.defaultDrivingLane.centerOffsetM).toBeLessThan(0);
    expect(layout.defaultDrivingLane.centerOffsetM).toBeCloseTo(
      -ROAD_CONFIG.laneWidthM / 2
    );
    expect(layout.loopSegments.length).toBeGreaterThanOrEqual(4);

    for (let index = 0; index < layout.loopSegments.length; index += 1) {
      const segment = layout.loopSegments[index];
      const next =
        layout.loopSegments[(index + 1) % layout.loopSegments.length];

      expect(segment.end.xM).toBeCloseTo(next.start.xM);
      expect(segment.end.zM).toBeCloseTo(next.start.zM);
    }
  });

  it('uses multiple readable bends around the loop', () => {
    const layout = getFixedTestTrackLayout();
    const headingChanges = layout.loopSegments.filter((segment, index) => {
      const next =
        layout.loopSegments[(index + 1) % layout.loopSegments.length];

      return Math.abs(segment.headingRad - next.headingRad) > 0.1;
    });

    expect(headingChanges.length).toBeGreaterThanOrEqual(2);
    expect(
      layout.loopSegments.every(
        (segment) => segment.lengthM > ROAD_CONFIG.roadWidthM * 2
      )
    ).toBe(true);
  });

  it('includes one T-junction side road and one uncontrolled cross junction', () => {
    const layout = getFixedTestTrackLayout();

    expect(
      layout.segments.some((segment) => segment.kind === 't-junction-side-road')
    ).toBe(true);
    expect(
      layout.segments.some((segment) => segment.kind === 'cross-junction-road')
    ).toBe(true);

    const tJunctions = layout.junctions.filter(
      (junction) => junction.kind === 't-junction'
    );
    const crossJunctions = layout.junctions.filter(
      (junction) => junction.kind === 'cross-junction'
    );

    expect(tJunctions).toHaveLength(1);
    expect(crossJunctions).toHaveLength(1);
    expect(tJunctions[0].control).toBe('uncontrolled');
    expect(crossJunctions[0].control).toBe('uncontrolled');
    expect(tJunctions[0].connectedSegmentIds).toContain(
      't-junction-side-road'
    );
    expect(crossJunctions[0].connectedSegmentIds).toContain(
      'cross-junction-road'
    );
  });

  it('places stop-line markings only where M8 enforces a stop rule', () => {
    const layout = getFixedTestTrackLayout();

    expect(layout.stopLines).toEqual([
      expect.objectContaining({
        id: 't-junction-side-road-stop-line',
        junctionId: 't-junction',
        segmentId: 't-junction-side-road'
      })
    ]);
    expect(
      layout.stopLines.some((stopLine) => stopLine.junctionId === 'cross-junction')
    ).toBe(false);

    for (const stopLine of layout.stopLines) {
      expect(stopLine.kind).toBe('stop-line');
      expect(stopLine.widthM).toBe(ROAD_CONFIG.stopLineWidthM);
      expect(stopLine.lengthM).toBe(ROAD_CONFIG.roadWidthM);
      expect(
        layout.segments.some((segment) => segment.id === stopLine.segmentId)
      ).toBe(true);
    }
  });

  it('exposes the T-junction side-road stop line as a rule zone', () => {
    const layout = getFixedTestTrackLayout();
    const zone = layout.stopLineRuleZones.find(
      (candidate) => candidate.junctionId === 't-junction'
    );

    expect(zone).toEqual(
      expect.objectContaining({
        id: 't-junction-side-road-stop-line-rule-zone',
        kind: 'stop-line-rule-zone',
        stopLineId: 't-junction-side-road-stop-line',
        segmentId: 't-junction-side-road',
        crossingDirection: -1
      })
    );
    expect(zone?.approachDepthM).toBeGreaterThan(0);
    expect(zone?.widthM).toBe(ROAD_CONFIG.roadWidthM);
    expect(
      layout.stopLines.some((stopLine) => stopLine.id === zone?.stopLineId)
    ).toBe(true);
  });
});

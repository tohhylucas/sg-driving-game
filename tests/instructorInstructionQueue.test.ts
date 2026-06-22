import { describe, expect, it } from 'vitest';
import {
  InstructorInstructionQueue,
  type InstructorTtsAdapter
} from '../src/instructor/InstructorInstructionQueue';
import { DrivingSession } from '../src/rules/DrivingSession';
import { KeepLeftRule } from '../src/rules/KeepLeftRule';
import type { CarState } from '../src/types';
import { createInitialCarState } from '../src/vehicle/carState';
import {
  getFixedTestTrackLayout,
  getSegmentPointAtLocalPosition,
  type FixedTestTrackLayout,
  type TrackInstructorInstructionFeature,
  type TrackSegment
} from '../src/world/testTrackLayout';

describe('InstructorInstructionQueue', () => {
  it('queues one audio instruction when approaching a configured route feature', () => {
    const layout = getFixedTestTrackLayout();
    const feature = getInstructionFeature(layout);
    const tts = new RecordingTtsAdapter();
    const queue = new InstructorInstructionQueue({ tts });

    queue.startSession(1);
    queue.update({
      car: makeCarApproachingFeature(layout, feature, 4),
      elapsedSec: 0.25,
      track: layout
    });

    expect(tts.spokenUtterances).toEqual([feature.utterance]);
    expect(queue.diagnostics.triggeredInstructionIds).toEqual([feature.id]);
  });

  it('ignores road features that are not configured for instructor audio', () => {
    const baseLayout = getFixedTestTrackLayout();
    const feature = getInstructionFeature(baseLayout);
    const layout = withInstructionFeatures(baseLayout, []);
    const tts = new RecordingTtsAdapter();
    const queue = new InstructorInstructionQueue({ tts });

    queue.startSession(1);
    queue.update({
      car: makeCarApproachingFeature(baseLayout, feature, 4),
      elapsedSec: 0.25,
      track: layout
    });

    expect(tts.spokenUtterances).toEqual([]);
    expect(queue.diagnostics.triggeredInstructionIds).toEqual([]);
  });

  it('starts active with the session and stops accepting triggers when it ends', () => {
    const layout = getFixedTestTrackLayout();
    const feature = getInstructionFeature(layout);
    const tts = new RecordingTtsAdapter();
    const queue = new InstructorInstructionQueue({ tts });

    expect(queue.diagnostics.active).toBe(false);

    queue.startSession(1);

    expect(queue.diagnostics.active).toBe(true);

    queue.endSession();
    queue.update({
      car: makeCarApproachingFeature(layout, feature, 4),
      elapsedSec: 0.25,
      track: layout
    });

    expect(queue.diagnostics.active).toBe(false);
    expect(tts.spokenUtterances).toEqual([]);
  });

  it('does not enqueue instructor audio from scored pass or violation events', () => {
    const baseLayout = getFixedTestTrackLayout();
    const layout = withInstructionFeatures(baseLayout, []);
    const tts = new RecordingTtsAdapter();
    const queue = new InstructorInstructionQueue({ tts });
    const session = new DrivingSession({
      rules: [new KeepLeftRule({ gracePeriodSec: 1 })],
      track: layout
    });
    const wrongLaneCar = makeCarState(1.75, 0);

    session.start(createInitialCarState());
    queue.startSession(session.state.sessionId);
    session.update(wrongLaneCar, 1.1);
    session.update(wrongLaneCar, 1.1);
    queue.update({
      car: wrongLaneCar,
      elapsedSec: session.state.elapsedSec,
      track: layout
    });

    expect(session.summary.events).toEqual([
      expect.objectContaining({
        outcome: 'violation',
        ruleId: 'keep-left'
      })
    ]);
    expect(tts.spokenUtterances).toEqual([]);
  });

  it('keeps scoring feedback messages out of instructor audio', () => {
    const layout = getFixedTestTrackLayout();
    const feature = getInstructionFeature(layout);
    const tts = new RecordingTtsAdapter();
    const queue = new InstructorInstructionQueue({ tts });
    const session = new DrivingSession({
      rules: [new KeepLeftRule({ gracePeriodSec: 1 })],
      track: layout
    });
    const wrongLaneCar = makeCarState(1.75, 0);

    session.start(createInitialCarState());
    queue.startSession(session.state.sessionId);
    session.update(wrongLaneCar, 1.1);
    session.update(wrongLaneCar, 1.1);
    queue.update({
      car: makeCarApproachingFeature(layout, feature, 4),
      elapsedSec: session.state.elapsedSec,
      track: layout
    });

    const scoredMessage = session.summary.events[0]?.message;

    expect(scoredMessage).toBeTruthy();
    expect(tts.spokenUtterances).toEqual([feature.utterance]);
    expect(tts.spokenUtterances).not.toContain(scoredMessage);
  });

  it('plays queued audio in order without overlapping', async () => {
    const baseLayout = getFixedTestTrackLayout();
    const firstFeature = getInstructionFeature(baseLayout);
    const secondFeature: TrackInstructorInstructionFeature = {
      ...firstFeature,
      id: 'second-cross-junction-approach-instruction',
      triggerLocalZM: firstFeature.triggerLocalZM - 2,
      utterance: 'Second route feature ahead.'
    };
    const layout = withInstructionFeatures(baseLayout, [
      firstFeature,
      secondFeature
    ]);
    const tts = new DeferredTtsAdapter();
    const queue = new InstructorInstructionQueue({ tts });

    queue.startSession(1);
    queue.update({
      car: makeCarApproachingFeature(layout, firstFeature, 4),
      elapsedSec: 0.25,
      track: layout
    });

    expect(tts.startedUtterances).toEqual([firstFeature.utterance]);
    expect(queue.diagnostics.pendingInstructionCount).toBe(1);

    tts.finishNext();
    await Promise.resolve();

    expect(tts.startedUtterances).toEqual([
      firstFeature.utterance,
      secondFeature.utterance
    ]);
  });

  it('suppresses duplicate feature triggers within the configured cooldown', async () => {
    const baseLayout = getFixedTestTrackLayout();
    const feature = {
      ...getInstructionFeature(baseLayout),
      cooldownSec: 0.5
    };
    const layout = withInstructionFeatures(baseLayout, [feature]);
    const tts = new RecordingTtsAdapter();
    const queue = new InstructorInstructionQueue({ tts });

    queue.startSession(1);
    queue.update({
      car: makeCarApproachingFeature(layout, feature, 4),
      elapsedSec: 1,
      track: layout
    });
    await Promise.resolve();
    queue.update({
      car: makeCarApproachingFeature(layout, feature, 4),
      elapsedSec: 1.25,
      track: layout
    });
    await Promise.resolve();
    queue.update({
      car: makeCarApproachingFeature(layout, feature, 4),
      elapsedSec: 1.6,
      track: layout
    });
    await Promise.resolve();

    expect(tts.spokenUtterances).toEqual([
      feature.utterance,
      feature.utterance
    ]);
    expect(queue.diagnostics.triggeredInstructionIds).toEqual([
      feature.id,
      feature.id
    ]);
  });
});

class RecordingTtsAdapter implements InstructorTtsAdapter {
  readonly spokenUtterances: string[] = [];

  speak(utterance: string): Promise<void> {
    this.spokenUtterances.push(utterance);
    return Promise.resolve();
  }
}

class DeferredTtsAdapter implements InstructorTtsAdapter {
  readonly startedUtterances: string[] = [];
  private readonly finishCallbacks: (() => void)[] = [];

  speak(utterance: string): Promise<void> {
    this.startedUtterances.push(utterance);

    return new Promise((resolve) => {
      this.finishCallbacks.push(resolve);
    });
  }

  finishNext(): void {
    const finish = this.finishCallbacks.shift();

    if (!finish) {
      throw new Error('Expected a pending TTS utterance.');
    }

    finish();
  }
}

function withInstructionFeatures(
  layout: FixedTestTrackLayout,
  instructorInstructionFeatures: readonly TrackInstructorInstructionFeature[]
): FixedTestTrackLayout {
  return {
    ...layout,
    instructorInstructionFeatures
  };
}

function getInstructionFeature(
  layout: FixedTestTrackLayout
): TrackInstructorInstructionFeature {
  const feature = layout.instructorInstructionFeatures[0];

  if (!feature) {
    throw new Error('Expected at least one instructor instruction feature.');
  }

  return feature;
}

function makeCarState(x: number, z: number): CarState {
  return {
    position: { x, y: 0.01, z },
    headingRad: 0,
    speedMps: 0
  };
}

function makeCarApproachingFeature(
  layout: FixedTestTrackLayout,
  feature: TrackInstructorInstructionFeature,
  distanceAheadM: number
): CarState {
  const segment = getSegment(layout, feature.segmentId);
  const localZM =
    feature.triggerLocalZM - feature.approachDirection * distanceAheadM;
  const point = getSegmentPointAtLocalPosition(
    segment,
    feature.centerLocalXM,
    localZM
  );

  return {
    position: { x: point.xM, y: 0.01, z: point.zM },
    headingRad: segment.headingRad,
    speedMps: 6
  };
}

function getSegment(
  layout: FixedTestTrackLayout,
  segmentId: string
): TrackSegment {
  const segment = layout.segments.find((candidate) => candidate.id === segmentId);

  if (!segment) {
    throw new Error(`Expected test track segment ${segmentId}.`);
  }

  return segment;
}

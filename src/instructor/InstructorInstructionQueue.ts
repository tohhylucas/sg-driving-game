import { getNearestLanePosition } from '../rules/laneRules';
import type { CarState } from '../types';
import type {
  FixedTestTrackLayout,
  TrackInstructorInstructionFeature
} from '../world/testTrackLayout';

export interface InstructorTtsAdapter {
  speak(utterance: string): Promise<void>;
  cancel?(): void;
}

export interface InstructorInstructionQueueDiagnostics {
  readonly active: boolean;
  readonly configuredFeatureCount: number;
  readonly pendingInstructionCount: number;
  readonly playing: boolean;
  readonly triggeredInstructionIds: readonly string[];
}

interface InstructorInstructionQueueOptions {
  readonly tts: InstructorTtsAdapter;
}

interface InstructorInstructionQueueUpdate {
  readonly car: CarState;
  readonly elapsedSec: number;
  readonly track: FixedTestTrackLayout;
}

interface QueuedInstruction {
  readonly id: string;
  readonly utterance: string;
}

/** Queues audio-only instructor prompts from configured fixed route features. */
export class InstructorInstructionQueue {
  private readonly lastTriggeredAtSecByFeatureId = new Map<string, number>();
  private readonly pendingInstructions: QueuedInstruction[] = [];
  private readonly triggeredInstructionIds: string[] = [];
  private active = false;
  private configuredFeatureCount = 0;
  private playing = false;

  constructor(private readonly options: InstructorInstructionQueueOptions) {}

  get diagnostics(): InstructorInstructionQueueDiagnostics {
    return {
      active: this.active,
      configuredFeatureCount: this.configuredFeatureCount,
      pendingInstructionCount: this.pendingInstructions.length,
      playing: this.playing,
      triggeredInstructionIds: [...this.triggeredInstructionIds]
    };
  }

  /** Starts accepting route-feature triggers for a new driving session. */
  startSession(_sessionId: number): void {
    this.active = true;
    this.lastTriggeredAtSecByFeatureId.clear();
    this.pendingInstructions.length = 0;
    this.triggeredInstructionIds.length = 0;
  }

  /** Stops accepting route-feature triggers and clears unplayed instructions. */
  endSession(): void {
    this.active = false;
    this.pendingInstructions.length = 0;
    this.options.tts.cancel?.();
  }

  /** Enqueues any configured route-feature instruction approached by the car. */
  update({ car, elapsedSec, track }: InstructorInstructionQueueUpdate): void {
    this.configuredFeatureCount = track.instructorInstructionFeatures.length;

    if (!this.active) {
      return;
    }

    const lanePosition = getNearestLanePosition(track, {
      xM: car.position.x,
      zM: car.position.z
    });

    for (const feature of track.instructorInstructionFeatures) {
      if (
        isInsideFeatureTrigger(feature, lanePosition) &&
        !this.isWithinCooldown(feature, elapsedSec)
      ) {
        this.enqueue(feature, elapsedSec);
      }
    }
  }

  private enqueue(
    feature: TrackInstructorInstructionFeature,
    elapsedSec: number
  ): void {
    this.lastTriggeredAtSecByFeatureId.set(feature.id, elapsedSec);
    this.pendingInstructions.push({
      id: feature.id,
      utterance: feature.utterance
    });
    this.triggeredInstructionIds.push(feature.id);
    void this.playNext();
  }

  private isWithinCooldown(
    feature: TrackInstructorInstructionFeature,
    elapsedSec: number
  ): boolean {
    const lastTriggeredAtSec = this.lastTriggeredAtSecByFeatureId.get(
      feature.id
    );

    return (
      lastTriggeredAtSec !== undefined &&
      elapsedSec - lastTriggeredAtSec < feature.cooldownSec
    );
  }

  private async playNext(): Promise<void> {
    if (!this.active || this.playing) {
      return;
    }

    const instruction = this.pendingInstructions.shift();

    if (!instruction) {
      return;
    }

    this.playing = true;

    try {
      await this.options.tts.speak(instruction.utterance);
    } finally {
      this.playing = false;

      if (this.active) {
        void this.playNext();
      }
    }
  }
}

function isInsideFeatureTrigger(
  feature: TrackInstructorInstructionFeature,
  lanePosition: {
    readonly localXM: number;
    readonly localZM: number;
    readonly segmentId: string;
  }
): boolean {
  if (lanePosition.segmentId !== feature.segmentId) {
    return false;
  }

  const distanceAheadM =
    (feature.triggerLocalZM - lanePosition.localZM) *
    feature.approachDirection;

  return (
    distanceAheadM >= 0 &&
    distanceAheadM <= feature.triggerDistanceM &&
    Math.abs(lanePosition.localXM - feature.centerLocalXM) <=
      feature.triggerWidthM / 2
  );
}

import { MIRROR_CONFIG } from '../config/constants';
import type { ScoredEventSummary } from '../rules/scoring';
import type { MirrorId } from '../types';
import { InstructorAudio } from './InstructorAudio';
import { MirrorView } from './MirrorView';
import { ScoringFeedback } from './ScoringFeedback';
import { Speedometer } from './Speedometer';
import { SteeringWheel } from './SteeringWheel';

interface CockpitState {
  score: ScoredEventSummary;
  speedMps: number;
  steer: number;
}

export class Cockpit {
  readonly mirrorViews: Record<MirrorId, MirrorView>;

  private readonly instructorAudio: InstructorAudio;
  private readonly scoringFeedback: ScoringFeedback;
  private readonly speedometer: Speedometer;
  private readonly steeringWheel: SteeringWheel;

  constructor(readonly root: HTMLElement) {
    root.classList.add('cockpit');
    root.replaceChildren();

    this.mirrorViews = {
      rearview: new MirrorView(root, 'rearview', MIRROR_CONFIG.rearview.ui),
      leftSide: new MirrorView(root, 'leftSide', MIRROR_CONFIG.leftSide.ui),
      rightSide: new MirrorView(root, 'rightSide', MIRROR_CONFIG.rightSide.ui)
    };
    this.steeringWheel = new SteeringWheel(root);
    this.speedometer = new Speedometer(root);
    this.scoringFeedback = new ScoringFeedback(root);
    this.instructorAudio = new InstructorAudio(root);
  }

  /** Updates cockpit instruments from live driving state. */
  update(state: CockpitState): void {
    this.steeringWheel.setRotation(state.steer);
    this.speedometer.setSpeed(state.speedMps);
    this.scoringFeedback.update(state.score);
  }

  dispose(): void {
    this.root.classList.remove('cockpit');
    this.root.replaceChildren();
  }
}

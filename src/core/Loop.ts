import { LOOP_CONFIG } from '../config/constants';

export type UpdateFn = (dtSec: number) => void;
export type RenderFn = () => void;

export class Loop {
  private animationFrameId: number | null = null;
  private accumulatorSec = 0;
  private previousTimeMs = 0;

  start(update: UpdateFn, render: RenderFn): void {
    if (this.animationFrameId !== null) {
      return;
    }

    this.previousTimeMs = performance.now();

    const tick = (timeMs: number): void => {
      const frameDeltaSec = Math.min(
        (timeMs - this.previousTimeMs) / 1000,
        LOOP_CONFIG.maxFrameDeltaSec
      );

      this.previousTimeMs = timeMs;
      this.accumulatorSec += frameDeltaSec;

      while (this.accumulatorSec >= LOOP_CONFIG.fixedTimeStepSec) {
        update(LOOP_CONFIG.fixedTimeStepSec);
        this.accumulatorSec -= LOOP_CONFIG.fixedTimeStepSec;
      }

      render();
      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.animationFrameId === null) {
      return;
    }

    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
    this.accumulatorSec = 0;
  }
}

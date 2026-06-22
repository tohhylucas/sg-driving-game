import type { CanvasViewport, MirrorId } from '../types';

interface MirrorViewConfig {
  leftPercent: number;
  topPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export class MirrorView {
  readonly root: HTMLElement;

  constructor(
    parent: HTMLElement,
    id: MirrorId,
    private readonly config: MirrorViewConfig
  ) {
    this.root = document.createElement('div');
    this.root.className = `cockpit__mirror cockpit__mirror--${id}`;
    this.root.dataset.mirror = id;
    this.root.style.left = `${config.leftPercent}%`;
    this.root.style.top = `${config.topPercent}%`;
    this.root.style.width = `${config.widthPercent}%`;
    this.root.style.height = `${config.heightPercent}%`;
    parent.append(this.root);
  }

  /** Returns this mirror frame's viewport in canvas CSS pixels. */
  getCanvasViewport(canvas: HTMLCanvasElement): CanvasViewport | null {
    const canvasRect = canvas.getBoundingClientRect();
    const mirrorRect = this.root.getBoundingClientRect();
    const leftPx = mirrorRect.left - canvasRect.left;
    const topPx = mirrorRect.top - canvasRect.top;
    const widthPx = mirrorRect.width;
    const heightPx = mirrorRect.height;

    if (widthPx <= 0 || heightPx <= 0) {
      return null;
    }

    return {
      xPx: leftPx,
      yPx: canvasRect.height - topPx - heightPx,
      widthPx,
      heightPx
    };
  }
}

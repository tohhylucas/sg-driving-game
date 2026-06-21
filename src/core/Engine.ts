import * as THREE from 'three';
import { RENDER_CONFIG } from '../config/constants';
import type { CanvasViewport } from '../types';

export interface TextureOverlay {
  texture: THREE.Texture;
  viewport: CanvasViewport;
}

export class Engine {
  readonly scene: THREE.Scene;
  readonly clock: THREE.Clock;

  private readonly overlayCamera = new THREE.OrthographicCamera(
    -1,
    1,
    1,
    -1,
    0,
    2
  );
  private readonly overlayMaterial = new THREE.MeshBasicMaterial({
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  });
  private readonly overlayGeometry = new THREE.PlaneGeometry(2, 2);
  private readonly overlayScene = new THREE.Scene();
  private readonly renderer: THREE.WebGLRenderer;
  private viewportHeightPx = 1;
  private viewportWidthPx = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setClearColor(RENDER_CONFIG.clearColor, 1);
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, RENDER_CONFIG.maxDevicePixelRatio)
    );
    this.overlayCamera.position.z = 1;
    this.overlayScene.add(
      new THREE.Mesh(this.overlayGeometry, this.overlayMaterial)
    );
  }

  resize(width: number, height: number): void {
    this.viewportWidthPx = width;
    this.viewportHeightPx = height;
    this.renderer.setSize(width, height, false);
  }

  render(camera: THREE.Camera, overlays: TextureOverlay[] = []): void {
    this.renderer.setRenderTarget(null);
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, this.viewportWidthPx, this.viewportHeightPx);
    this.renderer.render(this.scene, camera);

    for (const overlay of overlays) {
      this.renderTextureOverlay(overlay);
    }

    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, this.viewportWidthPx, this.viewportHeightPx);
  }

  renderToTarget(camera: THREE.Camera, target: THREE.WebGLRenderTarget): void {
    const previousTarget = this.renderer.getRenderTarget();
    const previousScissorTest = this.renderer.getScissorTest();
    const previousViewport = new THREE.Vector4();
    const previousScissor = new THREE.Vector4();

    this.renderer.getViewport(previousViewport);
    this.renderer.getScissor(previousScissor);
    this.renderer.setRenderTarget(target);
    this.renderer.setScissorTest(false);
    this.renderer.clear();
    this.renderer.render(this.scene, camera);
    this.renderer.setRenderTarget(previousTarget);
    this.renderer.setViewport(
      previousViewport.x,
      previousViewport.y,
      previousViewport.z,
      previousViewport.w
    );
    this.renderer.setScissor(
      previousScissor.x,
      previousScissor.y,
      previousScissor.z,
      previousScissor.w
    );
    this.renderer.setScissorTest(previousScissorTest);
  }

  dispose(): void {
    this.overlayGeometry.dispose();
    this.overlayMaterial.dispose();
    this.renderer.dispose();
  }

  private renderTextureOverlay({ texture, viewport }: TextureOverlay): void {
    this.overlayMaterial.map = texture;
    this.overlayMaterial.needsUpdate = true;
    this.renderer.setViewport(
      viewport.xPx,
      viewport.yPx,
      viewport.widthPx,
      viewport.heightPx
    );
    this.renderer.setScissor(
      viewport.xPx,
      viewport.yPx,
      viewport.widthPx,
      viewport.heightPx
    );
    this.renderer.setScissorTest(true);
    this.renderer.render(this.overlayScene, this.overlayCamera);
  }
}

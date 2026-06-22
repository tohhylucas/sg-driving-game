export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CarState {
  position: Vec3;
  headingRad: number;
  speedMps: number;
}

export interface DriveInputState {
  throttle: number;
  brake: number;
  steer: number;
}

export interface InputState extends DriveInputState {
  look: number;
}

export type MirrorId = 'rearview' | 'leftSide' | 'rightSide';

export interface CanvasViewport {
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
}

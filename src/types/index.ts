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

export interface MovingElementState {
  id: string;
  kind: 'lead-vehicle';
  segmentId: string;
  position: Vec3;
  headingRad: number;
  speedMps: number;
  lengthM: number;
  widthM: number;
}

export interface DriveInputState {
  throttle: number;
  brake: number;
  steer: number;
}

export interface InputState extends DriveInputState {
  look: number;
  reset: boolean;
}

export type MirrorId = 'rearview' | 'leftSide' | 'rightSide';

export interface CanvasViewport {
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
}

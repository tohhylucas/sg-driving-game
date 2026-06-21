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

export interface InputState {
  throttle: number;
  brake: number;
  steer: number;
}

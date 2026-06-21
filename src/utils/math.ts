export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function wrapAngleRad(radians: number): number {
  const fullTurn = Math.PI * 2;
  return ((((radians + Math.PI) % fullTurn) + fullTurn) % fullTurn) - Math.PI;
}

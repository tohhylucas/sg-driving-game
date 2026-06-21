import * as THREE from 'three';

interface HorizontalPlaneMeshOptions {
  readonly name: string;
  readonly widthM: number;
  readonly lengthM: number;
  readonly color: number;
  readonly yM: number;
  readonly xM?: number;
  readonly zM?: number;
}

const HORIZONTAL_PLANE_ROTATION_X_RAD = -Math.PI / 2;
const ORIGIN_M = 0;

export function makeGroup(name: string): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  return group;
}

export function makeHorizontalPlaneMesh({
  name,
  widthM,
  lengthM,
  color,
  xM = ORIGIN_M,
  yM,
  zM = ORIGIN_M
}: HorizontalPlaneMeshOptions): THREE.Mesh<
  THREE.PlaneGeometry,
  THREE.MeshBasicMaterial
> {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(widthM, lengthM),
    new THREE.MeshBasicMaterial({ color })
  );

  mesh.name = name;
  mesh.rotation.x = HORIZONTAL_PLANE_ROTATION_X_RAD;
  mesh.position.set(xM, yM, zM);

  return mesh;
}

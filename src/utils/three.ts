import * as THREE from 'three';

export function makeGroup(name: string): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  return group;
}

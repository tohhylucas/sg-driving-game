import * as THREE from 'three';
import { CAR_CONFIG } from '../config/constants';
import type { CarState } from '../types';
import { makeGroup } from '../utils/three';
import { createInitialCarState } from './carState';

export class Car {
  readonly object = makeGroup('Car');

  state: CarState = createInitialCarState();

  constructor() {
    this.object.add(createBodyMesh());
    this.object.add(createRoofMesh());
    this.object.add(createWindshieldMesh());
    this.object.add(createFrontMarkerMesh());

    for (const wheel of createWheelMeshes()) {
      this.object.add(wheel);
    }

    this.syncObjectToState();
  }

  private syncObjectToState(): void {
    this.object.position.set(
      this.state.position.x,
      this.state.position.y,
      this.state.position.z
    );
    this.object.rotation.y = this.state.headingRad;
  }
}

const HALF = 0.5;
const FRONT_Z_SIGN = -1;
const REAR_Z_SIGN = 1;
const ROOF_CENTER_Z_FACTOR = 0.08;
const WHEEL_Z_OFFSET_FACTOR = 0.32;
const FRONT_MARKER_WIDTH_FACTOR = 0.72;
const FRONT_MARKER_CENTER_Y_FACTOR = 0.5;
const WINDSHIELD_WIDTH_FACTOR = 0.82;
const WINDSHIELD_HEIGHT_FACTOR = 0.6;
const WHEEL_SEGMENTS = 12;
const WHEEL_ROTATION_Z_RAD = Math.PI / 2;

function createBoxMesh(
  name: string,
  widthM: number,
  heightM: number,
  lengthM: number,
  color: number
): THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial> {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(widthM, heightM, lengthM),
    new THREE.MeshBasicMaterial({ color })
  );
  mesh.name = name;
  return mesh;
}

function createBodyMesh(): THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial> {
  const body = createBoxMesh(
    'CarBody',
    CAR_CONFIG.widthM,
    CAR_CONFIG.bodyHeightM,
    CAR_CONFIG.lengthM,
    CAR_CONFIG.bodyColor
  );

  body.position.y =
    CAR_CONFIG.wheelRadiusM + CAR_CONFIG.bodyHeightM * HALF;

  return body;
}

function createRoofMesh(): THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial> {
  const roof = createBoxMesh(
    'CarRoof',
    CAR_CONFIG.roofWidthM,
    CAR_CONFIG.roofHeightM,
    CAR_CONFIG.roofLengthM,
    CAR_CONFIG.roofColor
  );

  roof.position.y =
    CAR_CONFIG.wheelRadiusM +
    CAR_CONFIG.bodyHeightM +
    CAR_CONFIG.roofHeightM * HALF;
  roof.position.z = CAR_CONFIG.lengthM * ROOF_CENTER_Z_FACTOR;

  return roof;
}

function createWindshieldMesh(): THREE.Mesh<
  THREE.BoxGeometry,
  THREE.MeshBasicMaterial
> {
  const windshield = createBoxMesh(
    'FrontWindshield',
    CAR_CONFIG.roofWidthM * WINDSHIELD_WIDTH_FACTOR,
    CAR_CONFIG.roofHeightM * WINDSHIELD_HEIGHT_FACTOR,
    CAR_CONFIG.frontMarkerLengthM,
    CAR_CONFIG.windshieldColor
  );

  windshield.position.y =
    CAR_CONFIG.wheelRadiusM +
    CAR_CONFIG.bodyHeightM +
    (CAR_CONFIG.roofHeightM * WINDSHIELD_HEIGHT_FACTOR) * HALF;
  windshield.position.z =
    CAR_CONFIG.lengthM * ROOF_CENTER_Z_FACTOR -
    CAR_CONFIG.roofLengthM * HALF -
    CAR_CONFIG.frontMarkerLengthM * HALF;

  return windshield;
}

function createFrontMarkerMesh(): THREE.Mesh<
  THREE.BoxGeometry,
  THREE.MeshBasicMaterial
> {
  const marker = createBoxMesh(
    'FrontDirectionMarker',
    CAR_CONFIG.widthM * FRONT_MARKER_WIDTH_FACTOR,
    CAR_CONFIG.frontMarkerHeightM,
    CAR_CONFIG.frontMarkerLengthM,
    CAR_CONFIG.frontMarkerColor
  );

  marker.position.y =
    CAR_CONFIG.wheelRadiusM +
    CAR_CONFIG.bodyHeightM * FRONT_MARKER_CENTER_Y_FACTOR;
  marker.position.z =
    FRONT_Z_SIGN * (CAR_CONFIG.lengthM * HALF + CAR_CONFIG.frontMarkerLengthM * HALF);

  return marker;
}

function createWheelMeshes(): THREE.Mesh<
  THREE.CylinderGeometry,
  THREE.MeshBasicMaterial
>[] {
  const wheelMaterial = new THREE.MeshBasicMaterial({
    color: CAR_CONFIG.wheelColor
  });
  const wheelCentersXM = [
    -CAR_CONFIG.widthM * HALF,
    CAR_CONFIG.widthM * HALF
  ] as const;
  const wheelCentersZM = [
    FRONT_Z_SIGN * CAR_CONFIG.lengthM * WHEEL_Z_OFFSET_FACTOR,
    REAR_Z_SIGN * CAR_CONFIG.lengthM * WHEEL_Z_OFFSET_FACTOR
  ] as const;

  return wheelCentersXM.flatMap((xM) =>
    wheelCentersZM.map((zM) => {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(
          CAR_CONFIG.wheelRadiusM,
          CAR_CONFIG.wheelRadiusM,
          CAR_CONFIG.wheelWidthM,
          WHEEL_SEGMENTS
        ),
        wheelMaterial
      );

      wheel.name = 'CarWheel';
      wheel.rotation.z = WHEEL_ROTATION_Z_RAD;
      wheel.position.set(xM, CAR_CONFIG.wheelRadiusM, zM);

      return wheel;
    })
  );
}

# Issue 12 Acceptance Checklist

| Criterion | Evidence |
| --- | --- |
| W accelerates the car. | `tests/input.test.ts`; M6 browser log `accelerated.speedMps > initial.speedMps`. |
| Releasing W while no brake/reverse input is held automatically decelerates the car toward zero speed using configurable coasting deceleration/drag. | `tests/kinematic.test.ts`; M6 browser log `coasted.speedMps < beforeCoast.speedMps`. |
| Coasting deceleration does not reverse the car by itself. | `tests/kinematic.test.ts`. |
| Coasting deceleration is weaker than active braking and is distinct from the staged S brake/reverse behavior. | `tests/kinematic.test.ts`; `VEHICLE_CONFIG.coastDecelerationMps2`. |
| S brakes and then reverses according to the staged brake/reverse behavior. | `tests/kinematic.test.ts`; M6 browser log `reversed.speedMps < 0`. |
| Left/Right arrows steer the wheel and drive the existing steering-wheel UI. | `tests/input.test.ts`; M6 browser log `steering.steer > initial.steer`. |
| The main driving camera is positioned at a right-hand-drive in-car driver-seat viewpoint inside/near the car cabin, not behind the car as an exterior chase camera. | `tests/chaseCamera.test.ts`; M6 browser log asserts low camera height and forward cabin placement. |
| The main driving camera faces forward down the road from the driver-seat viewpoint. | `tests/chaseCamera.test.ts` checks forward camera direction. |
| The main view remains readable from inside the car; the exterior car mesh must not block the road view. | `src/core/Game.ts` hides the exterior car only for the main camera pass after mirror render targets are captured. |
| A rotates the in-car driver-seat camera left for blind-spot inspection without translating the driver-seat mount. | `tests/input.test.ts`; `tests/blindSpotCameraLook.test.ts`; `tests/chaseCamera.test.ts`; M6 browser log `leftLook.cameraLookYawRad < beforeLook.cameraLookYawRad`. |
| D rotates the in-car driver-seat camera right for blind-spot inspection without translating the driver-seat mount. | `tests/input.test.ts`; `tests/blindSpotCameraLook.test.ts`; `tests/chaseCamera.test.ts`; M6 browser log `rightLook.cameraLookYawRad > returnedFromLeft.cameraLookYawRad`. |
| Releasing A or D returns the camera smoothly to the normal forward driver-seat view. | `tests/blindSpotCameraLook.test.ts`; M6 browser log return samples move toward zero. |
| A/D no longer steer the car. | `tests/input.test.ts`. |
| Camera-look usage does not emit scored events. | No scoring/rule modules are introduced in this slice; camera look only updates `ChaseCamera` yaw. |
| Coasting and driver-seat camera values live in shared config rather than feature-local magic numbers. | `VEHICLE_CONFIG.coastDecelerationMps2`; `COCKPIT_CAMERA_CONFIG`. |
| Unit tests cover W/S input mapping, accelerator-release coasting deceleration, coasting clamping at zero, staged brake/reverse behavior, driver-seat camera placement/orientation, and any extractable camera-look state logic. | `npm test` passed locally. |
| `ARCHITECTURE.md` is updated if camera responsibilities or file structure change. | `ARCHITECTURE.md` documents the driver-seat main pass and camera responsibilities. |
| `PLAN.md` is updated with the M6 delivery note after implementation. | `PLAN.md` M6 is marked `[DONE]` with delivery note. |
| `npm test` and `npm run build` pass. | Both commands passed locally. |

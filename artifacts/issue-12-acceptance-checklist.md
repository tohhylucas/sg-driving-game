# Issue 12 Acceptance Checklist

| Criterion | Evidence |
| --- | --- |
| W accelerates the car. | `tests/input.test.ts`; M6 browser log `accelerated.speedMps > initial.speedMps`. |
| Releasing W while no brake/reverse input is held automatically decelerates the car toward zero speed using configurable coasting deceleration/drag. | `tests/kinematic.test.ts`; M6 browser log `coasted.speedMps < beforeCoast.speedMps`. |
| Coasting deceleration does not reverse the car by itself. | `tests/kinematic.test.ts`. |
| Coasting deceleration is weaker than active braking and is distinct from the staged S brake/reverse behavior. | `tests/kinematic.test.ts`; `VEHICLE_CONFIG.coastDecelerationMps2`. |
| S brakes and then reverses according to the staged brake/reverse behavior. | `tests/kinematic.test.ts`; M6 browser log `reversed.speedMps < 0`. |
| Left/Right arrows steer the wheel and drive the existing steering-wheel UI. | `tests/input.test.ts`; M6 browser log `steering.steer > initial.steer`. |
| A shifts the in-car viewpoint left for blind-spot inspection. | `tests/input.test.ts`; `tests/blindSpotCameraShift.test.ts`; M6 browser log `leftLook.cameraShiftM < beforeLook.cameraShiftM`. |
| D shifts the in-car viewpoint right for blind-spot inspection. | `tests/input.test.ts`; `tests/blindSpotCameraShift.test.ts`; M6 browser log `rightLook.cameraShiftM > returnedFromLeft.cameraShiftM`. |
| Releasing A or D returns the camera smoothly to the normal cockpit/chase viewpoint. | `tests/blindSpotCameraShift.test.ts`; M6 browser log return samples move toward zero. |
| A/D no longer steer the car. | `tests/input.test.ts`. |
| Camera-shift usage does not emit scored events. | No scoring/rule modules are introduced in this slice; camera shift only updates `ChaseCamera` offset. |
| Coasting values live in shared config rather than feature-local magic numbers. | `VEHICLE_CONFIG.coastDecelerationMps2`. |
| Unit tests cover W/S input mapping, accelerator-release coasting deceleration, coasting clamping at zero, staged brake/reverse behavior, and any extractable camera-offset state logic. | `npm test` passed with 40 tests. |
| `PLAN.md` is updated with the M6 delivery note after implementation. | `PLAN.md` M6 is marked `[DONE]` with delivery note. |
| `npm test` and `npm run build` pass. | Both commands passed locally. |

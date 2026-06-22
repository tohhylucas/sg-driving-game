# Issue 5 Acceptance Evidence Checklist

- Cockpit overlay above the M3 chase-camera driving view: verify `#ui-overlay[data-phase="m4"]`, cockpit DOM, and full-page recording.
- Main driving view slightly right-offset for Singapore right-hand-drive presentation: verify `COCKPIT_CAMERA_CONFIG` is applied to `ChaseCamera` and visible in recording.
- Steering wheel placed for right-hand drive and rotates with live steering input: verify right-side wheel placement plus changing `data-steer` during CDP steering input.
- Speedometer displays live speed in km/h from car state: verify increasing `data-speed-kmh` during CDP acceleration input.
- Rearview, left side, and right side mirrors use real render targets: verify three `MirrorCamera` instances render to `WebGLRenderTarget`s and are composited into HUD mirror frames.
- Mirrors update live as the car moves and turns: verify full-page recording while acceleration and steering inputs run.
- Mirror frames display useful scene geometry behind/beside the car: verify recorded mirror regions show road/ground/markings from distinct rear and side camera directions.
- Instructor caption is reworked as an audio placeholder: verify `InstructorAudio` exists and no `InstructorCaption` surface remains.
- No on-screen instructor text, transcript, readable prompt, queued instruction logic, scoring, or rule feedback: verify audio placeholder has empty text content and overlay has no caption element.
- UI constants, mirror sizes, and placement values live in shared config: verify M4 camera/HUD/mirror constants in `src/config/constants.ts`.
- PLAN.md marks M4 done with a short delivery note: verify after implementation and tests.
- `npm test` and `npm run build` pass: verify command output or record exact blocker.
- Manual/browser verification: run `npm run test:browser -- --artifact-prefix issue-5 --expected-phase m4` and retain recording/log artifacts.

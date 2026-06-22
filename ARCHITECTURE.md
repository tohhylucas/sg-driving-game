# ARCHITECTURE.md - Project Architecture (Phase 1)

## Tech Stack

- Rendering: Three.js
- Language: TypeScript in strict mode
- Build/dev: Vite
- Testing: Vitest
- Physics: none in Phase 1. Use a kinematic bicycle model only.

## Setup Guidance

Scripts in `package.json`:

- `dev`: `vite`
- `build`: `tsc && vite build`
- `test`: `vitest run`

`tsconfig.json` must keep `"strict": true`.

## Coordinate Conventions

- World axes: `+X` = right, `+Y` = up, `-Z` = forward.
- A car driving forward moves toward `-Z`.
- The left lane is the default/correct driving lane. With forward = `-Z`, the
  left lane sits on the `-X` side of the center line.
- Steering: positive steer angle = turn toward driver's left.
- All lane and road dimensions come from `src/config/constants.ts`.
- Singaporean accuracy takes precedence over visual mockup shortcuts. For the
  initial straight road, use white lane markings unless a Singapore-specific
  restriction marking requires another color.

## Rendering & UI Strategy

The screen is composed in layers:

1. Main 3D pass: full-window render of the world from the right-hand-drive
   driver-seat camera.
2. Mirror passes: separate `MirrorCamera`s render the scene into
   `WebGLRenderTarget`s. These should be composited into the cockpit as the
   rearview and side-mirror images. The implementation may use scissored
   viewport sub-passes or textured HUD quads, but mirrors must show real scene
   geometry.
3. HUD overlay: steering wheel, speedometer, mirror frames, and instructor
   audio placeholder sit in an HTML overlay above the canvas.

Mirrors must be real 3D because they are core to the game's real-world utility.
Speedometer, wheel, mirror frames, and the audio placeholder are pure 2D and
remain cheaper and cleaner as DOM.

## Folder Structure

```text
driving-game/
|-- AGENTS.md
|-- PLAN.md
|-- ARCHITECTURE.md
|-- index.html
|-- package.json
|-- tsconfig.json
|-- vite.config.ts
|-- public/
|-- src/
|   |-- main.ts
|   |-- styles.css
|   |-- core/
|   |   |-- Engine.ts
|   |   |-- Game.ts
|   |   |-- Loop.ts
|   |   `-- Input.ts
|   |-- world/
|   |   |-- World.ts
|   |   |-- Ground.ts
|   |   |-- Sky.ts
|   |   |-- Road.ts
|   |   |-- RoadMarkings.ts
|   |   |-- roadLayout.ts
|   |   |-- testTrackLayout.ts
|   |   `-- TestTrack.ts
|   |-- vehicle/
|   |   |-- Car.ts
|   |   |-- carState.ts
|   |   |-- KinematicModel.ts
|   |   `-- CarController.ts
|   |-- camera/
|   |   |-- BlindSpotCameraLook.ts
|   |   |-- ChaseCamera.ts
|   |   `-- MirrorCamera.ts
|   |-- rules/
|   |   |-- DrivingSession.ts
|   |   |-- finishZone.ts
|   |   |-- KeepLeftRule.ts
|   |   |-- laneRules.ts
|   |   `-- scoring.ts
|   |-- ui/
|   |   |-- Cockpit.ts
|   |   |-- InstructorAudio.ts
|   |   |-- MirrorView.ts
|   |   |-- ScoringFeedback.ts
|   |   |-- SteeringWheel.ts
|   |   |-- Speedometer.ts
|   |   `-- cockpitMetrics.ts
|   |-- config/
|   |   |-- constants.ts
|   |   `-- controls.ts
|   |-- utils/
|   |   |-- math.ts
|   |   `-- three.ts
|   `-- types/
|       `-- index.ts
`-- tests/
    |-- carState.test.ts
    |-- kinematic.test.ts
    `-- math.test.ts
```

## Module Responsibilities

- `Engine.ts`: owns `WebGLRenderer`, root `Scene`, and `Clock`. Exposes
  main-scene rendering, mirror render-target rendering, and texture overlay
  compositing. No game logic.
- `Game.ts`: composition root. Instantiates world, car, cameras, and UI as
  milestones introduce them. Exposes read-only dev diagnostics for local
  browser smoke verification; diagnostics must not mutate gameplay.
- `Loop.ts`: fixed-timestep accumulator so movement is frame-rate independent.
- `Input.ts`: tracks pressed keys and exposes normalized driving and
  blind-spot look input state plus session reset input.
- `KinematicModel.ts`: pure logic for bicycle-model integration. No Three.js
  imports. Must be unit-tested when implemented.
- `Car.ts`: renders the exterior placeholder car and syncs its scene transform
  from `CarState`.
- `carState.ts`: pure initial parked-car state derived from shared car and road
  config, including the Singapore keep-left spawn convention.
- `CarController.ts`: adapter from driving input to model to Three.js car
  transform.
- `ChaseCamera.ts`: car-relative driving camera. M6 configures it as a
  right-hand-drive driver-seat camera, while older tests still cover its
  general car-following offset behavior.
- `BlindSpotCameraLook.ts`: pure, testable smoothing state for A/D driver-seat
  side-look yaw. It rotates the camera view direction only and does not emit
  scoring events or affect vehicle motion.
- `DrivingSession.ts`: pure session lifecycle and scored-event aggregation.
  Sessions start when the game starts or resets, end at the finish zone, and
  keep rule modules active only while the session is active. It also exposes
  read-only rule diagnostics for debug HUDs without mutating gameplay.
- `KeepLeftRule.ts`: always-active Phase 2 keep-left rule. It observes car
  state, emits one violation per continuous wrong-lane episode after a
  configurable grace period, allows new episodes after returning left or
  entering a new road segment, and emits a pass only when a clean route reaches
  the finish zone.
- `laneRules.ts`: pure lane-side and default-lane helpers for fixed track
  segments.
- `finishZone.ts`: pure finish-gate containment helper.
- `scoring.ts`: shared scored-event shape and pass/violation aggregation.
- `MirrorCamera.ts`: camera and render target for a mirror, mounted from live
  car state.
- `MirrorView.ts`: places a mirror render target into a cockpit frame and
  reports the matching canvas viewport for compositing.
- `InstructorAudio.ts`: audio-only instructor placeholder. It exposes no
  instruction text or caption API in Phase 1.
- `ScoringFeedback.ts`: minimal feedback HUD for scored pass/violation counts
  plus rule diagnostics such as keep-left grace period and lane-side debug
  state. It is separate from instructor audio.
- `cockpitMetrics.ts`: pure speedometer and steering-wheel presentation
  helpers.
- `config/constants.ts`: single source of truth for tunable numbers and colors.
- `World.ts`: composes the static sky, ground, and M5 fixed test track.
- `Road.ts`: renders the earlier straight-road surface and markings. It remains
  available for milestone history but is not the active M5 world road.
- `TestTrack.ts`: renders the M5 fixed test track from pure layout data:
  loop road segments, a T-junction side road, a cross junction, lane markings,
  and static stop-line markings only.
- `roadLayout.ts`: pure, testable straight-road layout derived from shared
  road config, including the Singapore keep-left default lane and marking
  positions. Also provides shared center-dash cadence helpers.
- `testTrackLayout.ts`: pure, testable fixed-track layout data derived from
  shared config, including deterministic loop segments, uncontrolled junction
  metadata, static stop-line marker geometry, and a fixed finish zone. It
  contains no scoring, collision, or instructor logic.

## Data Flow

```text
Input -> CarController -> KinematicModel -> Car transform
   |                          |
   `-> BlindSpotCameraLook -> driver-seat camera follows Car
   |                          `-> DrivingSession -> Rule modules -> ScoringFeedback
   |-> BlindSpotCameraLook -> driver-seat camera follows Car
   `-> reset session/car
MirrorCameras follow Car -> render targets -> MirrorView
Cockpit reads CarState/InputState
Engine renders main pass + mirror passes; DOM HUD overlays on top
```

## Phase 1 Constraints

- No physics engine.
- No rules.
- No scoring.
- No procedural generation.
- No debug orbit camera in shipped gameplay.
- Mirrors are real rendered views.
- Keep-left is baked into world and spawn conventions.

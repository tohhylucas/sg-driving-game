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

1. Main 3D pass: full-window render of the world from the car/chase camera.
2. Mirror passes: separate `MirrorCamera`s render the scene into
   `WebGLRenderTarget`s. These should be composited into the cockpit as the
   rearview and side-mirror images. The implementation may use scissored
   viewport sub-passes or textured HUD quads, but mirrors must show real scene
   geometry.
3. HUD overlay: steering wheel, speedometer, and instructor caption frame sit in
   an HTML overlay above the canvas.

Mirrors must be real 3D because they are core to the game's real-world utility.
Speedometer, wheel, and captions are pure 2D and remain cheaper and cleaner as
DOM.

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
|   |   `-- TestTrack.ts
|   |-- vehicle/
|   |   |-- Car.ts
|   |   |-- KinematicModel.ts
|   |   `-- CarController.ts
|   |-- camera/
|   |   |-- ChaseCamera.ts
|   |   `-- MirrorCamera.ts
|   |-- ui/
|   |   |-- Cockpit.ts
|   |   |-- MirrorView.ts
|   |   |-- SteeringWheel.ts
|   |   |-- Speedometer.ts
|   |   `-- InstructorCaption.ts
|   |-- config/
|   |   |-- constants.ts
|   |   `-- controls.ts
|   |-- utils/
|   |   |-- math.ts
|   |   `-- three.ts
|   `-- types/
|       `-- index.ts
`-- tests/
    |-- kinematic.test.ts
    `-- math.test.ts
```

## Module Responsibilities

- `Engine.ts`: owns `WebGLRenderer`, root `Scene`, and `Clock`. Exposes
  `render(camera)`. No game logic.
- `Game.ts`: composition root. Instantiates world, car, cameras, and UI as
  milestones introduce them.
- `Loop.ts`: fixed-timestep accumulator so movement is frame-rate independent.
- `Input.ts`: tracks pressed keys and exposes normalized input state.
- `KinematicModel.ts`: pure logic for bicycle-model integration. No Three.js
  imports. Must be unit-tested when implemented.
- `CarController.ts`: adapter from input to model to Three.js car transform.
- `MirrorCamera.ts`: camera and render target for a mirror.
- `MirrorView.ts`: places a mirror render target into a cockpit frame.
- `config/constants.ts`: single source of truth for tunable numbers and colors.
- `roadLayout.ts`: pure, testable straight-road layout derived from shared
  road config, including the Singapore keep-left default lane and marking
  positions.

## Data Flow

```text
Input -> CarController -> KinematicModel -> Car transform
                              |
ChaseCamera follows Car <-----'
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

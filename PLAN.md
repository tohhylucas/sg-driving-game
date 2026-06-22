# PLAN.md - Phased Implementation Plan

Status legend: `[ ]` not started, `[WIP]` in progress, `[DONE]` complete.
Agents must keep this file current. See `AGENTS.md` section 3.

## PHASE 1 - Free Driving World (CURRENT)

Goal: A drivable car in a Singapore-style world with a working cockpit UI and
real rendered mirror views. No rules, no scoring, and no procedural generation.

### M0 - Project Setup

- [DONE] Initialize Vite + TypeScript project. Delivered initial Vite app shell.
- [DONE] Install three, vitest. Configure tsconfig (strict), vite, vitest. Delivered package and config files.
- [DONE] Create folder structure per ARCHITECTURE.md. Delivered source folders and placeholder modules.
- [DONE] `index.html` with full-window canvas + UI overlay root. Delivered `#game-canvas` and `#ui-overlay`.
- [DONE] Bootstrap `Engine` (renderer, scene, clock) + empty render loop. Delivered `Engine`, `Game`, and fixed-step `Loop`.
- **Test:** App boots, blank canvas fills window, no console errors, `npm run build` passes.

### M1 - The World (static, Singapore markings, keep-left)

- [DONE] Solid blue sky + green ground plane.
- [DONE] Straight road mesh (grey) with solid white edge lines and a dashed white center line.
- [DONE] Encode keep-left: left lane is the default driving lane.
- [DONE] No debug camera. Use a fixed forward camera for now to verify visuals.
- Delivery note: Rendered the static M1 world with config-backed road layout and a fixed camera aligned to the left/default driving lane.
- **Test:** Road renders with correct Singapore-style markings; left lane clearly the driving lane.

### M2 - The Car

- [DONE] Low-poly placeholder car mesh with a clear front.
- [DONE] Spawn in the left lane, facing forward, resting on the road.
- [DONE] Car holds state: position, heading, speed (no input yet).
- Delivery note: Rendered a config-backed exterior placeholder car at the Singapore keep-left spawn with zero initial speed.
- **Test:** Car sits correctly positioned in the left lane, facing the right direction.

### M3 - Free Driving (kinematic, no rules)

- [DONE] Keyboard input manager (accelerate, staged brake/reverse, steer left/right).
- [DONE] `KinematicModel` bicycle model - test-first.
- [DONE] `CarController` maps input to model to car transform, with steering-only smoothing.
- [DONE] Chase camera attached to car, with configurable lateral/view offset support.
- [DONE] Preserve free driving: no lane keeping, road-edge blocking, collision physics, rules, or scoring.
- Delivery note: Implemented issue #4 free driving with kinematic controls, chase camera follow, shared config constants, and focused tests.
- **Test:** Smooth accelerate/brake/reverse/steer around the world; camera follows correctly and supports configurable offset.

### M4 - In-Car Cockpit UI

- [DONE] Cockpit overlay over the M3 chase camera, not a full cockpit/interior camera.
- [DONE] Apply a right-hand-drive viewpoint offset using M3 camera offset support.
- [DONE] Rearview mirror (top center) - real rendered view via mirror camera/render target.
- [DONE] Left and right side mirrors - real rendered views via mirror cameras/render targets.
- [DONE] Steering wheel uses right-hand-drive placement and rotates with steering input.
- [DONE] Speedometer (bottom center) shows live km/h.
- [DONE] Instructor audio placeholder frame (empty; no text captions or instruction logic this phase).
- Delivery note: Implemented issue #5 cockpit overlay with right-hand-drive chase-camera offset, live rendered rear/side mirrors, live steering wheel and speedometer UI, and an audio-only instructor placeholder.
- **Test:** Mirrors reflect actual scene behind/beside the car; wheel and speedometer respond live; right-hand-drive layout reads correctly; no instructor text appears.

### M5 - Hand-Built Test Track

- [ ] Extend straight road into a small fixed track with a couple of turns and a junction to serve as a stable environment for Phase 2 rule testing.
- **Test:** Car can be driven around the full track without falling off or glitching.

## PHASE 2 - Rules & Scoring (NOT STARTED - DO NOT IMPLEMENT YET)

Placeholder only, for context. Each rule should be an independent, toggleable
module emitting scored events.

- [ ] Mirror / blind-spot check detection (before turns and lane changes)
- [ ] Keep-left enforcement
- [ ] Stop-line detection (solid white line, side road to main road)
- [ ] Safe following-distance with lead vehicles
- [ ] Instructor TTS instruction system (queued audio tied to road features; no on-screen text)
- [ ] Scoring / feedback loop
- [ ] Procedural map generation (last)

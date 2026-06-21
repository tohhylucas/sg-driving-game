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

- [ ] Solid blue sky + green ground plane.
- [ ] Straight road mesh (grey) with solid white edge lines and a dashed white center line.
- [ ] Encode keep-left: left lane is the default driving lane.
- [ ] No debug camera. Use a fixed forward camera for now to verify visuals.
- **Test:** Road renders with correct Singapore-style markings; left lane clearly the driving lane.

### M2 - The Car

- [ ] Low-poly placeholder car mesh with a clear front.
- [ ] Spawn in the left lane, facing forward, resting on the road.
- [ ] Car holds state: position, heading, speed (no input yet).
- **Test:** Car sits correctly positioned in the left lane, facing the right direction.

### M3 - Free Driving (kinematic, no rules)

- [ ] Keyboard input manager (accelerate, brake/reverse, steer left/right).
- [ ] `KinematicModel` bicycle model - test-first.
- [ ] `CarController` maps input to model to car transform.
- [ ] Chase/cockpit camera attached to car.
- **Test:** Smooth accelerate/brake/steer around the world; camera follows correctly.

### M4 - In-Car Cockpit UI

- [ ] Rearview mirror (top center) - real rendered view via mirror camera.
- [ ] Left and right side mirrors - real rendered views.
- [ ] Steering wheel (bottom center) rotates with steering input.
- [ ] Speedometer (bottom center) shows live km/h.
- [ ] Instructor caption frame (empty placeholder; no logic this phase).
- **Test:** Mirrors reflect actual scene behind/beside the car; wheel and speedometer respond live; layout matches the reference mockup.

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
- [ ] Instructor instruction system (queued voice/text tied to road features)
- [ ] Scoring / feedback loop
- [ ] Procedural map generation (last)

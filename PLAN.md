# PLAN.md - Phased Implementation Plan

Status legend: `[ ]` not started, `[WIP]` in progress, `[DONE]` complete.
Agents must keep this file current. See `AGENTS.md` section 3.

## PHASE 1 - Free Driving World (COMPLETE)

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

- [DONE] Extend straight road into a small fixed track with a couple of turns and a junction to serve as a stable environment for Phase 2 rule testing.
- Delivery note: Implemented issue #10 fixed loop track with T-junction and uncontrolled cross junction geometry, free-driving preservation, tests, and Chrome recording evidence.
- **Test:** Car can be driven around the full track without falling off or glitching.

## PHASE 2 - Controls, Rules & Scoring (PLANNED - DO NOT IMPLEMENT YET)

Goal: Add comfortable driver controls, blind-spot camera turning, and
observer-style rule modules that are active for the full driving session and
emit scored events without taking over free driving controls. Rules start when
the driving session starts and remain active until the session ends; there is no
practice settings UI or test mode for changing rule state.

M6 and M7 can start independently after M5. M9 depends on both M6's visual
blind-spot camera look controls and M7's scoring foundation.

### M6 - Driver Controls and Blind-Spot Camera Look

- [DONE] Normalize driving controls: W accelerates, S brakes/reverses, and
  Left/Right arrows steer the wheel.
- [DONE] Use a true right-hand-drive driver-seat camera as the main driving view
  instead of an exterior chase view.
- [DONE] Use A and D to rotate the right-hand-drive in-car driver-seat camera
  left and right so the player can inspect blind spots from the driver seat.
- [DONE] Return the camera smoothly to the normal driver-seat viewpoint when the
  look key is released.
- [DONE] Keep this visual only: do not score whether the player used the camera
  look.
- [DONE] Unit-test any extractable input mapping or camera-look state logic.
- Delivery note: Implemented issue #12 with W/S driving, arrow steering, natural
  coasting, a right-hand-drive driver-seat camera, visual-only A/D blind-spot
  camera turning, and browser evidence.
- **Test:** W/S control speed, Left/Right arrows steer, A/D rotate the camera to
  inspect blind spots from the driver-seat view and return cleanly, and no
  scored events are emitted by camera-look usage alone.

### M7 - Keep-Left Rule and Scoring Foundation

- [DONE] Define a small always-active rule-module contract and scored-event shape
  with `pass` and `violation` outcomes.
- [DONE] Define driving session lifecycle: start/reset onto the practice track
  starts a session; crossing a fixed finish zone or pressing reset ends it.
- [DONE] Add a fixed finish zone/gate to the hand-built test track for ending the
  route.
- [DONE] Implement the first end-to-end rule using keep-left detection.
- [DONE] Add a minimal scoring event stream and feedback surface that records
  successes and violations separately from instructor audio.
- [DONE] Unit-test lane-side detection, finish-zone crossing, always-active rule
  startup, and scored-event aggregation within one session.
- Delivery note: Implemented issue #13 with a session-scoped scoring event
  stream, episode-based keep-left pass/violation rule, fixed finish gate, R
  reset, separate feedback HUD, and keep-left debug readout for grace period
  lane-side diagnostics, and active/finished session state.
- **Test:** Driving outside the correct left lane emits a scored keep-left
  event after a configurable grace period; returning left or entering a new
  road segment allows a later separate keep-left violation; the rule is active
  for the full session; car movement remains unconstrained.

### M8 - Stop-Line Rule at the Hand-Built Junction

- [DONE] Add fixed stop-line rule zones to the M5 test track data.
- [DONE] Detect a complete stop before crossing the line from the side road.
- [DONE] Emit pass/violation scored events through the M7 rule foundation.
- [DONE] Unit-test the stop-line state machine, including rolling stops and reset.
- Delivery note: Implemented issue #14 with a visually obvious T-junction side
  road, a solid white side-road floor line, a single enforced red side-road
  stop-line marking, a side-road stop-line rule zone, always-active stop-line
  scoring through the M7 session event stream, an explicit `IMMEDIATE FAILURE`
  terminal state when the stop line is crossed without a complete stop, unit
  coverage for pass/violation/rolling/reverse/retry/reset behavior, and M8
  Chrome evidence.
- **Test:** Stopping before the line passes; crossing without a full stop fails;
  crossing from the side road into the main road without stopping ends the
  session immediately with `IMMEDIATE FAILURE`; unenforced junction approaches
  are not drawn as stop lines; reversing and retrying behaves predictably.

### M9 - Side-Hazard Accident Scenarios

- [ ] Add visible, physically avoidable deterministic side hazards such as
  passing bicycles or adjacent vehicles near turns and lane-change
  opportunities.
- [ ] Treat a collision or accident with a side hazard as the scored violation;
  do not score whether the player performed a mirror or blind-spot check action.
- [ ] Keep hazards scripted and fixed for Phase 2; random moving cars and
  bicycles are Phase 3 scope.
- [ ] Emit pass/violation side-hazard events through the M7 rule foundation.
- [ ] Unit-test side-hazard trigger zones, collision/accident detection, and
  repeated-event suppression.
- **Test:** A player who turns or changes lane into a configured side hazard
  receives an accident/violation event; avoiding the hazard passes; no
  check-action input is required or scored.

### M10 - Forward Moving Elements and Following Time-Gap Rule

- [ ] Add a simple scripted lead vehicle as the first tracked forward moving
  element on the fixed test track, not a traffic simulation.
- [ ] Apply one global configurable safe time-gap threshold to all tracked
  moving elements in the player's current lane in front of the car.
- [ ] Score only against the nearest tracked moving element ahead in the
  player's current lane.
- [ ] Ignore farther current-lane objects, adjacent-lane objects, and
  side-hazard objects for M10 following time-gap scoring.
- [ ] Compute the relevant current-lane forward following gap as a time gap from
  car state and moving-element state.
- [ ] Start an encounter-based following segment when the nearest tracked moving
  element is ahead in the player's current lane and within a configurable
  forward detection range; do not wait until the player is already too close and
  do not use fixed scoring zones for M10.
- [ ] End the following segment when that moving element is no longer the
  relevant current-lane object, or when the route/session ends.
- [ ] Allow the same moving element to start a new independent following
  encounter later if it again becomes the nearest current-lane object within the
  forward detection range.
- [ ] Emit pass/violation following time-gap events with a grace period and
  hysteresis.
- [ ] Once an encounter-based following segment emits a violation, keep that
  segment marked as a violation even if the player later restores a safe gap
  before the segment ends.
- [ ] Emit at most one violation event per encounter-based following segment;
  continued unsafe following after the first violation does not emit duplicate
  M10 violations.
- [ ] Emit a pass only when the player completes an encounter-based following
  segment cleanly; do not emit continuous pass events while the time gap is
  safe.
- [ ] Require a configurable minimum encounter duration before a clean encounter
  can emit a pass; too-short clean encounters emit no scored event.
- [ ] Apply minimum encounter duration only to pass eligibility; violations can
  still emit whenever the unsafe-gap grace period is exceeded.
- [ ] Unit-test nearest current-lane forward-element selection, time-gap
  calculation, detection-range encounter start/end, global-threshold usage,
  same-object re-entry as a new encounter, violation lockout after recovery,
  single-violation-per-encounter suppression, minimum-duration pass
  eligibility, clean segment completion, and repeated-event suppression.
- **Test:** Completing an encounter-based following segment behind the nearest
  current-lane object without tailgating emits a pass; tailgating that nearest
  object for longer than the grace period emits one scored violation event,
  suppresses further violation events until a new encounter starts, and prevents
  a later pass for that segment; an encounter can start from a safe gap within
  the detection range; the same object can create a later independent encounter
  after lane/speed/distance changes; a too-short clean encounter emits no event;
  a short unsafe encounter still violates if the unsafe-gap grace period is
  exceeded; farther and adjacent-lane objects do not trigger M10 events; the
  lead vehicle remains deterministic.

### M11 - Instructor TTS Instruction Queue

- [ ] Add an audio-only instruction queue tied only to configured fixed road
  features.
- [ ] Keep instructor prompts separate from rule and scoring feedback; scored
  pass/violation events must not queue instructor audio.
- [ ] Use a small TTS adapter that can be mocked in tests.
- [ ] Trigger instructions without adding on-screen instructional text or
  transcripts.
- [ ] Unit-test route-feature filtering, score-event non-enqueue behavior, queue
  ordering, de-duplication, and trigger cooldown behavior.
- **Test:** Approaching a configured feature queues and plays one audio
  instruction; pass/violation events do not queue instructor audio; repeated
  triggers do not overlap; no instruction text appears in the HUD.

### M12 - Session Outcome Summary and Feedback Loop

- [ ] Aggregate pass and violation events from always-active rule modules into a
  deterministic session outcome summary, not a numeric score.
- [ ] Show post-drive feedback grouped into rule-level `passes`, `violations`,
  and `not encountered` sections when the player crosses the finish zone.
- [ ] Treat missing rule events as `not encountered`, not as implicit passes.
- [ ] Do not calculate or display a Phase 2 numeric score, percentage, stars, or
  severity weighting.
- [ ] Keep in-drive feedback lightweight and separate from instructor audio.
- [ ] Unit-test outcome grouping, not-encountered handling, session finish, and
  reset behavior.
- **Test:** Crossing the finish zone produces a stable non-numeric session
  summary from real rule events; resetting the run clears summary state without
  reloading the app.

## PHASE 3 - Dynamic Practice Worlds (FUTURE)

Placeholder only. Future work may introduce procedural map generation and random
moving agents such as simulated cars and bicycles after Phase 2's fixed,
scripted hazards and scoring loop are proven.

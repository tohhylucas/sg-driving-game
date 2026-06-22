# PLAN.md - Phased Implementation Plan

Status legend: `[ ]` not started, `[WIP]` in progress, `[DONE]` complete.
Agents must keep this file current. See `AGENTS.md` section 3.

## AD-HOC TOOLING

- [DONE] Build a standalone satellite PNG map editor under `map_editor/` for tracing road graphs, placing markings, calibrating scale, and exporting game-ready `mapData.json`. Delivery note: Added a Vite/TypeScript canvas editor with calibration, origin placement, bright-line trace guides, road/decal editing, JSON export, README run instructions, tests, and a verified local dev server.
- [DONE] Improve the map editor line-detection and tool UX so detected road lines become visible/editable, toolbar labels are understandable, and calibration points are drawn while measuring. Delivery note: Reworked line detection into a connected-component painted-line detector that exports selectable `paintedLines`, renamed ambiguous toolbar actions, added a visible known-distance calibration flow, updated docs, and covered the pure detector/export paths with tests. This legacy detector was later removed from the active editor UI.
- [DONE] Add map editor undo and erase controls so accidental edits can be reverted with `Ctrl+Z` and removed directly from the toolbar. Delivery note: Added snapshot-based undo history, `Ctrl+Z` restoration, an `Erase` click-to-remove toolbar action, history coverage for editor state restoration, and README/architecture updates.
- [DONE] Fix map editor rotation and symbol rendering so the map view can rotate, give-way markings are editable linework, and placed symbols display as their actual road markings. Delivery note: Added rotated map-view transforms and toolbar controls, converted give-way placement into selectable/exported linework, drew actual road-symbol shapes on the canvas, and covered rotated coordinate mapping plus give-way line creation with tests.
- [DONE] Improve symbol placement and scaling so all symbols can be drag-rotated before placement, calibrated map scale immediately affects symbol sizing, drag distance adjusts symbol size, and the setup panel explains its purpose through useful controls. Delivery note: Added click-drag symbol placement previews, drag-derived rotation for all symbols, meter-based symbol sizing with toolbar adjustment, calibrated-size preview rendering, a clearer setup/status panel, and focused symbol behavior tests.
- [DONE] Use mouse-distance symbol scaling so ordinary click-drag adjusts both symbol rotation and size. Delivery note: Removed keyboard resizing for symbols, mapped drag direction to rotation and drag distance to calibrated meter size, updated tests/docs, and verified the editor URL.
- [DONE] Make the map status/selection inspector a toggleable drawer and clarify the road path drawing tool. Delivery note: Replaced the fixed inspector column with a right-side `Map Panel` drawer, wrapped the toolbar for normal zoom, renamed `Draw Road` to `Draw Road Path`, updated docs/architecture, and verified tests/build plus the local editor URL.
- [DONE] Make road path lane metadata visible and clarify selected-item editing. Delivery note: Added lane-count badges on road paths, changed the generic selection drawer copy to selected-item details, clarified `Lanes on path`, updated docs/architecture, and verified tests/build plus the local editor URL.
- [DONE] Add curved road path segments using Ctrl-click curve pivots. Delivery note: Added quadratic curve controls for road path segments, rendered and hit-tested curved paths, exported curve controls in `mapData.json`, documented the Ctrl-click workflow, and verified tests/build plus the local editor URL.
- [DONE] Polish map editor toolbar and shortcut discovery. Delivery note: Grouped toolbar controls by workflow, colocated symbol type and size beside `Place Symbol`, removed the visible undo toolbar action while keeping `Ctrl+Z`, added a right-side `Shortcuts` popout, and verified tests/build plus the local editor URL.
- [DONE] Fix first-placement undo for map editor symbols. Delivery note: Captured the pre-placement undo snapshot before symbol drag state exists, made `Ctrl+Z` remove first placed decals and line-marking symbols without restoring previews, added regression coverage, and verified tests/build plus the local editor URL.
- [DONE] Remove automatic line detection and add map JSON import. Delivery note: Removed the active line-detection button/runtime/files, kept editable line markings for give-way/imported geometry, added tested `mapData.json` parsing and world-to-pixel import, wired a JSON toolbar picker, updated docs/architecture, and verified tests/build plus the local editor URL.
- [DONE] Fix map JSON road-path round trip. Delivery note: Made imports tolerate older JSON without `paintedLines`, recovered node-only legacy exports as a single road path, made Export JSON commit active road paths with at least two points before download, added regressions, and verified tests/build plus the local editor URL.

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

- [DONE] Add visible, physically avoidable deterministic side hazards such as
  passing bicycles or adjacent vehicles near turns and lane-change
  opportunities.
- [DONE] Treat a collision or accident with a side hazard as the scored violation;
  do not score whether the player performed a mirror or blind-spot check action.
- [DONE] Keep hazards scripted and fixed for Phase 2; random moving cars and
  bicycles are Phase 3 scope.
- [DONE] Emit pass/violation side-hazard events through the M7 rule foundation.
- [DONE] Unit-test side-hazard trigger zones, collision/accident detection, and
  repeated-event suppression.
- Delivery note: Implemented issue #15 with a fixed visible right-lane bicycle
  side hazard, trigger/clearance and collision footprints, always-active
  side-hazard scoring through the M7 session stream, immediate session failure
  on collision, repeated-event suppression, focused unit coverage, and M9
  Chrome evidence.
- **Test:** A player who turns or changes lane into a configured side hazard
  receives an `IMMEDIATE FAILURE` accident/violation event and the session ends
  immediately; avoiding the hazard passes; no check-action input is required or
  scored.

### M10 - Forward Moving Elements and Following Time-Gap Rule

- [DONE] Add a simple scripted lead vehicle as the first tracked forward moving
  element on the fixed test track, not a traffic simulation.
- [DONE] Apply one global configurable safe time-gap threshold to all tracked
  moving elements in the player's current lane in front of the car.
- [DONE] Score only against the nearest tracked moving element ahead in the
  player's current lane.
- [DONE] Ignore farther current-lane objects, adjacent-lane objects, and
  side-hazard objects for M10 following time-gap scoring.
- [DONE] Compute the relevant current-lane forward following gap as a time gap from
  car state and moving-element state.
- [DONE] Start an encounter-based following segment when the nearest tracked moving
  element is ahead in the player's current lane and within a configurable
  forward detection range; do not wait until the player is already too close and
  do not use fixed scoring zones for M10.
- [DONE] End the following segment when that moving element is no longer the
  relevant current-lane object, or when the route/session ends.
- [DONE] Allow the same moving element to start a new independent following
  encounter later if it again becomes the nearest current-lane object within the
  forward detection range.
- [DONE] Emit pass/violation following time-gap events with a grace period and
  hysteresis.
- [DONE] Once an encounter-based following segment emits a violation, keep that
  segment marked as a violation even if the player later restores a safe gap
  before the segment ends.
- [DONE] Emit at most one violation event per encounter-based following segment;
  continued unsafe following after the first violation does not emit duplicate
  M10 violations.
- [DONE] Emit a pass only when the player completes an encounter-based following
  segment cleanly; do not emit continuous pass events while the time gap is
  safe.
- [DONE] Require a configurable minimum encounter duration before a clean encounter
  can emit a pass; too-short clean encounters emit no scored event.
- [DONE] Apply minimum encounter duration only to pass eligibility; violations can
  still emit whenever the unsafe-gap grace period is exceeded.
- [DONE] Unit-test nearest current-lane forward-element selection, time-gap
  calculation, detection-range encounter start/end, global-threshold usage,
  same-object re-entry as a new encounter, violation lockout after recovery,
  single-violation-per-encounter suppression, minimum-duration pass
  eligibility, clean segment completion, and repeated-event suppression.
- Delivery note: Implemented issue #16 with a deterministic scripted lead
  vehicle, live moving-element state, always-active encounter-based following
  time-gap scoring, repeated-event suppression, M10 unit coverage, and M10
  Chrome evidence.
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

- [DONE] Add an audio-only instruction queue tied only to configured fixed road
  features.
- [DONE] Keep instructor prompts separate from rule and scoring feedback; scored
  pass/violation events must not queue instructor audio.
- [DONE] Use a small TTS adapter that can be mocked in tests.
- [DONE] Trigger instructions without adding on-screen instructional text or
  transcripts.
- [DONE] Unit-test route-feature filtering, score-event non-enqueue behavior, queue
  ordering, de-duplication, and trigger cooldown behavior.
- Delivery note: Implemented issue #17 with a fixed-route instructor instruction
  feature, an audio-only queue, mockable browser TTS adapter, session lifecycle
  wiring, duplicate trigger cooldowns, and M11 Chrome evidence support without
  HUD transcripts.
- **Test:** Approaching a configured feature queues and plays one audio
  instruction; pass/violation events do not queue instructor audio; repeated
  triggers do not overlap; no instruction text appears in the HUD.

### M12 - Session Outcome Summary and Feedback Loop

- [DONE] Aggregate pass and violation events from always-active rule modules into a
  deterministic session outcome summary, not a numeric score.
- [DONE] Show post-drive feedback grouped into rule-level `passes`, `violations`,
  and `not encountered` sections when the player crosses the finish zone.
- [DONE] Treat missing rule events as `not encountered`, not as implicit passes.
- [DONE] Do not calculate or display a Phase 2 numeric score, percentage, stars, or
  severity weighting.
- [DONE] Keep in-drive feedback lightweight and separate from instructor audio.
- [DONE] Unit-test outcome grouping, not-encountered handling, session finish, and
  reset behavior.
- Delivery note: Implemented issue #18 with deterministic non-numeric session
  outcome grouping, post-finish cockpit feedback, reset clearing, M12 unit
  coverage, and M12 Chrome evidence.
- **Test:** Crossing the finish zone produces a stable non-numeric session
  summary from real rule events; resetting the run clears summary state without
  reloading the app.

## PHASE 3 - Dynamic Practice Worlds (FUTURE)

Placeholder only. Future work may introduce procedural map generation and random
moving agents such as simulated cars and bicycles after Phase 2's fixed,
scripted hazards and scoring loop are proven.

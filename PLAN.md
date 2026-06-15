# Singapore Rule-Adherence Driving Game Phase 1

## Summary
Build a browser-based, game-first driving experience for Singapore learner drivers. Phase 1 is a laptop-browser-only, first-person cockpit, timed open-driving vertical slice focused on habit formation through lane-changing, keep-left discipline, following distance, signalling, mirror checks, blind-spot checks, and post-drive feedback.

Use a Singapore-like fictional road network, not real test routes. The first slice proves lane changes end-to-end with light AI traffic, fully rendered rear/side mirrors, local-only webcam processing, and positive mastery scoring.

## Key Changes
- Build with `Three.js` for the 3D cockpit/world and MediaPipe-style local browser vision for face/eye/head landmark checks.
- Use first-person cockpit only, with functional rear-view and side mirrors rendered from alternate camera views.
- Camera model:
  - Fixed laptop webcam assumption.
  - Rear-view mirror check = eyes glance upward toward the camera area.
  - Blind-spot check = visible head turn left/right.
  - Webcam frames stay local; no video upload or storage.
- Core loop:
  - Open-driving timed sessions, default `6 minutes`.
  - Critical collision/impossible-manoeuvre warnings only during driving.
  - All rule coaching and mistake explanations happen in the post-drive recap.
- First playable slice:
  - Lane change on a multi-lane Singapore-like road.
  - Required sequence follows syllabus-first logic: traffic/mirror awareness, signal, blind spot, then manoeuvre.
  - Correct observation gives credit, but unsafe lane-change decisions are still penalized.
- Scoring:
  - Positive mastery score, not just deductions.
  - Separate scoring channels for observation sequence, road judgment, lane discipline, following distance, and line/signal compliance.
  - Keep-left is contextual: no penalty when overtaking, preparing for right turn/U-turn, avoiding hazards, or obeying lane markings.

## Core Interfaces
- `DrivingEvent`: timestamped event for signal, mirror glance, blind-spot check, lane departure, lane change, following-distance breach, stop-line breach, collision risk, or rule success.
- `ObservationTrace`: derived from local webcam landmarks; records upward glance, left/right head turn, confidence, and timing window.
- `RoadRuleEvaluator`: consumes vehicle state, traffic state, road markings, signals, and observation traces; emits mastery gains, penalties, and recap reasons.
- `SessionRecap`: grouped post-drive results with score, rule breakdown, replay markers, and highest-impact habit failures.

## Test Plan
- Unit-test rule evaluators for lane changes, keep-left exceptions, signal-before-line-crossing, safe time gap, and unsafe target-lane decisions.
- Simulate webcam traces for valid/invalid mirror and blind-spot timing windows.
- Integration-test a full 6-minute lane-change session with scripted/light AI traffic.
- Performance-test cockpit plus three mirror views on laptop Chrome/Edge.
- Privacy acceptance test: confirm no webcam frames or face data leave the browser.
- User validation default: small learner-driver study measuring whether repeated sessions improve reported observation habits.

## Assumptions
- Phase 1 targets Singapore Class 3/3A learner drivers.
- It is a game-first product, but syllabus accuracy remains non-negotiable.
- Real Singapore roads are deferred; the first map is fictional but Singapore-like.
- Full mobile, steering wheel, instructor dashboards, cloud analytics, and real-route recreation are out of scope for Phase 1.
- References used for feasibility and rule grounding: [SPF Final Theory of Driving PDF](https://www.police.gov.sg/-/media/Spf/Files/TP/Online-Learning-Portal/FT-ENG-9th-Edition-130717.pdf), [Three.js examples](https://github.com/mrdoob/three.js), and [MediaPipe browser examples](https://github.com/google-ai-edge/mediapipe).

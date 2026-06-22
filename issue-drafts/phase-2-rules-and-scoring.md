# Phase 2 Issue Drafts - Controls, Rules & Scoring

These are local drafts only. They have not been published to GitHub.

## 1. M6 - Driver Controls and Blind-Spot Camera Shift

**Type:** AFK
**Blocked by:** M5 - Hand-Built Test Track
**User stories covered:** As a learner, I can use comfortable driving controls
and shift the in-car view to inspect blind spots without that action being
treated as a scoring signal.

## What to build

Normalize the control map and add a visual blind-spot camera shift. W should
accelerate, S should brake/reverse, Left/Right arrows should steer, and A/D
should shift the right-hand-drive in-car viewpoint left/right to inspect blind
spots. The camera shift is driver assistance only, not a scored action.

## Acceptance criteria

- [ ] W accelerates the car.
- [ ] S brakes and then reverses according to the staged brake/reverse behavior.
- [ ] Left/Right arrows steer the wheel and drive the existing steering-wheel UI.
- [ ] A shifts the in-car viewpoint left for blind-spot inspection.
- [ ] D shifts the in-car viewpoint right for blind-spot inspection.
- [ ] Releasing A or D returns the camera smoothly to the normal cockpit/chase
  viewpoint.
- [ ] A/D no longer steer the car.
- [ ] Camera-shift usage does not emit scored events.
- [ ] Any extractable input mapping or camera-offset state logic is unit-tested.

## Blocked by

M5 - Hand-Built Test Track

## 2. M7 - Keep-Left Rule and Scoring Foundation

**Type:** AFK
**Blocked by:** M5 - Hand-Built Test Track
**User stories covered:** As a learner, I get scored feedback when I drive
outside Singapore's default left lane without the game taking control away.

## What to build

Create the first narrow rules-and-scoring path using keep-left detection. The
rule should observe the player's car state, emit scored events through a small
always-active rule-module contract, and surface feedback without constraining car
movement. The shared scored-event shape should support `pass` and `violation`
outcomes, with pass events emitted only at meaningful scenario boundaries.
Rules should start active when the driving session starts and remain active
until the session ends. A session starts when the player starts or resets onto
the practice track, and ends when the player crosses a fixed finish zone or
presses reset.

## Acceptance criteria

- [ ] The shared scored-event shape supports `pass` and `violation` outcomes.
- [ ] The driving session lifecycle is explicit: start/reset onto the practice
  track starts a session; crossing a fixed finish zone or pressing reset ends
  it.
- [ ] The hand-built track exposes a fixed finish zone/gate.
- [ ] The keep-left rule starts active when the session starts and remains active
  until the session ends.
- [ ] Keep-left detection emits a violation event only after a configurable
  grace period outside the correct lane.
- [ ] Continuous rules do not emit noisy per-frame pass events.
- [ ] Scored events flow into a minimal feedback surface separate from
  instructor audio.
- [ ] Lane-side detection, finish-zone crossing, always-active rule startup,
  session reset, and scored-event aggregation are unit-tested.
- [ ] Free driving remains unconstrained: no lane snapping, blocking, or
  steering correction.

## Blocked by

M5 - Hand-Built Test Track

## 3. M8 - Stop-Line Rule at the Hand-Built Junction

**Type:** AFK
**Blocked by:** M7 - Keep-Left Rule and Scoring Foundation
**User stories covered:** As a learner, I receive clear scored feedback on
whether I stopped correctly before entering a main road.

## What to build

Add stop-line rule zones to the fixed test track and score whether the player
makes a complete stop before crossing from a side road to a main road.

## Acceptance criteria

- [ ] The hand-built junction exposes a stop-line rule zone.
- [ ] The stop-line rule starts active when the session starts and remains active
  until the session ends.
- [ ] A complete stop before the line emits a pass event.
- [ ] Crossing the line without a complete stop emits a violation event.
- [ ] Rolling-stop and reverse/retry edge cases are covered by unit tests.
- [ ] The rule uses the M7 rule event path and remains active for the full
  session.

## Blocked by

M7 - Keep-Left Rule and Scoring Foundation

## 4. M9 - Side-Hazard Accident Scenarios

**Type:** AFK
**Blocked by:** M6 and M7
**User stories covered:** As a learner, I learn that failing to account for
blind-spot and side traffic can cause accidents, without the game needing to
inspect whether I pressed a check-action button.

## What to build

Add visible, physically avoidable deterministic side hazards, such as bicycles
passing in the blind spot or vehicles travelling alongside the player near turn
and lane-change opportunities. Score the resulting accident or collision as the
violation. Do not score whether the player performed a mirror or blind-spot
check action.

The M6 camera shift should make these hazards possible to inspect visually, but
side-hazard scoring is still based on accident outcome, not camera usage. Random
moving cars and bicycles are Phase 3 scope, not part of this fixed Phase 2
scenario.

## Acceptance criteria

- [ ] Scripted side hazards are visible in the world and can appear beside or
  slightly behind the player near configured turns and lane-change opportunities.
- [ ] Side hazards are physically avoidable through normal driving.
- [ ] No invisible trigger causes an accident without a visible hazard object.
- [ ] The side-hazard rule starts active when the session starts and remains
  active until the session ends.
- [ ] A collision or accident with a side hazard emits a violation event.
- [ ] Safely clearing the hazard scenario emits a pass event.
- [ ] Repeated-event suppression prevents one incident from creating noisy
  duplicate scoring.
- [ ] Side-hazard trigger zones, collision/accident detection, and repeated-event
  suppression are unit-tested.
- [ ] No mirror-check, blind-spot-check, or camera-shift input is required or
  scored.
- [ ] Random moving cars and bicycles are left out of scope for Phase 3.

## Blocked by

M6 - Driver Controls and Blind-Spot Camera Shift
M7 - Keep-Left Rule and Scoring Foundation

## 5. M10 - Forward Moving Elements and Following Time-Gap Rule

**Type:** AFK
**Blocked by:** M7 - Keep-Left Rule and Scoring Foundation
**User stories covered:** As a learner, I can practice maintaining a safe time
gap behind the nearest moving element in my current lane and receive scored
feedback when I tailgate.

## What to build

Add one deterministic scripted lead vehicle to the fixed test track as the first
tracked forward moving element. Score the player's following gap as a time gap
using car and moving-element state. Use one global configurable safe time-gap
threshold. Evaluate only the nearest tracked moving element ahead in the
player's current lane; farther current-lane objects, adjacent-lane objects, and
side-hazard objects do not trigger M10 scoring. Use encounter-based following
segments rather than fixed scoring zones on the track: start the segment when
the nearest tracked moving element is ahead in the player's current lane and
within a configurable forward detection range, before the player is necessarily
too close. End it when that element is no longer the relevant current-lane
object or the route/session ends. The same moving element can later start a new
independent encounter if it again becomes the nearest current-lane object within
the detection range. Emit a pass only when the player completes the encounter
cleanly and the encounter met a configurable minimum duration, not continuously
while the time gap is safe. Too-short clean encounters emit no scored event.
The minimum duration applies only to pass eligibility; a violation can still
emit whenever the unsafe-gap grace period is exceeded. Once an encounter emits a
tailgating violation, it remains a violation even if the player later restores a
safe gap before the encounter ends. Each encounter emits at most one violation
event; continued tailgating after the first violation is suppressed until that
encounter ends. This is not a traffic simulation, and side hazards remain M9
accident scenarios.

## Acceptance criteria

- [ ] A scripted lead vehicle follows a deterministic path on the test track as
  the first tracked forward moving element.
- [ ] The following time-gap rule starts active when the session starts and
  remains active until the session ends.
- [ ] The rule selects only the nearest tracked moving element ahead in the
  player's current lane.
- [ ] Farther current-lane objects, adjacent-lane objects, and side-hazard
  objects do not trigger M10 following time-gap events.
- [ ] The following rule computes a time gap from live car and moving-element
  state.
- [ ] Safe following uses one global configurable time-gap threshold, not a
  fixed-meter, per-segment, or per-object threshold.
- [ ] Following segments are encounter-based and are not fixed scoring zones on
  the test track.
- [ ] A following encounter starts when the nearest tracked moving element is
  ahead in the player's current lane and within a configurable forward detection
  range.
- [ ] A following encounter can start while the player still has a safe time gap;
  the rule does not wait until the player is already too close.
- [ ] A following encounter ends when that element is no longer the relevant
  current-lane object, or when the route/session ends.
- [ ] The same moving element can later start a new independent following
  encounter if it again becomes the nearest current-lane object within the
  detection range.
- [ ] A new encounter from the same moving element does not inherit pass,
  violation, or cooldown state from the previous encounter.
- [ ] Tailgating the nearest current-lane object for longer than a configurable
  grace period emits a scored violation event.
- [ ] Once a following encounter emits a violation, that encounter remains
  marked as a violation even if the player later restores a safe gap.
- [ ] A following encounter emits at most one violation event; continued
  unsafe-gap behavior after the first violation does not emit duplicate
  violations.
- [ ] A following encounter that emitted a violation does not emit a pass when
  the encounter completes.
- [ ] Completing a following encounter behind the nearest current-lane object at
  a safe gap emits a pass event.
- [ ] A clean encounter must meet a configurable minimum duration before it can
  emit a pass.
- [ ] A clean encounter shorter than the minimum duration emits no scored event.
- [ ] Minimum encounter duration applies only to pass eligibility.
- [ ] A short unsafe encounter still emits a violation if the unsafe-gap grace
  period is exceeded.
- [ ] A safe gap during an active following encounter does not emit continuous
  pass events before the encounter completes.
- [ ] Repeated-event suppression prevents noisy duplicate scoring.
- [ ] Nearest current-lane forward-element selection, time-gap calculation,
  detection-range encounter start/end, global-threshold usage, violation lockout
  after recovery, single-violation-per-encounter suppression, same-object
  re-entry as a new encounter, clean encounter completion, minimum-duration pass
  eligibility, short unsafe encounter violation, and hysteresis are unit-tested.

## Blocked by

M7 - Keep-Left Rule and Scoring Foundation

## 6. M11 - Instructor TTS Instruction Queue

**Type:** AFK
**Blocked by:** M7 - Keep-Left Rule and Scoring Foundation
**User stories covered:** As a learner, I receive audio-only instructor prompts
tied to route features without on-screen instruction text or grading audio.

## What to build

Add a small audio-only instruction queue tied only to configured fixed road
features. The TTS adapter should be mockable in tests, and the HUD must not
display instruction text or transcripts. Instructor prompts are not scoring
feedback: pass/violation events must not queue instructor audio, and scoring
feedback remains in the M12 feedback surface.

## Acceptance criteria

- [ ] Approaching a configured road feature queues one audio instruction.
- [ ] Only configured route features can queue instructor instructions.
- [ ] Instructor audio starts active when the session starts and remains active
  until the session ends.
- [ ] Pass/violation scored events do not queue instructor audio.
- [ ] Scoring feedback remains separate from instructor audio.
- [ ] Audio instructions play in order without overlapping.
- [ ] Duplicate triggers are suppressed within a configurable cooldown.
- [ ] Route-feature filtering, score-event non-enqueue behavior, queue ordering,
  de-duplication, and trigger cooldown behavior are unit-tested.
- [ ] No on-screen instructional text or transcript is added.

## Blocked by

M7 - Keep-Left Rule and Scoring Foundation

## 7. M12 - Session Outcome Summary and Feedback Loop

**Type:** AFK
**Blocked by:** M8, M9, M10, and M11
**User stories covered:** As a learner, I can finish a practice drive and see
which rules I passed, violated, or did not encounter.

## What to build

Aggregate pass and violation events from always-active rule modules into a
post-drive session outcome summary shown when the player crosses the finish
zone. The summary is grouped by rule-level `passes`, `violations`, and
`not encountered` sections. Do not calculate or display a Phase 2 numeric score,
percentage, stars, or severity weighting. Keep in-drive feedback lightweight
and separate from instructor audio.

## Acceptance criteria

- [ ] Always-active rule modules contribute pass and violation events to one
  session outcome summary.
- [ ] Crossing the finish zone ends the session and shows the post-drive
  summary.
- [ ] The post-drive summary groups rule outcomes into `passes`, `violations`,
  and `not encountered` sections.
- [ ] Rules or encounters with no emitted pass or violation are shown as
  `not encountered`, not as implicit passes.
- [ ] The Phase 2 summary does not show a numeric score, percentage, stars, or
  severity weighting.
- [ ] Outcome grouping, not-encountered handling, session finish, and reset
  behavior are deterministic and unit-tested.
- [ ] Resetting a session clears summary state without reloading the app.
- [ ] Feedback is based on real pass and violation events, not hard-coded demo
  text.

## Blocked by

M8 - Stop-Line Rule at the Hand-Built Junction
M9 - Side-Hazard Accident Scenarios
M10 - Forward Moving Elements and Following Time-Gap Rule
M11 - Instructor TTS Instruction Queue

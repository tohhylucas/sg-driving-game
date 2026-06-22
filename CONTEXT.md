# Singapore Driving Game

This context defines the domain language for a browser-based driving game that
teaches Singapore driving habits and road conventions.

## Language

**Singaporean accuracy**:
Road layout, markings, default driving behavior, and future rule behavior should
match Singapore driving conventions whenever the project references real-world
driving practice.
_Avoid_: Mockup-first markings, generic road accuracy, US/EU defaults

**Cockpit overlay**:
An in-car visual layer presented over the driving view, containing the mirrors
and basic driver instruments.
_Avoid_: Cockpit camera, full car interior

**Right-hand-drive viewpoint**:
Driver-facing presentation should be anchored on the vehicle's right side when
the game shows steering wheel or driver-position cues.
_Avoid_: Centered generic driver view, left-hand-drive placement

**Instructor audio**:
Future instructor guidance is delivered through TTS audio only, without
on-screen instructional text or transcripts. Phase 2 instructor audio is for
route-feature prompts only; it must not announce rule pass/fail results or score
commentary.
_Avoid_: Caption text, text prompts, readable instruction panels, scoring
feedback, violation commentary

**Route-feature prompt**:
An audio-only instructor cue triggered by a configured fixed road feature such
as an upcoming turn, junction, stop-line approach, or finish approach.
_Avoid_: Prompts generated from scored events, reactive grading audio

**Fixed test track**:
A hand-built deterministic Phase 1 driving environment used as the stable road
layout for future rule testing.
_Avoid_: Procedural map, generated level, scenario

**T-junction**:
A road junction where one side road meets another road without continuing
through it.
_Avoid_: Three-way intersection

**Cross junction**:
A road junction where two roads cross through each other, creating four
approaches.
_Avoid_: Crossroad, four-way intersection

**Uncontrolled junction**:
A junction with static road geometry but no active signal, priority, scoring,
or instructor behavior in Phase 1.
_Avoid_: Traffic-light junction, rule-enforced junction

**Stop line**:
A static road marking placed before a junction approach to support future rule
testing.
_Avoid_: Stop rule, stop enforcement, stop feedback

**Free driving**:
The player can steer and move the car without invisible lane, road, or rule
constraints; future rule systems may observe and score behavior but should not
take over basic movement.
_Avoid_: Lane snapping, road-edge blocking, rule-enforced steering

**Default driving controls**:
Use W for accelerate, S for staged brake/reverse, and Left/Right arrow keys for
steering. A and D are reserved for blind-spot camera shifting, not steering.
_Avoid_: Reusing A/D as steering once blind-spot camera shift is planned

**Side-hazard accident scenario**:
Current Phase 2 blind-spot-adjacent scoring should come from environmental
hazards such as visible bicycles or vehicles beside the player. These hazards
must be physically avoidable; collision with one is the violation.
_Avoid_: Invisible accident triggers, scoring whether the player pressed a
mirror-check or blind-spot-check button

**Scored event**:
A rule outcome emitted at a meaningful scenario boundary with either a pass or
violation result. Continuous rules should avoid noisy per-frame pass events.
_Avoid_: Inferring successful practice only from the absence of violations

**Session outcome summary**:
The Phase 2 post-drive feedback surface shown at session end. It groups real
rule outcomes into `passes`, `violations`, and `not encountered` sections
without a numeric score. Rules or encounters with no emitted outcome are shown
as `not encountered`, not as implicit passes.
_Avoid_: Percentages, stars, severity weighting, hidden score math, treating no
event as success

**Driving session**:
A single practice run that starts when the player starts or resets onto the
practice track, and ends when the player crosses the finish zone or presses
reset.
_Avoid_: Treating the whole app lifetime as one scoring session

**Finish zone**:
A fixed route-end gate on the practice track that ends the current driving
session when crossed.
_Avoid_: Timer-based session ending, endless free-drive scoring

**Always-active rule**:
A Phase 2 practice rule that starts active when a driving session starts and
remains active until that session ends.
_Avoid_: Learner-facing rule switches, config-only rule switches, test mode

**Blind-spot camera shift**:
A Phase 2 visual assistance mechanic where A and D shift the right-hand-drive
in-car viewpoint left and right so the player can actually see blind spots.
_Avoid_: Treating camera-shift usage as the current Phase 2 scoring signal

**Random moving agent**:
A future Phase 3 simulated road user, such as a moving car or bicycle, with
non-fixed behavior.
_Avoid_: Treating Phase 2 scripted hazards as procedural traffic simulation

**Following time gap**:
The M10 following rule measures the player's gap behind the nearest tracked
moving element ahead in the player's current lane as time, not as a fixed
physical distance. It uses one global configurable safe time-gap threshold for
every current-lane forward moving element. Following segments are
encounter-based, not fixed track zones: a segment starts when the nearest
tracked moving element is ahead in the player's current lane and within a
configurable forward detection range, before the player is necessarily too
close. The segment ends when that element is no longer relevant or the
route/session ends. The same moving element may later start a new independent
encounter if it again becomes the nearest current-lane object within the
detection range. A pass is emitted only when the player completes that encounter
cleanly and the encounter met a configurable minimum duration. Too-short clean
encounters emit no scored event. The minimum duration applies only to pass
eligibility; a violation can still emit whenever the unsafe-gap grace period is
exceeded. Once an encounter emits a tailgating violation, that encounter remains
a violation even if the player later restores a safe gap. Each encounter emits
at most one violation event; continued tailgating after the first violation is
suppressed until that encounter ends.
_Avoid_: Fixed-meter primary thresholds, per-segment thresholds, per-object
thresholds, adjacent-lane following-gap violations, scoring farther forward
objects while a nearer current-lane object exists, continuous safe-gap pass
events, fixed scoring zones for M10, starting only after the player is too
close, converting a violated encounter into a pass after recovery, merging
separate encounters from the same moving element, pass events from brief
encounters, suppressing violations because an encounter was brief, duplicate
tailgating violations within one encounter

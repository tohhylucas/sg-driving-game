# Architecture — Singapore Rule-Adherence Driving Game

> **Status:** Phase 1 (laptop-browser vertical slice)
> **Guiding principle:** The simulation, the rules, and the *scenario* (what world you're driving in) are three independent layers. "Open road" and "circuit challenge" are just different scenarios feeding the same rule engine. A hand-authored fictional map and a satellite-imagery-generated map both compile to the same `MapData` schema. Nothing in the rule engine knows or cares whether it's evaluating a road or a circuit cone-weave.

---

## 1. Design Goals & Non-Negotiables

| Goal | Architectural consequence |
|------|---------------------------|
| Game-first, syllabus-accurate | Rule thresholds are **named, tunable parameters** (`rules.config.ts`), never magic numbers inline. |
| Habit formation via positive mastery scoring | Scoring is a separate layer from rule *detection*; detection emits neutral facts, scoring interprets them. |
| Local-only webcam | Vision runs in a Web Worker; **no network egress** from the vision layer is architecturally enforced (no `fetch`/`WebSocket` imports allowed in `vision/`). |
| Deterministic replay | Fixed-timestep simulation + recorded input/event log. Sim state is never derived from wall-clock or `Math.random()` without a seeded RNG. |
| Future: circuits + satellite maps | One `Scenario` abstraction; one `MapData` schema; pluggable map *sources*. |
| Future: turns at lights, filter lanes | Roads are a **semantic graph** (lanes, connections, turn permissions, signal phases) — not just geometry. |

**Hard rules (enforced by lint/CI, not just convention):**
1. `vision/` must not import anything that can make a network call.
2. `rules/` must not import `three` or any rendering/scene type. Rules consume plain data.
3. `rules/` must not import from `vision/` directly — it consumes `ObservationTrace` records via the event bus.
4. All timing comparisons go through the single `SimClock`; no `performance.now()` / `Date.now()` inside `rules/` or `sim/`.

---

## 2. Layer Overview

```
┌──────────────────────────────────────────────────────────────┐
│                         App Shell (UI)                         │
│   menus, calibration flow, HUD, post-drive recap, settings     │
└───────────────▲──────────────────────────────▲────────────────┘
                │ recap data                    │ session control
┌───────────────┴───────────────┐  ┌────────────┴───────────────┐
│        Scoring Layer           │  │      Session Orchestrator   │
│  mastery channels, anti-game,  │  │  load scenario, run loop,   │
│  normalisation, recap builder  │  │  own the SimClock, replay   │
└───────────────▲────────────────┘  └────────────▲───────────────┘
                │ rule outcomes                   │ ticks
┌───────────────┴────────────────────────────────┴───────────────┐
│                      Rule Engine (rules/)                        │
│  RoadRuleEvaluator: pure functions over snapshots + traces      │
│  emits MasteryGain | Penalty | RecapReason — knows no Three.js   │
└───────▲───────────────────────▲────────────────────▲────────────┘
        │ VehicleState/Traffic   │ MapData semantics   │ Observation
┌───────┴────────┐     ┌─────────┴────────┐   ┌────────┴───────────┐
│  Sim (sim/)    │     │  Scenario/Map     │   │  Vision (vision/)  │
│  physics,      │     │  MapData schema,  │   │  Web Worker,       │
│  traffic AI,   │     │  loaders/sources  │   │  landmarks →       │
│  vehicle state │     │  (authored, sat)  │   │  ObservationTrace  │
└───────┬────────┘     └──────────────────┘   └────────┬───────────┘
        │ state                                          │ raw frames (local only)
┌───────┴────────────────────────────────────┐  ┌───────┴───────────┐
│         Renderer (render/)                   │  │   Webcam input     │
│  Three.js cockpit + 3 mirror cameras, HUD    │  │   (getUserMedia)   │
└──────────────────────────────────────────────┘  └────────────────────┘
```

**Data flows one way for facts, one way for control.** Sim + Vision + Map produce *facts* → Rule Engine interprets → Scoring aggregates → UI renders recap. The Session Orchestrator owns the clock and the loop and is the only thing allowed to drive everything.

---

## 3. The Core Abstractions

### 3.1 `Scenario` — the thing that makes circuits "free"
A scenario bundles everything needed to run one driving experience:

```ts
interface Scenario {
  id: string;
  kind: 'open-road' | 'circuit';        // extensible
  map: MapData;                          // semantic world (see 3.2)
  objectives: Objective[];               // what counts as success here
  trafficPlan: TrafficPlan;              // spawn rules / scripted actors / IDM density
  ruleProfile: RuleProfileId;            // which rule set + thresholds apply
  sessionConfig: { durationSec: number; warningsEnabled: boolean };
}
```

Open-road Phase 1 = `{ kind:'open-road', objectives:[freeDrive, laneChangeMastery], ... }`.
A future circuit = `{ kind:'circuit', objectives:[coneWeave, parallelPark], ... }` — **same rule engine, same scoring, different objectives + map.** This is why "fully decoupled" was the right call.

### 3.2 `MapData` — the stable intermediate schema (author it once, never break it)
Both the hand-built fictional map and the future satellite-imagery generator emit this. The runtime *only* consumes this. This is the single most important schema in the project — version it.

```ts
interface MapData {
  schemaVersion: number;
  bounds: AABB;
  laneGraph: {
    nodes: LaneNode[];                   // junction points
    edges: LaneEdge[];                   // directed lane segments
  };
  lanes: Lane[];                         // geometry + semantics per lane
  connections: LaneConnection[];         // legal movements (incl. turn permissions)
  signals: TrafficSignal[];              // phase groups, timing, controlled connections
  roadMarkings: RoadMarking[];           // keep-left, chevrons, zig-zag, yellow box, stop line
  driveSide: 'left';                     // Singapore = left; encoded, not assumed
  surfaces?: Surface[];                  // for circuits: pads, cones, kerbs (non-road)
}

interface Lane {
  id: string;
  centerline: Vec3[];                    // sampled polyline
  width: number;
  type: 'normal' | 'filter-left' | 'bus' | 'turn-right' | 'circuit-pad';
  allowedManoeuvres: Manoeuvre[];
  keepLeftDefault: boolean;
}
```

> **Map sources are pluggable.** `MapSource` is an interface with `loadAuthored(json)` and (future) `generateFromSatellite(region)`. Phase 1 ships only the authored loader. The satellite generator is a *separate package* that outputs `MapData` JSON — the game never depends on it at runtime.

### 3.3 `RuleProfile` — Singapore rules as data
```ts
interface RuleProfile {
  id: RuleProfileId;
  signalLeadMinSec: number;              // e.g. 3s before line crossing
  observationWindowSec: number;          // how recent a check must be to "count"
  sequenceTolerance: SequenceTolerance;  // see §5: how strict mirror→signal→blindspot ordering is
  followingDistanceMinSec: number;       // 2s rule (more in rain — future)
  keepLeftExceptions: KeepLeftException[];
  laneDepartureToleranceM: number;
  confidencePolicy: 'penalise' | 'no-score';  // what low vision confidence means
}
```
Changing how strict the game is = editing data, not code. Critical for balancing a *game*.

---

## 4. Module Breakdown & Folder Layout

```
src/
  app/                  # React/UI shell, screens, settings, recap UI
    screens/
      Calibration/      # ⚠ first-class flow, gates session start (see §6)
      Drive/            # cockpit host + live HUD
      Recap/            # SessionRecap visualisation + replay scrubber
  session/
    Orchestrator.ts     # owns SimClock, run loop, scenario lifecycle
    SimClock.ts         # single authoritative time source
    EventBus.ts         # typed pub/sub for DrivingEvent / ObservationTrace
    Recorder.ts         # records inputs + events for deterministic replay
  scenario/
    Scenario.ts
    MapData.ts          # the schema (§3.2) — versioned
    sources/
      AuthoredMapSource.ts
      (satelliteMapSource.ts)   # future, separate package preferred
    fixtures/           # the Phase 1 fictional Singapore-like map JSON
  sim/
    Vehicle.ts          # dynamics model (see §7)
    PhysicsStep.ts      # fixed-timestep integrator, seeded RNG
    traffic/
      TrafficManager.ts
      IDMDriver.ts      # intelligent-driver-model actors (gap creation)
      ScriptedActor.ts  # for deterministic tests/integration
    state/
      VehicleState.ts   TrafficState.ts   WorldSnapshot.ts
  vision/               # ⚠ NO network imports allowed (CI-enforced)
    worker/
      vision.worker.ts  # MediaPipe-style landmarks off main thread
    Calibration.ts      # per-user baselines (up/left/right/centre)
    TraceBuilder.ts     # landmarks → ObservationTrace
    KeyboardFallback.ts # press-key "observation" source (a11y + tests)
  rules/                # ⚠ NO three.js, NO vision imports (CI-enforced)
    RoadRuleEvaluator.ts
    evaluators/
      laneChange.ts  keepLeft.ts  signalTiming.ts  followingDistance.ts
      observationSequence.ts  collisionRisk.ts
    rules.config.ts     # RuleProfile definitions (data)
    types.ts            # DrivingEvent, ObservationTrace, outcomes
  scoring/
    Scorer.ts           # channels → normalised mastery score
    channels.ts         # observation, judgment, discipline, distance, signal
    antiGaming.ts       # diminishing returns, contextual relevance, caps
    RecapBuilder.ts     # → SessionRecap
  render/               # ⚠ the only place three.js lives
    Cockpit.ts
    mirrors/
      MirrorRig.ts      # 3 alternate-view render targets (rear, L, R)
    Hud.ts
  shared/
    math/  time/  ids/  rng/   # seeded RNG lives here
test/
  unit/                 # evaluators, scoring, calibration math
  vision-sim/           # synthetic ObservationTrace generators
  integration/          # full 6-min scripted-traffic session
  privacy/              # asserts no egress from vision/
  perf/                 # cockpit + 3 mirrors frame budget
```

---

## 5. The Hard Problem: Cross-Stream Timing & Observation Sequence

This is the part most likely to break, so the architecture addresses it explicitly.

- **One clock.** `SimClock` exposes `simTimeSec` advanced by the fixed-timestep loop. *Every* timestamp — `DrivingEvent`, `ObservationTrace` — is stamped with `simTimeSec` at the moment it enters the `EventBus`, **not** the wall-clock time it occurred in the worker. The vision worker tags frames with capture latency; the main thread reconciles to `simTimeSec` on arrival.
- **Async join with tolerance.** The `observationSequence` evaluator does a *temporal-window join*: "was there a rear-view trace within `observationWindowSec` before the signal, and a blind-spot trace before line-crossing?" Tolerances come from the `RuleProfile`, not hardcoded.
- **Sequence is order-tolerant within reason.** Real drivers interleave. The profile's `sequenceTolerance` defines: which steps are order-strict (e.g. *something* must precede line-crossing) vs. order-flexible (mirror vs. first blind-spot glance). Don't hard-fail natural human ordering.
- **Confidence policy is explicit.** Low landmark confidence → `RuleProfile.confidencePolicy` decides `penalise` vs `no-score`. Default Phase 1: **`no-score`** (don't punish what you couldn't measure). This is a game-feel + fairness decision, surfaced as data.

---

## 6. Calibration (a first-class flow, not a setting)

Phase 1 **must** ship a calibration step that gates session start:
1. Prompt user to look centre / up (rear-view) / left / right while seated normally.
2. Record per-user landmark baselines + a confidence floor.
3. Resolve the **rear-view ambiguity**: distinguish "glance up to the real rear-view position" from "looking at the top of the on-screen mirrors/HUD." Calibration captures the user's actual up-glance signature.
4. Persist locally (no upload) so returning users can skip/quick-recalibrate.

**Design decision needed before building rules (flagged in review):** the *camera-vs-blind-spot tension* — when the user turns their head to check a blind spot they can't see the screen. Architecture accommodates either resolution via config: a `blindSpotGracePolicy` on the `RuleProfile` (e.g. brief steering-assist / time-dilation / collision-warning suppression during a detected head-turn window). Decide the policy; the structure already holds it.

---

## 7. Simulation Fidelity (decide & document)

- **Vehicle model:** kinematic bicycle (Ackermann-ish) model — plausible turning + lane behaviour without full tyre physics. Forgiving for learners; deterministic. Lives in `sim/Vehicle.ts`.
- **Fixed timestep** (e.g. 60 Hz physics) decoupled from render. Render interpolates. Guarantees replay determinism.
- **Seeded RNG** everywhere randomness exists (traffic spawns) so sessions are reproducible for tests and replay.
- **Traffic:** IDM-based following + lane-keeping so "is there a safe gap?" is a real, emergent judgement — not scripted gaps that only work on one map. `ScriptedActor` exists for deterministic integration tests.

---

## 8. Replay & Recap

- `Recorder` logs: scenario id + seed, the input stream (keyboard + observation events), at fixed cadence.
- Replay = re-run deterministic sim from seed + recorded inputs. No need to store full per-frame state (cheap, exact).
- `SessionRecap` groups outcomes by rule channel, attaches `replayMarkers` (sim-time anchors) so the recap UI can scrub to "your unsafe lane change at 2:14."

---

## 9. Privacy Architecture (acceptance-tested)

- Webcam frames live only inside `vision/worker`. Landmarks → `ObservationTrace` (numbers, not pixels) cross the worker boundary. Frames are never serialised out.
- CI test in `test/privacy/` statically asserts `vision/` has no `fetch`/`WebSocket`/`XMLHttpRequest`/`navigator.sendBeacon` references and no imports that transitively do.
- No persistence of frames or face descriptors; only abstract calibration baselines (local storage), which the user can clear.

---

## 10. Extension Playbook (how future tasks slot in)

| Future task | What you add | What you DON'T touch |
|-------------|--------------|----------------------|
| Turns at traffic lights | `signals` data in `MapData`; a `signalTiming`/`junctionTurn` evaluator | renderer, vision, scoring core |
| Left filter lanes | `Lane.type:'filter-left'` + connection permissions; evaluator rule | sim core, clock |
| Circuit phase | New `Scenario{kind:'circuit'}` + `Objective`s + circuit `MapData` (surfaces/cones) | rule engine, scoring, sim — all reused |
| Satellite-generated maps | New `MapSource.generateFromSatellite` emitting `MapData` JSON (separate package) | entire runtime — it only sees `MapData` |
| New rule strictness / balancing | Edit `RuleProfile` data | any code |

If adding a feature forces you to touch the renderer *and* the rule engine *and* the sim at once, a boundary has leaked — treat it as a bug in the architecture, not the feature.

---

## 11. Phase 1 Build Order (suggested)

1. `MapData` schema + authored fictional map fixture + `SimClock` + `EventBus`.
2. Kinematic vehicle + fixed-timestep loop + minimal renderer (cockpit, no mirrors yet). Drive a box around.
3. Mirror rig (3 render targets). Confirm perf budget early (`test/perf`).
4. Keyboard observation fallback first → rule evaluators (lane change, keep-left, signal timing, following distance) against it. **Rules testable with zero webcam.**
5. Vision worker + calibration flow → real `ObservationTrace`, swap in alongside keyboard source.
6. Scoring channels + anti-gaming + `SessionRecap` + replay scrubber.
7. IDM traffic for genuine gap-judgement; integration-test the full 6-min session.

> Build the rules against the keyboard fallback **before** the webcam exists. It de-risks the highest-uncertainty component (vision) by proving the entire rule/scoring pipeline works deterministically first.

---

## 12. Open Decisions (resolve before/early in build)

- [ ] Blind-spot vs. on-screen tension: pick the `blindSpotGracePolicy`.
- [ ] Rear-view glance signature: confirm calibration can separate it from screen-top gaze.
- [ ] Confidence policy default (`no-score` recommended).
- [ ] Final score combination: weighted sum vs. worst-channel gate vs. hybrid.
- [ ] Signal lead-time value (align to SPF guidance, then tune for game feel).
- [ ] Vehicle model tuning targets (how forgiving?).

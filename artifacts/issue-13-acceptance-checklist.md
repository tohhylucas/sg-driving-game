# Issue 13 Acceptance Checklist

| Criterion | Evidence |
| --- | --- |
| The shared scored-event shape supports `pass` and `violation` outcomes. | `src/rules/scoring.ts`; `tests/keepLeftRule.test.ts`; `tests/drivingSession.test.ts`. |
| The driving session lifecycle is explicit: start/reset onto the practice track starts a session; crossing a fixed finish zone or pressing reset ends it. | `src/rules/DrivingSession.ts`; `tests/drivingSession.test.ts`; M7 browser log reset sample starts session 2. |
| The hand-built track exposes a fixed finish zone/gate. | `src/world/testTrackLayout.ts`; `src/world/TestTrack.ts`; `tests/finishZone.test.ts`. |
| The keep-left rule starts active when the session starts and remains active until the session ends. | `tests/drivingSession.test.ts`; `src/core/Game.ts`. |
| Keep-left detection emits a violation event only after a configurable grace period outside the correct lane. | `RULE_CONFIG.keepLeftGracePeriodSec`; `tests/keepLeftRule.test.ts`; M7 browser log violation sample. |
| Continuous rules do not emit noisy per-frame pass events. | `tests/keepLeftRule.test.ts`; repeated right-lane updates emit one violation and no duplicate pass events. |
| Scored events flow into a minimal feedback surface separate from instructor audio. | `src/ui/ScoringFeedback.ts`; `src/ui/Cockpit.ts`; M7 browser smoke asserts scoring feedback and empty instructor caption/text. |
| Lane-side detection, finish-zone crossing, always-active rule startup, session reset, and scored-event aggregation are unit-tested. | `tests/laneRules.test.ts`; `tests/finishZone.test.ts`; `tests/drivingSession.test.ts`; `tests/keepLeftRule.test.ts`. |
| Free driving remains unconstrained: no lane snapping, blocking, or steering correction. | Rule modules observe `CarState`; movement still flows through `CarController` and `KinematicModel` without lane correction. |
| `PLAN.md` is updated with the M7 delivery note after implementation. | `PLAN.md` M7 is marked `[DONE]` with delivery note. |
| `npm test` and `npm run build` pass. | Both commands passed locally. |

# Issue 10 Acceptance Checklist

| Criterion | Planned evidence |
| --- | --- |
| Closed fixed test track can be driven as a loop | `tests/testTrackLayout.test.ts` closed-loop assertions; M5 browser recording follows loop checkpoints. |
| At least a couple of readable, driveable bends | `tests/testTrackLayout.test.ts` heading-change assertions; M5 recording includes loop bends. |
| One T-junction side road connected to the track | `tests/testTrackLayout.test.ts` T-junction segment and metadata assertions; M5 recording passes the main-road T-junction approach. |
| One uncontrolled cross junction | `tests/testTrackLayout.test.ts` cross-junction metadata assertions; M5 recording passes through the cross junction. |
| Static stop-line markings at useful junction approaches, with no stop-rule logic | `tests/testTrackLayout.test.ts` stop-line marker assertions; source review confirms no rule/scoring/detection code. |
| Free driving preserved with no boundaries, collision, lane snapping, rules, scoring, instructor logic, or traffic-control behavior | Source review; `npm test`; `npm run build`; M5 recording uses normal free-driving controls. |
| Geometry and marking constants/configuration kept out of feature files where shared config is appropriate | `src/config/constants.ts` and `src/world/testTrackLayout.ts`. |
| Focused tests for deterministic track layout data and pure geometry helpers | `tests/testTrackLayout.test.ts`. |
| `CONTEXT.md` updated with M5 glossary terms | `CONTEXT.md`. |
| `PLAN.md` marked done after implementation | `PLAN.md` update after verification. |
| `ARCHITECTURE.md` updated if responsibilities/file structure change | `ARCHITECTURE.md`. |
| Browser verification records driving around the loop and passing through both junction types | `artifacts/issue-10-chrome-recording.webm` and `artifacts/issue-10-chrome-logs.txt`. |

# AGENTS.md - Operating Rules for All Coding Agents

> Every agent working on any subfeature must read this file in full before writing code,
> and must re-read `PLAN.md` and `ARCHITECTURE.md` at the start of each task.

## 0. Project Context

This is a browser-based 3D driving game teaching Singapore driving rules.
Singapore drives on the left. This is non-negotiable and affects coordinate
conventions, default lane, and all future rules. See `ARCHITECTURE.md` under
"Coordinate Conventions".

When a visual, rule, or interaction has a Singapore-specific real-world
convention, Singaporean accuracy wins over mockup styling or generic driving
game defaults.

We are currently in Phase 1 only. Do not implement Phase 2 features such as a
rules engine, scoring, procedural generation, or instructor logic unless the
active task in `PLAN.md` explicitly says so. A caption frame in the UI is
allowed; instruction logic is not.

## 1. Core Principles

### KISS - Keep It Simple

- Prefer the simplest solution that satisfies the current milestone.
- No physics engine in Phase 1. Movement uses a kinematic bicycle model only.
- Do not add abstraction "for the future" unless the current task requires it.
- If a feature is not in the active `PLAN.md` milestone, do not build it.

### DRY - Do Not Repeat Yourself

- Shared constants such as lane width, road length, key bindings, and colors
  live in `src/config/`. Never hard-code these values inside feature files.
- Reusable math such as vectors, clamping, lerp, and angle wrapping lives in
  `src/utils/`.
- If you copy a block of logic twice, extract it.

### TDD - Test-Driven Development

- Pure logic must be developed test-first using Vitest:
  - `KinematicModel` position and heading integration
  - all functions in `src/utils/`
  - any future rule logic
- Write the failing test, then the implementation, then refactor.
- Rendering and Three.js scene-graph code is exempt from unit tests and should
  be verified manually. Any extractable pure logic inside it must be pulled out
  and tested.
- A task is not done until its tests pass and `npm run test` is green.

## 2. Coding Standards

- TypeScript strict mode is on.
- No `any` unless justified with a comment.
- One responsibility per file or class. Files should be small and focused.
- Public methods get short doc comments stating intent, not implementation.
- No magic numbers in logic. Name them in `src/config/` or as named constants.
- Use `THREE` types explicitly. Do not leak `three` imports into pure logic or
  util files so those files stay testable and engine-agnostic where practical.

## 3. Workflow Rules

1. Read `PLAN.md`. Pick the milestone marked next or the assigned task.
2. Mark the item `[WIP]` in `PLAN.md` with a task note before starting.
3. Implement following KISS, DRY, and TDD.
4. Run `npm run test` and `npm run build`. Both must pass.
5. Manually verify the visual result against the milestone's test criteria.
6. Mark the item `[DONE]` in `PLAN.md` and add a one-line delivery note.
7. If you discover the plan is wrong or incomplete, update `PLAN.md` instead of
   silently deviating.
8. If you change file structure, update `ARCHITECTURE.md` in the same commit.

## 4. Definition of Done

- [ ] Meets the milestone's stated goal and test criteria.
- [ ] Tests written for all pure logic and passing.
- [ ] `npm run build` succeeds with no type errors.
- [ ] No hard-coded values that belong in `config/`.
- [ ] `PLAN.md` updated with status and note.
- [ ] `ARCHITECTURE.md` updated if structure changed.

## 5. Avoid

- Introducing a physics engine in Phase 1.
- Adding a free-orbit debug camera to the shipped game.
- Right-hand-drive assumptions anywhere.
- Putting business constants inside feature files.
- Leaving `PLAN.md` out of date.

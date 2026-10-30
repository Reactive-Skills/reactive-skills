---
name: tdd-refactor
description: Hierarchical TDD & Refactoring state machine with nested micro-cycles, regression detection, event bubbling, and live projections
---

# tdd-refactor

Work through these phases in order. Do not start a phase before the previous one has ended as described.

## State: RED_SPEC (Failing Specification)

#### Active Constraints:
- Target File: `src/auth.ts`
- Test File: `tests/auth.test.ts`
- Requirement: `the requirement you were given`

#### Your Goal:
1. View the current test suite in `tests/auth.test.ts`.
2. Add one precise test case for the requirement.
   If it is empty, ask the user for the requirement before writing the test.
3. Run the test suite using a shell command.
4. **DO NOT** write the production code implementation yet.
5. The test MUST fail (`exit_code != 0`).

Continue to **GREEN_CODE** when the run exits non-zero.

## State: GREEN_CODE (Minimal Passing Implementation)

#### Active Constraints:
- Target File: `src/auth.ts`
- Test File: `tests/auth.test.ts`

#### Your Goal:
1. Write the minimal necessary implementation in `src/auth.ts` to make the failing test pass.
2. Run the test suite using a shell command.
3. Do not perform extraneous refactoring yet—only make the tests green (`exit_code === 0`).

Continue to **REFACTOR** when every run exits 0.

## Substate: REFACTOR.CLEAN_CODE (Structure & Readability)

#### Invariants:
- Target File: `src/auth.ts`
- All tests MUST remain green.

#### Your Goal:
1. Simplify logic, extract deep helper functions, and clarify naming.
2. Verify tests pass (a shell command).

Continue to **PERF_AUDIT** when this phase is done.
If a test fails at any point during refactoring, go back to **GREEN_CODE**.

## Substate: REFACTOR.PERF_AUDIT (Performance & Allocation Gate)

#### Invariants:
- Target File: `src/auth.ts`
- All tests MUST remain green.

#### Your Goal:
1. Audit memory allocations, loop complexity, and asynchronous bottlenecks.
2. Verify zero regressions using a shell command.

Continue to **AUDIT_VERIFY** when this phase is done.
If a test fails at any point during refactoring, go back to **GREEN_CODE**.

## State: AUDIT_VERIFY (Verification & Quality Gate)

#### Your Goal:
1. Run linter, typecheck, and full test suite verification.
2. Confirm zero regression across the workspace.

Continue to **COMPLETED** when every run exits 0.
If any check fails, go back to **GREEN_CODE**.

## State: COMPLETED (Delivery Finalized)

The TDD refactor cycle has successfully concluded.
All transition contracts and safety invariants have been satisfied.

Write `.docs/tdd-refactor-summary.md` listing each phase you completed, in order, with the check result that ended it.

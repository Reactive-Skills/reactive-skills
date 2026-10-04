# Specification: Gate Integrity (v0.17.1)

Status: Draft for DoD approval.

Scope: `docs/scope/release-v0.17.1-gate-integrity.md`.
Decision record: `docs/adr/0011-judgment-outage-refusal-and-self-reported-decisions.md`.

## 1. Test output containment (#28)

1. Every runtime and AXI test that constructs an engine with a projecting skill passes a per-test temporary `workspaceDir` and removes it afterwards.
2. A Vitest global setup in the runtime and AXI packages records the entries under `.docs/` and `.reactive/` at the repository root, in `packages/runtime`, and in `apps/axi`, and its teardown fails the run when new entries appear.
3. Leaked `.docs/jobs/<id>/` folders at the repository root whose only file is `test-fsm-summary.md` are removed once, after the fix lands.

## 2. Outage refusal and self-reported decisions (#22 part 1)

4. `isExecutableCriterion(criterion)` returns true when `(criterion)` compiles as a JavaScript expression, and never executes it.
5. When the script adapter decides from the payload because the criterion is not executable, its result sets `selfReported: true`.
6. An outage is a failure, or an open circuit breaker, of the selected primary model adapter (Jev or any registered adapter except `script`) while it reports itself available, or an open Jev circuit that made the script adapter the default.
7. During an outage, a judgment whose criterion is not executable returns `passed: false`, band `unevaluable`, `fallbackTriggered: true` (the cascade ran), no `fallbackTarget`, and an error naming the unavailable adapter with a retry instruction.
8. During an outage, an executable criterion is evaluated by the script fallback as before.
9. When Jev is not configured, the heuristic decides as before, and the result keeps `selfReported: true`.
10. `JudgmentBand` includes `unevaluable`.
11. A refused signal's result carries `refusalReason` from the failing guard's error when one exists.
12. A transitioned signal whose judgment was self-reported carries `judgmentBasis: "self_reported"`.
13. The AXI emit output renders `refusal_reason` and `judgment_basis` when present, and the MCP emit result includes `refusalReason` and `judgmentBasis`.
14. Criteria 7 to 9 apply to predicate, categorical, and evaluation judgments.

## 3. Exact predicates (#15)

15. With Jev available, `adapter_hint: script` selects the script adapter, and Jev's `evaluate` is never called.
16. When the hinted primary adapter throws, the declared fallback adapter runs.
17. `validate` warns when a predicate's criterion is executable and its `adapter_hint` is not `script`, and names the fix.
18. Authoring docs state that `fallback_adapter` runs only when the primary adapter fails, not on a low-confidence answer, and describe the judgment policy without Jev.

## 4. Build order

1. Criteria 1 to 3.
2. Criteria 4 to 14.
3. Criteria 15 to 18.
4. v0.17.1 release preparation.

## 5. Value sources

- Outage and no-Jev policy: roadmap section "Judgment policy without Jev", decided 2026-10-04.
- Heuristic behavior: `ScriptJudgmentAdapter.evaluate` in `packages/runtime/src/core/judgment-engine.ts`.
- Adapter selection and fallback cascade: `JudgmentEngine.evaluate` in the same file.
- Fallback routing: `FSMEngine.handleSignal` routes only when a failed guard has a `fallbackTarget`.
- Leaking suites: issue #28 and a count of `new FSMEngine(` calls without `workspaceDir` in `packages/runtime/tests`.

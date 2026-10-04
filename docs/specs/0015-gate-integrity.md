# Specification: Gate Integrity (v0.17.1)

Status: Implemented on `fix/r2-gate-integrity`; amended after review on 2026-10-04.

Scope: `docs/scope/release-v0.17.1-gate-integrity.md`.
Decision record: `docs/adr/0011-judgment-outage-refusal-and-self-reported-decisions.md`.

## 1. Test output containment (#28)

1. Every runtime and AXI test that constructs an engine, or a file-backed event store, passes a temporary `workspaceDir` and removes it afterwards, so neither projections nor ledger stores land in the repository; containment is verified from a clean checkout state.
2. A Vitest global setup in the runtime and AXI packages records directories up to three levels under `.docs/` and `.reactive/` at the repository root, in `packages/runtime`, and in `apps/axi` (deeper run folders inside skill stores are ignored so concurrent agent runs do not trip it), and its teardown fails the run when new ones appear; a permanent test covers the guard.
3. Leaked `.docs/jobs/<id>/` folders at the repository root whose only file is `test-fsm-summary.md` are removed once, after the fix lands.

## 2. Outage refusal and self-reported decisions (#22 part 1)

4. `isExecutableCriterion(criterion)` returns true when `(criterion)` compiles as a JavaScript expression and is not a single bare word other than `payload`, `context`, `event`, `state`, or `req`; it never executes the criterion.
5. When the script adapter decides from the payload because the criterion is not executable, its result sets `selfReported: true`.
6. An outage is a failure, or an open circuit breaker, of the selected primary model adapter (Jev or any registered adapter except `script`) while it reports itself available, or an open Jev circuit that made the script adapter the default.
7. During an outage, a judgment whose criterion is not executable returns `passed: false`, band `unevaluable`, `fallbackTriggered: true` (the cascade ran), no `fallbackTarget`, and an error naming the unavailable adapter with a retry instruction.
8. During an outage, an executable criterion is evaluated by the script fallback as before.
9. When Jev is not configured (no `TYPESAFE_API_KEY`), the heuristic decides a natural-language criterion as before, and the result keeps `selfReported: true`; with the key set but the SDK missing or broken, Jev is configured and an outage applies.
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

## 3a. Review amendments

19. An executable criterion that throws at runtime returns `passed: false` with the error, is not marked self-reported, and never falls back to the payload heuristic, with or without a configured model.
20. A single bare word that is not a sandbox name is natural language, for both the engine and `validate`.
21. Replaying a refused signal with the same idempotency key returns `transitioned: false` with the original `refusalReason`, and the unevaluable reason tells the agent to use a new idempotency key when retrying.
22. During an outage, when the declared fallback adapter is another model and it also fails, the judgment is unevaluable and has no `fallbackTarget`.
23. The concepts doc no longer claims that an outage routes to `fallback_target`.
24. Replaying a signal that transitioned, including through a parent handler after a leaf refusal, returns no `refusalReason`; the replay reads only events caused by that signal.
25. `validate` warns when a criterion that does not end in a question mark starts with a sandbox reference (including optional chaining) or uses JavaScript-only operators but does not compile, and suggests fixing the expression or rephrasing it as a question.
26. `validate` warns when `adapter_hint` or `fallback_adapter` names an adapter other than `script` or `jev`.

## 3b. Rejected credentials (v0.17.2)

27. When the selected model adapter fails with HTTP 401 or 403, the judgment is still unevaluable, and the reason says the credentials were rejected instead of suggesting a retry.
28. For Jev, that reason says to fix or replace the key, or unset `TYPESAFE_API_KEY` to continue with self-reported decisions.
29. Timeouts, connection failures, and other HTTP errors keep the unavailable and retry reason.

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

# ADR 0011: Judgment Outage Refusal and Self-Reported Decisions

Status: Accepted.

Date: 2026-10-04.

## Context

When the script adapter cannot compile a judgment criterion as JavaScript, it decides from the payload: `exit_code === 0` or `success: true` passes a predicate, `payload.choice` picks a categorical label, and `payload.score` sets an evaluation score.

That heuristic runs in two situations.
During a Jev outage (the adapter throws, times out, or its circuit is open), the engine falls back to the script adapter.
When Jev is not configured, the engine selects the script adapter as the primary adapter.

In both cases the agent approves its own semantic gate, and the only trace is `fallbackTriggered` or `adapterSelectionReason` in the event log (#22).

Failing closed in both cases would block every semantic gate for users without a TypeSafe key, and a rejected judgment routes to `fallback_target`, which can send an agent to repair work that was never judged.

A refused signal also returns no reason, so an agent cannot tell an outage from a rejection.

## Decision

Classify a criterion as executable when it compiles as a JavaScript expression and is not a single bare word (in any script) other than the sandbox names `payload`, `context`, `event`, `state`, and `req` or a JavaScript literal such as `true`.
Classification compiles the criterion and never runs it, and `validate` uses the same rule.

An executable criterion is always decided by evaluating it.
If it throws, for example because a payload field it reads is missing, the judgment fails closed with the error and never falls back to the payload heuristic.
Only a criterion that is not executable can be decided from the payload.

During an outage, a judgment with a criterion that is not executable is unevaluable.
The engine returns `passed: false`, band `unevaluable`, no `fallbackTarget`, and an error that names the unavailable adapter and says to retry.
The signal is refused, the run stays in its current state, and no fallback transition happens.

An outage means the selected primary model adapter (Jev or any other registered adapter except `script`) reports itself available but fails or is blocked by its open circuit breaker, or an open Jev circuit made the script adapter the default.
Jev counts as configured whenever `TYPESAFE_API_KEY` is set, even when the TypeSafe SDK is missing or fails to load, so a broken install refuses instead of passing on self-report.
Any other adapter counts as configured when it reports itself available; an adapter that is not configured is not in an outage.
When the declared fallback adapter is another model that also fails during an outage, the judgment is unevaluable as well.

Replaying a refused signal with the same idempotency key returns the original refusal reason, because the key identifies that submission.
A retry after an outage needs a new idempotency key, and the refusal reason says so.

When Jev is not configured, the heuristic still decides, and the result carries `selfReported: true`.

A refused signal returns the failing guard's error as `refusalReason`.
A transition decided by a self-reported judgment returns `judgmentBasis: "self_reported"`.
The AXI emit output and the MCP emit result show both fields, and `GUARD_EVALUATED` records the full judgment result.

The policy applies to predicate, categorical, and evaluation judgments.

## Alternatives

- Fail closed everywhere: rejected because every semantic gate would stop working without a TypeSafe key.
- Treat a runtime error in an executable criterion like natural language (the behavior before this decision): rejected because an exact gate then passes whenever the payload reports `exit_code: 0`.
- Route unevaluable judgments to `fallback_target`: rejected because it sends agents to repair unjudged work and can loop during an outage.
- Opt-in heuristic per skill (`fallback_heuristic: payload_status`): rejected because users without Jev would be stuck on every skill that does not opt in.
- A separate `JUDGMENT_UNEVALUABLE` event: deferred; band `unevaluable` in `GUARD_EVALUATED` carries the same information without a new event type.

## Consequences

- A semantic gate can no longer pass on an agent's own success report while Jev is down.
- Users without Jev keep working, and every self-reported decision is visible.
- Agents see why a judgment refused a signal.
- Plain guards that return false still refuse without a reason until #32 adds guard messages.
- `validate` warns on criteria that look like code but do not compile and on adapter names that are not built in, because both silently turn a gate into a self-reported decision.
- v0.18.0 replaces self-reported decisions without Jev with human approval (#22 part 2).

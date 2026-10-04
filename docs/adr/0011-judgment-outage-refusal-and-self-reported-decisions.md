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

Classify a criterion as executable when it compiles as a JavaScript expression, without running it.
Executable criteria keep today's behavior on every path.

During a Jev outage, a judgment with a criterion that is not executable is unevaluable.
The engine returns `passed: false`, band `unevaluable`, no `fallbackTarget`, and an error that says Jev is unavailable and to retry.
The signal is refused, the run stays in its current state, and no fallback transition happens.

An outage means the selected primary adapter is Jev and Jev is available but fails, or Jev's circuit breaker is open.

When Jev is not configured, the heuristic still decides, and the result carries `selfReported: true`.

A refused signal returns the failing guard's error as `refusalReason`.
A transition decided by a self-reported judgment returns `judgmentBasis: "self_reported"`.
The AXI emit output and the MCP emit result show both fields, and `GUARD_EVALUATED` records the full judgment result.

The policy applies to predicate, categorical, and evaluation judgments.

## Alternatives

- Fail closed everywhere: rejected because every semantic gate would stop working without a TypeSafe key.
- Route unevaluable judgments to `fallback_target`: rejected because it sends agents to repair unjudged work and can loop during an outage.
- Opt-in heuristic per skill (`fallback_heuristic: payload_status`): rejected because users without Jev would be stuck on every skill that does not opt in.
- A separate `JUDGMENT_UNEVALUABLE` event: deferred; band `unevaluable` in `GUARD_EVALUATED` carries the same information without a new event type.

## Consequences

- A semantic gate can no longer pass on an agent's own success report while Jev is down.
- Users without Jev keep working, and every self-reported decision is visible.
- Agents see why a judgment refused a signal.
- Plain guards that return false still refuse without a reason until #32 adds guard messages.
- v0.18.0 replaces self-reported decisions without Jev with human approval (#22 part 2).

# Whole-cascade judgment deadlines

`judgment.total_deadline` advertises an opt-in deadline for a transition's judgment cascade.
Skills using it should declare that capability under `runtime_requirements.required_capabilities`.

```yaml
runtime_requirements:
  required_capabilities: [judgment.total_deadline]
# Within a transition:
judgment:
  type: predicate
  criterion: Does the evidence satisfy the acceptance criteria?
  adapter_hint: jev
  fallback_adapter: jev
  total_timeout_ms: 3000
  # Optional per-attempt ceiling, further limited by the remaining total budget:
  timeout_ms: 2000
  # Optional permission for the existing fallback slot to retry the same adapter:
  # retry_policy:
  #   max_attempts_per_adapter: 2
```

The total deadline starts before adapter selection and includes availability checks, evaluation, configuration detection and fallback.
Each evaluation receives `timeout_ms` capped by the remaining total budget and an `AbortSignal` in its evaluation context.
The runtime stops awaiting a custom adapter at the deadline even if it ignores cancellation.
Adapters must observe the signal to stop their own external work.
JavaScript timers cannot preempt synchronous code blocking the event loop; a late result is refused when control returns.

Bounded mode allows one invocation per adapter by default, checks fallback circuit state and never starts a fallback after the deadline.
`retry_policy.max_attempts_per_adapter: 2` permits the existing fallback slot to retry an adapter within the remaining budget; it does not add another cascade slot or override an open circuit.
The retry policy requires a total deadline.
A shorter deadline or fewer retry opportunities can prevent recovery from a transient failure.
Primary authoring and credential errors in bounded mode refuse immediately, preserving their specific guidance.
Timeouts and failures without an independent decision remain `unevaluable`, without semantic rejection, repair routing or a self-reported pass.
Probability thresholds, escalation bands, validated human approvals and the self-report grant requirement remain in effect.

Without `total_timeout_ms`, adapter selection, repeated same-adapter fallback and historical timeout propagation retain their legacy behavior.
Jev keeps its existing 3000ms default adapter timeout and disables SDK retries.
The configured SDK client is reused within one adapter instance and replaced if its API key, endpoint, default model or log configuration changes.
No network connection reuse or normal latency improvement is asserted.
Breakers remain process-local, with the existing two-failure threshold and 60-second cooldown; a fresh CLI process starts with fresh breaker state.

`JudgmentResult.latencyMs` measures the entire evaluation, including refused legacy judgments.
`attemptCount` counts actual adapter invocations.
`attempts` records adapter identity, primary/fallback stage, elapsed time, supplied timeout, invocation or skip status, failure or cancellation cause, and breaker state before and after each evaluation slot reached.
Selection time is included in aggregate latency and may result in zero invocations if selection exhausts the deadline.
Authoring errors do not increment breaker failures; bounded fallback failures and successes update their own breaker.
These fields persist inside the existing `GUARD_EVALUATED.payload.judgment`; telemetry adds no ledger append.
Replay and snapshot restoration reuse recorded results without restarting adapter work.
Each concurrent evaluation owns its timers, cancellation signal and accounting.

Offline acceptance tests cover total and per-attempt deadlines, distinct and repeated adapters, cooperative cancellation, ignored cancellation, SDK client lifetime, failure categories, circuit state, thresholds, grants, approvals, concurrent evaluations, durable replay, snapshots and legacy behavior.
They call no external model and provide no estimate of normal provider latency.

# MCP continuation views

Negotiate `state.continuation_v1` with `reactive_capabilities`, then pass `return_view: "compact-v1"` to `reactive_emit_signal` or `reactive_respond_human`.
Omitting `return_view` keeps each tool's existing receipt shape.
The option selects this envelope instead:

```json
{
  "receipt": {"transitioned": true, "previousState": "WORK", "newState": "NEXT", "event_id": "signal-id"},
  "replayed": false,
  "result_view": {"run_id": "immutable-run-id", "seq": 12},
  "view": {"format": "compact-v1", "run_id": "immutable-run-id", "seq": 12, "state": "NEXT", "prompt": "Next instructions", "context": {}, "tools": [], "contracts": [], "policy": "..."}
}
```

The abbreviated example omits other receipt and conditional state fields.
`view` uses the same complete state contract as `reactive_state` with `output: "compact-v1"`: one rendered prompt, one current scoped context, ordered leaf/ancestor contracts, tools, run identity and active gate/refusal/model/strict metadata.
The view is generated after persisted transitions, queued lifecycle signals, declared child invocation and projections settle.
It describes the state actually reached, including self-loops and terminal states.
Refused or unhandled inputs return the current view with refusal guidance.
Human gate instructions still require stopping and waiting; this tool cannot approve a pending judgment gate.
Self-report and human judgment warnings remain attached to their receipt and to the matching result view.

Consume `view` directly after each completed state instead of issuing an additional `reactive_state` call.
Fetch state for initial delivery, session resume, transcript compaction, stale state or recovery.
Keep `job_id` set to the immutable `run_id` from the first view, including after completion.
Continuation rendering never rotates a terminal run.
A strict continuation calls the same `recordStateDelivery()` helper as a state fetch exactly once.
Up to `refetch_allowance` repeat fetches of that delivered view remain uncounted; further polling counts toward the idle limit.
Non-strict runs add no turn bookkeeping.

For reliable retries, send `idempotency_key` and keep the same `job_id`, key and operation when retrying.
Keys are unique within the selected run across signal and human-response operations.
A key identifies the original submission, including its payload or human decision; changing a payload under the same key does not submit a new decision.
Human responses bind one recorded decision to the existing ordered `USER_RESPONSE` and mapped approval/rejection signals.
The approval boolean default and choice precedence are unchanged.

Keyed continuation operations persist a small `MCP_CONTINUATION_RECORDED` event containing the receipt and original `result_view` anchor, without storing another prompt or context copy.
Unkeyed continuation operations do not add that event.
Retries return `replayed: true`, the saved original `receipt` and `result_view`, plus the separately labeled current `view`.
The current view can be later than the original result; compare its sequence with `result_view.seq`.
A retry adds no transition, decision, approval request or delivery count and consumes no refetch allowance.
It never reapplies an old refusal or warning to a later view; those remain available in the original receipt.

If a signal key predates continuation receipts, or execution stopped after a signal or human-response signal committed but before its receipt was saved, the response explicitly marks `receipt.result_unavailable: true` and returns `replayed: true` with `result_view: null` alongside the current view.
It does not invent an original transition result or resubmit a committed signal; an interrupted human response still dispatches any of its signals that never committed.
Such a recovery, like any duplicate, appends no delivery or receipt, so it cannot invalidate an original whose guard is still pending; the committing process counts its reached view, and if that process died a later `reactive_state` fetch counts it.
A keyed submission's delivery is itself keyed to that submission, so competing processes delivering the same result share one recorded delivery.
Likewise a keyed signal (emit or human-response) that another server process commits between this process's lookup and its own append is treated as a replay: it evaluates no guard, records no second transition, and returns `result_unavailable`, so the committing process keeps ownership of the original result.
Use the current view to recover; do not submit a new key merely to recreate a lost response.
Same-process MCP clients serialize complete mutation operations per immutable run, refreshing cached engines before work.
State reads remain independent so recovery can inspect a run during an in-flight judgment.
Existing runtime version-conflict checks remain in force for external writers; on conflict reload the same run before continuing.
There is no new cross-process transaction or retry guarantee across an interrupted multi-signal human response.

Moving a prompt from a fetch into an emit does not remove its bytes.
This mode avoids the additional fetch request/response envelope and scheduling round trip; host scheduling and model-turn savings require a separate end-to-end measurement.

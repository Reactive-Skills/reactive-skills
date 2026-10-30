# MCP continuation views

`reactive_emit_signal` and `reactive_respond_human` return a continuation envelope by default.
`return_view` selects its view: `delta-v1` (the default when `state.delta_v1` is advertised), `compact-v1` for the complete view, or `none` for the legacy bare receipt, which is kept for one release.
With `compact-v1` the envelope looks like this:

```json
{
  "receipt": {"transitioned": true, "previousState": "WORK", "newState": "NEXT", "event_id": "signal-id"},
  "replayed": false,
  "result_view": {"run_id": "immutable-run-id", "seq": 12},
  "view": {"format": "compact-v1", "run_id": "immutable-run-id", "seq": 12, "state": "NEXT", "prompt": "Next instructions", "context": {}, "tools": [], "contracts": [], "policy": "..."}
}
```

The abbreviated example omits other receipt and conditional state fields.
Receipt `projectionsWritten` paths are relative to the server's workspace, the `workspace` field of `reactive_capabilities` (capability `receipt.relative_paths`).
`receipt_paths: "absolute"` returns absolute paths instead and is kept for one release.
The option shapes only the response: saved receipts keep absolute paths, so a keyed retry returns the form that the retry requests.
`view` uses the same complete state contract as `reactive_state` with `output: "compact-v1"`: one rendered prompt, one current scoped context, ordered leaf/ancestor contracts, tools, run identity and active gate/refusal/model/strict metadata.
The view is generated after persisted transitions, queued lifecycle signals, declared child invocation and projections settle.
It describes the state actually reached, including self-loops and terminal states.
Refused or unhandled inputs return the current view with refusal guidance.
Human gate instructions still require stopping and waiting; this tool cannot approve a pending judgment gate.
Self-report and human judgment warnings remain attached to their receipt and to the matching result view.

## Delta views

A `delta-v1` view keeps `seq`, `state`, the rendered `prompt`, `tools`, `contracts` and the active gate, strict, model and refusal metadata, and adds `since_seq`.
Its `context` holds only the scoped keys the ledger committed after `since_seq`, plus keys the anchored view's scope did not expose.
Changed keys whose committed value equals what the triggering submission supplied are listed in `context_accepted` instead of being echoed.
The recovery `policy` is omitted; it is part of the complete view.

The anchor is the `since_seq` argument when given; pass the `seq` of a view from the same run.
Otherwise it is the last view sequence this MCP session delivered for the run.
A run the session has not delivered (a new session after a crash, or a job switch) receives the complete `compact-v1` view, and so does a retried or recovered submission.
When the ledger window cannot be folded safely, for example after a reset, the complete view is returned.
`reactive_state` without `since_seq` always returns the complete view rebuilt from the ledger; use it after host transcript compaction.
`reactive_state` with `since_seq` returns a `delta-v1` view.
Context a delta view omits can be fetched on request with `reactive_state` and `include_full_context: true`, or with `reactive_query_events` filtered by `type`, `sinceSeq` and `limit`.

## Delivery

Consume `view` directly after each completed state instead of issuing an additional `reactive_state` call.
Fetch state for initial delivery, session resume, transcript compaction, stale state or recovery.
Keep `job_id` set to the immutable `run_id` from the first view, including after completion.
Continuation rendering never rotates a terminal run.
An original strict continuation calls the same `recordStateDelivery()` helper as a state fetch exactly once.
A recovered view that has no recorded delivery counts once per run and view sequence, including after an interrupted emit or human response.
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
A retry with a saved receipt adds no transition, decision, approval request or delivery count and consumes no refetch allowance.
It never reapplies an old refusal or warning to a later view; those remain available in the original receipt.

If a signal key predates continuation receipts, or execution stopped after a signal or human-response signal committed but before its receipt was saved, the response explicitly marks `receipt.result_unavailable: true` and returns `replayed: true` with `result_view: null` alongside the current view.
It does not invent an original transition result or resubmit a committed signal; an interrupted human response still dispatches any of its signals that never committed.
Recovery records one local delivery credit per `(run_id, view.seq)` in SQLite metadata beside the execution events, without appending `AGENT_TURN_STARTED`, `STATE_VIEW_REFETCHED` or a continuation receipt.
This credit advances `turns_since_signal` when the view has not already been delivered, survives reopening the same store, and leaves the run version unchanged, so recovery cannot invalidate an original whose guard is still pending.
Repeating recovery of that same view adds no credit and consumes no refetch allowance; up to `refetch_allowance` subsequent state fetches remain free before polling counts toward the idle limit.
If the original response later records its keyed delivery, that event absorbs the recovery credit, preserving one counted delivery.
A signal or state transition resets strict idle accounting, including older recovery credits.
Recovered and saved-receipt views suppress prompt-slice telemetry events so slow rendering also leaves the run version unchanged.
Recovery does not itself append a bypass transition; normal strict-turn checks include its credit and enforce the idle limit.
Delivery credits are local bookkeeping, omitted from event exports and JSONL; rebuilding or replacing the SQLite store from event history does not restore them.
Likewise a keyed signal (emit or human-response) that another server process commits between this process's lookup and its own append is treated as a replay: it evaluates no guard, records no second transition, and returns `result_unavailable`, so the committing process keeps ownership of the original result.
Use the current view to recover; do not submit a new key merely to recreate a lost response.
Same-process MCP clients serialize complete mutation operations per immutable run, refreshing cached engines before work.
State reads remain independent so recovery can inspect a run during an in-flight judgment.
Existing runtime version-conflict checks remain in force for external writers; on conflict reload the same run before continuing.
There is no new cross-process transaction or retry guarantee across an interrupted multi-signal human response.

Moving a prompt from a fetch into an emit does not remove its bytes.
This mode avoids the additional fetch request/response envelope and scheduling round trip; host scheduling and model-turn savings require a separate end-to-end measurement.

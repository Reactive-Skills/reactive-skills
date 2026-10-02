# Event Sourcing

Never mutate execution history.

All signals, guard checks, and state transitions append to one skill-scoped SQLite ledger:

- `.reactive/skills/<skill>/events.db`

Every event carries an immutable UUID-backed `run_id` and a sequence ordered within that run.

The runtime writes per-run filesystem state under `.reactive/skills/<skill>/runs/<run_id>/`.

The JSONL file is a recoverable projection of SQLite:

- `.reactive/skills/<skill>/events.jsonl` (JSON Lines export)

SQLite is the canonical event ledger.

If JSONL projection fails, the next runtime open or explicit reconciliation repairs it from SQLite.

A signal changes context only through the transition it causes.
Guards and judgments read the stored context plus the signal's payload fields named in `context_keys`.
Guards read the signal's own `contextUpdates` through `payload.contextUpdates`, and Jev judgments receive the payload as `event`.
Refused and unhandled signals stay in the ledger but leave context unchanged, both live and when a run is rehydrated.

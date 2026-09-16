# Event Sourcing

Never mutate execution history. All signals, guard checks, and state transitions must append to skill-scoped `EventStore` files:

- `.reactive/skills/<skill>/events.jsonl` (JSON Lines)
- `.reactive/skills/<skill>/events.db` (SQLite)

This ensures complete replayability and auditability of every skill execution.
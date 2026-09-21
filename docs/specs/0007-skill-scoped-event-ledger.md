# Specification: Skill-Scoped Event Ledger and UUID-Backed Runs

Status: Implemented.

Target: `@reactive-skills/runtime` and `reactive-skills-axi`.

Related decisions: `docs/adr/0007-skill-scoped-event-ledger.md`.

Supersedes the per-job database assumption in `docs/adr/0003-job-targeted-live-telemetry.md` and `docs/adr/0004-multi-job-telemetry-broker.md`.

## 1. Intent

Store one canonical SQLite event ledger per skill.

Keep artifacts and logs isolated by run.

Use immutable UUIDv7-style `run_id` values as event and filesystem identity.

Keep human-readable run aliases separate and mutable.

Preserve HSM execution, replay, resume, projections, telemetry, lifecycle behavior, and legacy compatibility.

## 2. Current Evidence

`EventStore` currently places `events.db` and `events.jsonl` under each job directory when a job ID exists.

`EventStore.append()` writes SQLite first and JSONL directly afterward.

The current event schema makes `run_id` optional and uses a database-wide sequence counter.

Snapshots, projections, and projection watermarks are not explicitly run-scoped in their schema.

`JobManager` currently uses one job ID for filesystem identity, event identity, and display name.

`FSMEngine` does not serialize concurrent signals targeting one run.

The runtime has no dedicated artifact or log writer abstraction.

## 3. Storage Contract

Use the repository runtime directory as the persistence boundary.

```text
.reactive/skills/<skill>/
  events.db
  events.jsonl
  active_job
  runs/<run-id>/
    job.json
    artifacts/
    logs/
```

`.docs/<skill>/` remains the projection and deliverable namespace.

Legacy `.reactive/skills/<skill>/jobs/<job-id>/` directories remain readable during migration.

New run directories use canonical UUID-backed `run_id` values.

## 4. Run Identity

Every new run receives a generated UUIDv7-style `run_id`.

`run_id` never changes.

An optional alias is stored separately and can be added or renamed later.

Events, foreign keys, snapshots, projections, telemetry cursors, and filesystem paths use `run_id`.

CLI lookup accepts either `run_id` or an active alias.

`--run-id` identifies a run explicitly.

`--name` sets an alias for a new run or changes an existing alias.

Legacy `--job` values remain accepted as compatibility aliases.

Aliases are unique within a skill while active.

## 5. SQLite Schema

Increase the event-store schema version using the existing numeric migration convention.

Add a `runs` table keyed by `run_id`.

The `runs` table stores skill ID, display alias, status, current state, parent run ID, version, and lifecycle timestamps.

Make `events.run_id` required and reference `runs(run_id)` with foreign-key enforcement enabled.

Keep `events.seq` as per-run sequence and enforce `UNIQUE(run_id, seq)`.

Retain a database-wide `ledger_seq` for append order, JSONL export order, and cross-run telemetry diagnostics.

Keep event ID unique.

Index `(run_id, seq)`, `(run_id, event_type)`, state, correlation ID, and ledger sequence.

Add `run_id` to snapshot, projection, and projection-watermark keys.

Add an idempotency key for signal events with a run-scoped uniqueness constraint.

Keep payloads and event metadata compatible with the current `SignalEvent` envelope.

Enable `PRAGMA foreign_keys = ON`.

Use WAL mode where supported.

Use the existing busy timeout plus bounded retry for transient `SQLITE_BUSY` failures.

## 6. Concurrency

Serialize signal handling per `run_id`.

Use an in-process mutex for same-process callers.

Use a run-scoped filesystem lock for cross-process callers.

Use a run version check so stale engines cannot commit a transition.

Keep SQLite transactions limited to sequence allocation, event insertion, run-version updates, and commit.

Do not hold SQLite transactions during guards, model calls, artifact generation, or external process execution.

Treat duplicate signal submissions with the same idempotency key as one logical signal.

Make stale or conflicting submissions reload current run state before retrying or returning a deterministic conflict.

## 7. JSONL Projection

SQLite is the only event source of truth.

`events.jsonl` is a recoverable export projection.

Export committed SQLite events in `ledger_seq` order.

Track JSONL projection progress in SQLite.

Reconcile missing, partial, or duplicate JSONL lines from SQLite on open and through an explicit reconciliation path.

Keep JSONL projection failures from invalidating committed SQLite events.

Retain the current rebuild command as a legacy import path only when SQLite must be reconstructed from an old JSONL-only store.

## 8. Filesystem Artifacts and Logs

Create run directories when a run is created.

Keep artifact and log bodies outside SQLite.

Record relative paths, hashes, sizes, and lifecycle status in event payloads where metadata is required.

Use atomic temporary-file rename for completed artifact and log files.

Reconcile files created before metadata commit.

Mark metadata pending when an event commits before file creation completes.

Make resume idempotently finalize or mark pending filesystem work.

## 9. Migration

Detect skill-root stores and all per-job stores.

Prefer existing SQLite data when both SQLite and JSONL exist.

Use JSONL only to recover a missing SQLite store.

Generate UUID-backed run IDs for legacy non-UUID job IDs.

Preserve old job IDs as aliases.

Copy events into the shared database while preserving event IDs, metadata, and per-run order.

Copy or reference existing artifact and log directories without deleting legacy data.

Make migration idempotent.

Keep legacy directories available for rollback and compatibility reads.

## 10. Acceptance Criteria

1. Two runs of one skill share one `events.db`.

2. Events from different runs remain isolated through `run_id`.

3. `(run_id, seq)` is unique and ordered.

4. Foreign-key enforcement is enabled and tested.

5. Concurrent different-run appends succeed without event loss.

6. Concurrent same-run signals cannot apply stale transitions.

7. Duplicate idempotent signals produce one logical transition.

8. Busy database writes retry within a bounded policy.

9. SQLite remains readable after append or projection failure.

10. JSONL can be reconciled from SQLite after interruption.

11. Resume and replay use only the selected run stream.

12. Snapshots, projections, telemetry, and artifact metadata remain run-consistent.

13. Existing per-job stores migrate without destructive deletion.

14. New and migrated runs expose immutable UUID-backed IDs and separate aliases.

15. Runtime and skill-management guidance describe the new contract.

## 11. Non-Requirements

Do not change HSM topology.

Do not store large artifact or log bodies in SQLite.

Do not add an external database or message broker.

Do not modify `CHANGELOG.md` manually.

## 12. Build Order

1. Add schema migration and run identity model.

2. Refactor `EventStore` to shared skill storage with run-scoped queries.

3. Add per-run serialization, version checks, idempotency, and busy retry.

4. Refactor JSONL into a recoverable SQLite projection.

5. Add run filesystem helpers and migration.

6. Update FSM, projection, telemetry, MCP, and AXI consumers.

7. Update `skill-manager` guidance and generated bootloader guidance.

8. Add Beta test coverage and run repository verification commands.

## 13. Value Sources

- Event model: `packages/runtime/src/core/types.ts`.
- Current persistence: `packages/runtime/src/core/event-store.ts`.
- Run lifecycle: `packages/runtime/src/core/job-manager.ts`.
- State execution: `packages/runtime/src/core/fsm-engine.ts`.
- Projections: `packages/runtime/src/core/projection-engine.ts`.
- Telemetry: `packages/runtime/src/telemetry/server.ts` and `packages/runtime/src/telemetry/broker.ts`.
- CLI contracts: `apps/axi/src/commands/`.
- Migration convention: `packages/runtime/MIGRATION.md`.
- Skill guidance: `skill-manager/SKILL.md` and repository `.agents/references/`.

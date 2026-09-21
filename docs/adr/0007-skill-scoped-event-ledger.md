# ADR 0007: Skill-Scoped Event Ledger and UUID-Backed Runs

Status: Accepted.

Date: 2026-09-21.

## Context

The runtime currently stores SQLite and JSONL event data per job.

That boundary duplicates databases across concurrent runs of one skill.

It also makes cross-run inspection, migration, and canonical event ordering harder.

The current guidance and implementation both encode the per-job database model.

The runtime must keep per-run filesystem isolation while sharing SQLite per skill.

## Decision

Use one canonical SQLite database per skill.

Scope every event, snapshot, projection, and watermark by immutable UUID-backed `run_id`.

Use generated UUIDv7-style values for new runs.

Store mutable human-readable aliases separately.

Keep run artifacts and logs in run-scoped filesystem directories.

Make JSONL a recoverable projection of SQLite.

Use short SQLite transactions plus per-run serialization and version checks.

Keep runtime storage under `.reactive/skills/<skill>/`.

Keep `.docs/<skill>/` for projections and generated deliverables.

## Alternatives Considered

Per-run SQLite databases were rejected because they duplicate skill storage and do not satisfy the shared-ledger requirement.

A workspace-wide SQLite database was rejected because it weakens skill isolation and broadens contention.

A shared index over per-run databases was rejected because it creates multiple persistence authorities.

Moving the canonical database under `.docs` was rejected for this slice because the repository uses `.docs` as a projection namespace.

Using mutable aliases as event identity was rejected because renames would destabilize event and filesystem references.

## Consequences

Concurrent runs share one SQLite file but retain independent event streams.

Queries and projections must always include `run_id`.

Migration must combine legacy per-job stores without deleting source data.

Telemetry and CLI readers must stop discovering one database per job.

Skill-management guidance must describe run IDs and aliases without owning persistence.

The shared database becomes a larger contention point, so WAL, busy retry, and short transactions are required.

## Supersession

This ADR supersedes the per-job storage assumption described by ADR 0003 and ADR 0004.

Their telemetry selection and isolation goals remain valid.

Their database path and sequence-domain assumptions require update during implementation.

-NoNewline
# Event Store Schema Migrations

This file tracks all SQLite schema changes for the Reactive Skills event store.

## Current Schema Version: 3

## How Migrations Work

The `SQLiteStorageDriver` automatically applies pending migrations on initialization:

1. A `schema_version` table tracks which migrations have been applied
2. On init, the driver inspects the current schema against `EVENT_STORE_SCHEMA_VERSION`
3. If the DB is behind, the legacy tables are copied transactionally into the current schema
4. Each migration is idempotent and safe to run multiple times

To add a new migration:
1. Bump `EVENT_STORE_SCHEMA_VERSION` in `event-store.ts`
2. Add a migration block in the driver initialization path
3. Document it below

## Migration History

### v1 (initial SQLite support)

Base schema creation:
- `events` table with core fields (id, seq, timestamp, type, payload, state, source, causation_id)
- `projections` table for materialized deliverables
- `state_snapshots` table for point-in-time state
- `projection_watermarks` table for projection tracking

Applied automatically by `initTables()` on first run.

### v2 (event envelope expansion)

Added fields to `events` table to match the full `SignalEvent` interface:
- `event_id` - alternate identifier
- `occurred_at` - occurrence timestamp
- `event_type` - alternate event type
- `correlation_id` - cross-skill correlation
- `request_id` - request-level tracking
- `trace_parent` - distributed tracing
- `skill_id` - skill identifier
- `run_id` - execution run identifier
- `parent_run_id` - parent run for child skills
- `schema_version` - event schema version

Migration method: `ALTER TABLE events ADD COLUMN` for each missing column.

### v3 (skill-scoped ledger and run isolation)

Version 3 stores one database per skill and scopes events, snapshots, projections, and watermarks by `run_id`.

The `events` table enforces `UNIQUE(run_id, seq)` and foreign-key references to `runs`.

`ledger_seq` preserves database-wide append order for projections while `seq` remains per-run.

`idempotency_key` supports duplicate signal submission handling.

SQLite enables foreign keys, WAL mode, a busy timeout, and bounded retry behavior for transient writer contention.

Existing v1 and v2 databases are rebuilt transactionally into the v3 tables.

Existing per-job stores are imported by the runtime into UUID-backed `runs/` directories and the shared skill database.

Legacy files remain in place for operator rollback and audit until explicitly removed.

## Adding Future Migrations

When you change the SQLite schema:

1. Update `EVENT_STORE_SCHEMA_VERSION` constant
2. Add migration block in `runMigrations()`:
   ```ts
   if (fromVersion < N) {
     // Apply N: description of what changed
     this.db.exec(`ALTER TABLE ...`);
     this.db.exec(`INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (N, datetime('now'))`);
   }
   ```
3. Document the migration below with date, description, and affected tables
4. Run `npm run build` to verify TypeScript compiles
5. Run `npm test` to verify tests pass

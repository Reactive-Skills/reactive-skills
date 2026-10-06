import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** The schema-v2 ledger older runtimes wrote: no foreign keys, run_id a plain column, one run per file. */
const LEGACY_V2_SCHEMA = `
  CREATE TABLE events (
    id TEXT PRIMARY KEY, event_id TEXT, seq INTEGER NOT NULL, timestamp TEXT NOT NULL, occurred_at TEXT,
    type TEXT NOT NULL, event_type TEXT, state TEXT, source TEXT, causation_id TEXT, correlation_id TEXT,
    request_id TEXT, trace_parent TEXT, skill_id TEXT, run_id TEXT, parent_run_id TEXT, schema_version TEXT,
    payload TEXT NOT NULL
  );
  CREATE TABLE projections (name TEXT PRIMARY KEY, content TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE state_snapshots (seq INTEGER PRIMARY KEY, state TEXT NOT NULL, context TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE projection_watermarks (name TEXT PRIMARY KEY, event_seq INTEGER NOT NULL, projection_version TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
  CREATE TABLE seq_counter (id INTEGER PRIMARY KEY, last_seq INTEGER NOT NULL);
  INSERT INTO seq_counter (id, last_seq) VALUES (1, 1);
  INSERT INTO schema_version (version, applied_at) VALUES (2, '2026-01-01T00:00:00.000Z');
`;

function legacyEvent(skillId: string, tag: string) {
  return {
    id: `legacy-${tag}-1`,
    seq: 1,
    timestamp: '2026-01-01T00:00:00.000Z',
    type: 'SKILL_INITIALIZED',
    state: 'INIT',
    skill_id: skillId,
    run_id: 'default',
    payload: { skill: skillId, initial_state: 'INIT', active_path: ['INIT'], context: { mission: 'Legacy mission' } },
  };
}

function seedLegacyDb(file: string, skillId: string, tag: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  const event = legacyEvent(skillId, tag);
  db.exec(LEGACY_V2_SCHEMA);
  db.prepare(`
    INSERT INTO events (id, event_id, seq, timestamp, occurred_at, type, event_type, state, skill_id, run_id, payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(event.id, event.id, event.seq, event.timestamp, event.timestamp, event.type, event.type, event.state, event.skill_id, event.run_id, JSON.stringify(event.payload));
  db.prepare("INSERT INTO state_snapshots (seq, state, context, created_at) VALUES (1, 'INIT', ?, '2026-01-01T00:00:00.000Z')")
    .run(JSON.stringify(event.payload.context));
  db.close();
}

/**
 * Lay out `.reactive/skills/<skill>/` the way a workspace looks after several runtime generations:
 * the root ledger and its JSONL projection, the legacy per-job directory, and the newer runs/ directory.
 */
export function seedMixedLegacyStore(workspaceDir: string, skillId: string): string {
  const store = path.join(workspaceDir, '.reactive', 'skills', skillId);
  seedLegacyDb(path.join(store, 'events.db'), skillId, 'root');
  fs.writeFileSync(path.join(store, 'events.jsonl'), `${JSON.stringify(legacyEvent(skillId, 'root'))}\n`);

  const legacyJob = path.join(store, 'jobs', 'default');
  seedLegacyDb(path.join(legacyJob, 'events.db'), skillId, 'job');
  fs.writeFileSync(path.join(legacyJob, 'job.json'), JSON.stringify({
    id: 'default', name: 'default', skillId, status: 'active', currentState: 'INIT',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  }));

  fs.mkdirSync(path.join(store, 'runs', 'default', 'artifacts'), { recursive: true });
  fs.mkdirSync(path.join(store, 'runs', 'default', 'logs'), { recursive: true });
  return store;
}

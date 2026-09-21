import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { EventContext, SignalEvent } from './types.js';

export const EVENT_STORE_SCHEMA_VERSION = 3;

export type EventListener = (event: SignalEvent) => void;

export function createSortableId(): string {
  const bytes = crypto.randomBytes(16);
  const timestamp = BigInt(Date.now());
  for (let index = 0; index < 6; index++) {
    bytes[index] = Number((timestamp >> BigInt((5 - index) * 8)) & 0xffn);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface EventStoreOptions {
  storagePath?: string;
  sqlitePath?: string;
  workspaceDir?: string;
  skillId?: string;
  jobId?: string;
  runId?: string;
  run_id?: string;
  runName?: string;
  run_name?: string;
  idempotencyKey?: string;
  idempotency_key?: string;
  correlationId?: string;
  correlation_id?: string;
  requestId?: string;
  request_id?: string;
  traceParent?: string;
  trace_parent?: string;
  parentRunId?: string;
  parent_run_id?: string;
  schemaVersion?: string;
  schema_version?: string;
  inMemory?: boolean;
  enableSqlite?: boolean;
  maxInMemoryEvents?: number;
  maxJsonlBytes?: number;
  acquireLock?: boolean;
  readOnly?: boolean;
}

export interface EventQueryOptions {
  type?: string;
  state?: string;
  sinceSeq?: number;
  limit?: number;
  runId?: string;
  allRuns?: boolean;
}

type RunMetadata = {
  name?: string;
  skillId?: string;
  status?: string;
  currentState?: string;
  parentRunId?: string;
};

function isBusyError(error: any): boolean {
  return error?.code === 'SQLITE_BUSY' || /SQLITE_BUSY|database is locked/i.test(String(error?.message || error));
}

function pauseSync(milliseconds: number): void {
  const buffer = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(buffer), 0, 0, milliseconds);
}

/** SQLite storage for one skill ledger. */
export class SQLiteStorageDriver {
  private db: DatabaseSync;
  private isClosed = false;
  private readonly readOnly: boolean;
  private readonly defaultRunId: string;
  private readonly defaultSkillId?: string;

  constructor(dbPath: string, options: { readOnly?: boolean; runId?: string; skillId?: string } = {}) {
    this.readOnly = options.readOnly === true;
    this.defaultRunId = options.runId || 'default';
    this.defaultSkillId = options.skillId;
    if (dbPath !== ':memory:' && !this.readOnly) fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = this.readOnly
      ? new DatabaseSync(dbPath, { readOnly: true } as any)
      : new DatabaseSync(dbPath);
    this.db.exec('PRAGMA busy_timeout = 5000');
    this.db.exec('PRAGMA foreign_keys = ON');
    if (!this.readOnly) {
      this.db.exec('PRAGMA journal_mode = WAL');
      this.initTables();
    }
  }

  private withBusyRetry<T>(operation: () => T): T {
    let lastError: unknown;
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        return operation();
      } catch (error) {
        lastError = error;
        if (!isBusyError(error) || attempt === 7) throw error;
        pauseSync(Math.min(25 * (attempt + 1), 200));
      }
    }
    throw lastError;
  }

  private tableExists(table: string): boolean {
    const row = this.db.prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as any;
    return Boolean(row);
  }

  private tableColumns(table: string): Set<string> {
    if (!this.tableExists(table)) return new Set();
    const rows = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return new Set(rows.map(row => row.name));
  }

  private createCurrentTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        run_id TEXT PRIMARY KEY,
        skill_id TEXT NOT NULL,
        name TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        current_state TEXT,
        parent_run_id TEXT,
        version INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL UNIQUE,
        ledger_seq INTEGER,
        seq INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        occurred_at TEXT,
        type TEXT NOT NULL,
        event_type TEXT,
        state TEXT,
        source TEXT,
        causation_id TEXT,
        correlation_id TEXT,
        request_id TEXT,
        idempotency_key TEXT,
        trace_parent TEXT,
        skill_id TEXT,
        run_id TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
        parent_run_id TEXT,
        schema_version TEXT,
        payload TEXT NOT NULL,
        UNIQUE(run_id, seq)
      );
      CREATE INDEX IF NOT EXISTS idx_events_run_seq ON events(run_id, seq);
      CREATE INDEX IF NOT EXISTS idx_events_ledger_seq ON events(ledger_seq);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(run_id, type);
      CREATE INDEX IF NOT EXISTS idx_events_state ON events(run_id, state);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_events_run_idempotency
        ON events(run_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
      CREATE TABLE IF NOT EXISTS run_counters (
        run_id TEXT PRIMARY KEY REFERENCES runs(run_id) ON DELETE CASCADE,
        last_seq INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS ledger_counter (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_seq INTEGER NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO ledger_counter (id, last_seq) VALUES (1, 0);
      CREATE TABLE IF NOT EXISTS projections (
        run_id TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(run_id, name)
      );
      CREATE TABLE IF NOT EXISTS state_snapshots (
        run_id TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        state TEXT NOT NULL,
        context TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(run_id, seq)
      );
      CREATE TABLE IF NOT EXISTS projection_watermarks (
        run_id TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        event_seq INTEGER NOT NULL,
        projection_version TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(run_id, name)
      );
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
  }

  private initTables(): void {
    this.db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
    const eventColumns = this.tableColumns('events');
    const versionRow = this.db.prepare('SELECT MAX(version) AS v FROM schema_version').get() as { v: number | null };
    const currentVersion = Number(versionRow?.v || 0);
    const isCurrent = eventColumns.has('ledger_seq') && eventColumns.has('idempotency_key') && eventColumns.has('run_id');

    if (this.tableExists('events') && (!isCurrent || currentVersion < EVENT_STORE_SCHEMA_VERSION)) {
      this.migrateLegacySchema();
    } else {
      this.createCurrentTables();
      if (currentVersion < EVENT_STORE_SCHEMA_VERSION) {
        this.db.prepare('INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?, ?)')
          .run(EVENT_STORE_SCHEMA_VERSION, new Date().toISOString());
      }
    }
    this.ensureRun(this.defaultRunId, { skillId: this.defaultSkillId });
  }

  private migrateLegacySchema(): void {
    const legacyEventColumns = this.tableColumns('events');
    const legacyOrder = legacyEventColumns.has('ledger_seq') ? 'COALESCE(ledger_seq, rowid), seq, rowid' : 'seq, rowid';
    const legacyEvents = this.tableExists('events')
      ? this.db.prepare(`SELECT * FROM events ORDER BY ${legacyOrder}`).all() as any[]
      : [];
    const legacyProjections = this.tableExists('projections') ? this.db.prepare('SELECT * FROM projections').all() as any[] : [];
    const legacySnapshots = this.tableExists('state_snapshots') ? this.db.prepare('SELECT * FROM state_snapshots ORDER BY seq').all() as any[] : [];
    const legacyWatermarks = this.tableExists('projection_watermarks') ? this.db.prepare('SELECT * FROM projection_watermarks').all() as any[] : [];

    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const table of ['events', 'projections', 'state_snapshots', 'projection_watermarks']) {
        if (this.tableExists(table)) this.db.exec(`ALTER TABLE ${table} RENAME TO ${table}_legacy_v2`);
      }
      this.createCurrentTables();

      const perRunSeq = new Map<string, number>();
      const insert = this.db.prepare(`
        INSERT INTO events (
          id, event_id, ledger_seq, seq, timestamp, occurred_at, type, event_type,
          state, source, causation_id, correlation_id, request_id, idempotency_key,
          trace_parent, skill_id, run_id, parent_run_id, schema_version, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      let ledgerSeq = 0;
      for (const row of legacyEvents) {
        const runId = row.run_id || this.defaultRunId;
        this.ensureRun(runId, { skillId: row.skill_id || this.defaultSkillId, parentRunId: row.parent_run_id });
        const seq = (perRunSeq.get(runId) || 0) + 1;
        perRunSeq.set(runId, seq);
        ledgerSeq += 1;
        insert.run(
          row.id || createSortableId(), row.event_id || row.id || createSortableId(), ledgerSeq, seq,
          row.timestamp || new Date().toISOString(), row.occurred_at || row.timestamp || new Date().toISOString(),
          row.type, row.event_type || row.type, row.state || null, row.source || null,
          row.causation_id || null, row.correlation_id || null, row.request_id || null, row.idempotency_key || null,
          row.trace_parent || null, row.skill_id || this.defaultSkillId || null, runId,
          row.parent_run_id || null, row.schema_version || null, row.payload || '{}',
        );
      }
      for (const [runId, seq] of perRunSeq) {
        this.db.prepare('INSERT OR REPLACE INTO run_counters (run_id, last_seq) VALUES (?, ?)').run(runId, seq);
        this.db.prepare('UPDATE runs SET version = ?, updated_at = ? WHERE run_id = ?').run(seq, new Date().toISOString(), runId);
      }
      this.db.prepare('UPDATE ledger_counter SET last_seq = ? WHERE id = 1').run(ledgerSeq);
      for (const row of legacyProjections) {
        this.db.prepare('INSERT OR REPLACE INTO projections (run_id, name, content, updated_at) VALUES (?, ?, ?, ?)')
          .run(this.defaultRunId, row.name, row.content, row.updated_at || new Date().toISOString());
      }
      for (const row of legacySnapshots) {
        this.db.prepare('INSERT OR REPLACE INTO state_snapshots (run_id, seq, state, context, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(this.defaultRunId, row.seq, row.state, row.context, row.created_at || new Date().toISOString());
      }
      for (const row of legacyWatermarks) {
        this.db.prepare('INSERT OR REPLACE INTO projection_watermarks (run_id, name, event_seq, projection_version, updated_at) VALUES (?, ?, ?, ?, ?)')
          .run(this.defaultRunId, row.name, row.event_seq, row.projection_version, row.updated_at || new Date().toISOString());
      }
      for (const table of ['events', 'projections', 'state_snapshots', 'projection_watermarks']) {
        if (this.tableExists(`${table}_legacy_v2`)) this.db.exec(`DROP TABLE ${table}_legacy_v2`);
      }
      this.db.prepare('INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?, ?)')
        .run(EVENT_STORE_SCHEMA_VERSION, new Date().toISOString());
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  private ensureRunInternal(runId: string, metadata: RunMetadata = {}): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT OR IGNORE INTO runs
        (run_id, skill_id, name, status, current_state, parent_run_id, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      runId, metadata.skillId || this.defaultSkillId || 'unknown', metadata.name || null,
      metadata.status || 'active', metadata.currentState || null, metadata.parentRunId || null, now, now,
    );
    this.db.prepare('INSERT OR IGNORE INTO run_counters (run_id, last_seq) VALUES (?, 0)').run(runId);
  }

  public ensureRun(runId: string, metadata: RunMetadata = {}): void {
    if (this.readOnly) return;
    this.withBusyRetry(() => this.ensureRunInternal(runId, metadata));
  }

  public getRunVersion(runId = this.defaultRunId): number {
    const row = this.db.prepare('SELECT version FROM runs WHERE run_id = ?').get(runId) as { version: number } | undefined;
    return row ? Number(row.version) : 0;
  }

  public getRunIds(): string[] {
    const rows = this.db.prepare('SELECT run_id FROM runs WHERE EXISTS (SELECT 1 FROM events WHERE events.run_id = runs.run_id) ORDER BY created_at ASC').all() as Array<{ run_id: string }>;
    return rows.map(row => row.run_id);
  }

  public assertRunVersion(runId: string, expectedVersion: number): void {
    const actual = this.getRunVersion(runId);
    if (actual !== expectedVersion) {
      const error: any = new Error(`RUN_VERSION_CONFLICT: expected ${expectedVersion}, found ${actual}`);
      error.code = 'RUN_VERSION_CONFLICT';
      throw error;
    }
  }

  private nextRunSequence(runId: string): number {
    this.db.prepare('UPDATE run_counters SET last_seq = last_seq + 1 WHERE run_id = ?').run(runId);
    const row = this.db.prepare('SELECT last_seq FROM run_counters WHERE run_id = ?').get(runId) as { last_seq: number };
    return Number(row.last_seq);
  }

  private nextLedgerSequence(): number {
    this.db.prepare('UPDATE ledger_counter SET last_seq = last_seq + 1 WHERE id = 1').run();
    const row = this.db.prepare('SELECT last_seq FROM ledger_counter WHERE id = 1').get() as { last_seq: number };
    return Number(row.last_seq);
  }

  private insertEventInternal(event: SignalEvent, preserveSequence = true): SignalEvent {
    const runId = event.run_id || this.defaultRunId;
    this.ensureRunInternal(runId, { skillId: event.skill_id || this.defaultSkillId, parentRunId: event.parent_run_id });
    const seq = preserveSequence && event.seq > 0 ? event.seq : this.nextRunSequence(runId);
    const ledgerSeq = event.ledger_seq || this.nextLedgerSequence();
    const normalized: SignalEvent = { ...event, seq, ledger_seq: ledgerSeq, run_id: runId, event_id: event.event_id || event.id };
    this.db.prepare(`
      INSERT INTO events (
        id, event_id, ledger_seq, seq, timestamp, occurred_at, type, event_type,
        state, source, causation_id, correlation_id, request_id, idempotency_key,
        trace_parent, skill_id, run_id, parent_run_id, schema_version, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      normalized.id, normalized.event_id || normalized.id, normalized.ledger_seq ?? 0, normalized.seq, normalized.timestamp,
      normalized.occurred_at || normalized.timestamp, normalized.type, normalized.event_type || normalized.type,
      normalized.state || null, normalized.source || null, normalized.causation_id || normalized.causationId || null,
      normalized.correlation_id || null, normalized.request_id || null, normalized.idempotency_key || null,
      normalized.trace_parent || null, normalized.skill_id || this.defaultSkillId || null, normalized.run_id || runId,
      normalized.parent_run_id || null, normalized.schema_version || null, JSON.stringify(normalized.payload),
    );
    this.db.prepare('UPDATE run_counters SET last_seq = MAX(last_seq, ?) WHERE run_id = ?').run(normalized.seq, runId);
    this.db.prepare('UPDATE ledger_counter SET last_seq = MAX(last_seq, ?) WHERE id = 1').run(normalized.ledger_seq ?? 0);
    this.db.prepare('UPDATE runs SET version = version + 1, updated_at = ? WHERE run_id = ?').run(new Date().toISOString(), runId);
    return normalized;
  }

  public appendEvent(event: SignalEvent): SignalEvent {
    return this.withBusyRetry(() => {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        const runId = event.run_id || this.defaultRunId;
        if (event.idempotency_key) {
          const existing = this.getEventByIdempotencyKey(event.idempotency_key, runId);
          if (existing) {
            this.db.exec('COMMIT');
            return existing;
          }
        }
        const assigned = this.insertEventInternal({ ...event, seq: 0, run_id: runId }, false);
        this.db.exec('COMMIT');
        return assigned;
      } catch (error) {
        try { this.db.exec('ROLLBACK'); } catch { /* transaction already closed */ }
        throw error;
      }
    });
  }

  public insertEvent(event: SignalEvent): void {
    this.withBusyRetry(() => {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.insertEventInternal(event);
        this.db.exec('COMMIT');
      } catch (error) {
        try { this.db.exec('ROLLBACK'); } catch { /* transaction already closed */ }
        throw error;
      }
    });
  }

  public beginTransaction(): void { this.db.exec('BEGIN IMMEDIATE'); }
  public commitTransaction(): void { this.db.exec('COMMIT'); }

  public queryEvents(options: EventQueryOptions = {}): SignalEvent[] {
    let sql = 'SELECT * FROM events WHERE 1=1';
    const params: any[] = [];
    if (!options.allRuns) { sql += ' AND run_id = ?'; params.push(options.runId || this.defaultRunId); }
    else if (options.runId) { sql += ' AND run_id = ?'; params.push(options.runId); }
    if (options.type) { sql += ' AND type = ?'; params.push(options.type); }
    if (options.state) { sql += ' AND state = ?'; params.push(options.state); }
    if (options.sinceSeq !== undefined) { sql += ' AND seq > ?'; params.push(options.sinceSeq); }
    sql += options.allRuns ? ' ORDER BY ledger_seq ASC, rowid ASC' : ' ORDER BY seq ASC';
    if (options.limit) { sql += ' LIMIT ?'; params.push(options.limit); }
    return (this.db.prepare(sql).all(...params) as any[]).map(row => this.rowToEvent(row));
  }

  public getLatestSequence(runId = this.defaultRunId): number {
    const row = this.db.prepare('SELECT seq FROM events WHERE run_id = ? ORDER BY seq DESC LIMIT 1').get(runId) as { seq: number } | undefined;
    return row ? Number(row.seq) : 0;
  }

  public getLatestLedgerSequence(): number {
    const row = this.db.prepare('SELECT ledger_seq FROM events ORDER BY ledger_seq DESC LIMIT 1').get() as { ledger_seq: number } | undefined;
    return row ? Number(row.ledger_seq) : 0;
  }

  public getEventCount(runId = this.defaultRunId): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM events WHERE run_id = ?').get(runId) as { count: number } | undefined;
    return row ? Number(row.count) : 0;
  }

  public getLatestEvent(runId = this.defaultRunId): SignalEvent | null {
    const row = this.db.prepare('SELECT * FROM events WHERE run_id = ? ORDER BY seq DESC LIMIT 1').get(runId) as any;
    return row ? this.rowToEvent(row) : null;
  }

  public getEventByIdempotencyKey(key: string, runId = this.defaultRunId): SignalEvent | null {
    const row = this.db.prepare('SELECT * FROM events WHERE run_id = ? AND idempotency_key = ? LIMIT 1').get(runId, key) as any;
    return row ? this.rowToEvent(row) : null;
  }

  public hasEventId(eventId: string): boolean {
    const row = this.db.prepare('SELECT 1 AS present FROM events WHERE id = ? OR event_id = ? LIMIT 1').get(eventId, eventId) as any;
    return Boolean(row);
  }

  public importEvents(events: SignalEvent[]): number {
    if (events.length === 0) return 0;
    return this.withBusyRetry(() => {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        let imported = 0;
        for (const event of events) {
          if (this.hasEventId(event.id)) continue;
          this.insertEventInternal(event, true);
          imported += 1;
        }
        this.db.exec('COMMIT');
        return imported;
      } catch (error) {
        try { this.db.exec('ROLLBACK'); } catch { /* transaction already closed */ }
        throw error;
      }
    });
  }

  public nextSequence(runId = this.defaultRunId): number {
    return this.withBusyRetry(() => {
      this.ensureRun(runId);
      this.db.exec('BEGIN IMMEDIATE');
      try {
        const seq = this.nextRunSequence(runId);
        this.db.exec('COMMIT');
        return seq;
      } catch (error) {
        try { this.db.exec('ROLLBACK'); } catch { /* transaction already closed */ }
        throw error;
      }
    });
  }

  public getRecentEvents(limit: number, runId = this.defaultRunId): SignalEvent[] {
    const boundedLimit = Math.max(1, Math.floor(limit));
    const rows = this.db.prepare('SELECT * FROM events WHERE run_id = ? ORDER BY seq DESC LIMIT ?').all(runId, boundedLimit) as any[];
    return rows.reverse().map(row => this.rowToEvent(row));
  }

  public querySql(sql: string, params: any[] = []): any[] {
    const normalizedSql = sql.replace(/--.*(?:\r?\n|$)/g, '').trim();
    const statements = normalizedSql.split(';').map(statement => statement.trim()).filter(Boolean);
    if (statements.length !== 1 || !/^(SELECT|EXPLAIN|PRAGMA)\b/i.test(statements[0])) {
      throw new Error('Only single-statement SELECT or EXPLAIN queries are allowed.');
    }
    return this.db.prepare(sql).all(...params);
  }

  public saveSnapshot(seq: number, state: string, context: Record<string, any>, runId = this.defaultRunId): void {
    this.ensureRun(runId);
    this.db.prepare('INSERT OR REPLACE INTO state_snapshots (run_id, seq, state, context, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(runId, seq, state, JSON.stringify(context), new Date().toISOString());
  }

  public getLatestSnapshot(runId = this.defaultRunId): { seq: number; state: string; context: Record<string, any> } | null {
    const row = this.db.prepare('SELECT * FROM state_snapshots WHERE run_id = ? ORDER BY seq DESC LIMIT 1').get(runId) as any;
    return row ? { seq: Number(row.seq), state: row.state, context: JSON.parse(row.context) } : null;
  }

  public saveProjectionWatermark(name: string, eventSeq: number, projectionVersion: string, runId = this.defaultRunId): void {
    this.ensureRun(runId);
    this.db.prepare('INSERT OR REPLACE INTO projection_watermarks (run_id, name, event_seq, projection_version, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(runId, name, eventSeq, projectionVersion, new Date().toISOString());
  }

  public getProjectionWatermark(name: string, runId = this.defaultRunId): { eventSeq: number; projectionVersion: string } | null {
    const row = this.db.prepare('SELECT event_seq, projection_version FROM projection_watermarks WHERE run_id = ? AND name = ?').get(runId, name) as any;
    return row ? { eventSeq: Number(row.event_seq), projectionVersion: row.projection_version } : null;
  }

  public saveProjection(name: string, content: string, runId = this.defaultRunId): void {
    this.ensureRun(runId);
    this.db.prepare('INSERT OR REPLACE INTO projections (run_id, name, content, updated_at) VALUES (?, ?, ?, ?)')
      .run(runId, name, content, new Date().toISOString());
  }

  public getProjection(name: string, runId = this.defaultRunId): string | null {
    const row = this.db.prepare('SELECT content FROM projections WHERE run_id = ? AND name = ?').get(runId, name) as any;
    return row ? row.content : null;
  }

  public close(): void {
    if (this.isClosed) return;
    try { this.db.close(); } catch { /* already closed */ }
    this.isClosed = true;
  }

  public static getSchemaVersion(dbPath: string): number {
    const db = new DatabaseSync(dbPath);
    try {
      const table = db.prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'schema_version'").get() as any;
      if (!table) return 0;
      const row = db.prepare('SELECT MAX(version) AS v FROM schema_version').get() as { v: number | null };
      return row?.v ?? 0;
    } finally { db.close(); }
  }

  private rowToEvent(row: any): SignalEvent {
    return {
      id: row.id,
      seq: Number(row.seq),
      ledger_seq: row.ledger_seq === null || row.ledger_seq === undefined ? undefined : Number(row.ledger_seq),
      timestamp: row.timestamp,
      type: row.type,
      state: row.state || undefined,
      source: row.source || undefined,
      causationId: row.causation_id || undefined,
      event_id: row.event_id || row.id,
      occurred_at: row.occurred_at || row.timestamp,
      event_type: row.event_type || row.type,
      causation_id: row.causation_id || undefined,
      correlation_id: row.correlation_id || undefined,
      request_id: row.request_id || undefined,
      idempotency_key: row.idempotency_key || undefined,
      trace_parent: row.trace_parent || undefined,
      skill_id: row.skill_id || undefined,
      run_id: row.run_id || undefined,
      parent_run_id: row.parent_run_id || undefined,
      schema_version: row.schema_version || undefined,
      payload: JSON.parse(row.payload),
    };
  }

  public clear(): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM events WHERE run_id = ?').run(this.defaultRunId);
      this.db.prepare('DELETE FROM projections WHERE run_id = ?').run(this.defaultRunId);
      this.db.prepare('DELETE FROM state_snapshots WHERE run_id = ?').run(this.defaultRunId);
      this.db.prepare('DELETE FROM projection_watermarks WHERE run_id = ?').run(this.defaultRunId);
      this.db.prepare('DELETE FROM runs WHERE run_id = ?').run(this.defaultRunId);
      this.db.exec('COMMIT');
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch { /* transaction already closed */ }
      throw error;
    }
  }

  public clearAll(): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.exec('DELETE FROM events; DELETE FROM projections; DELETE FROM state_snapshots; DELETE FROM projection_watermarks; DELETE FROM run_counters; DELETE FROM runs; UPDATE ledger_counter SET last_seq = 0 WHERE id = 1;');
      this.db.exec('COMMIT');
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch { /* transaction already closed */ }
      throw error;
    }
  }

  public rebuildEvents(orderedEvents: SignalEvent[]): void {
    this.clearAll();
    if (orderedEvents.length === 0) return;
    this.withBusyRetry(() => {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        const ordered = [...orderedEvents].sort((a, b) => (a.ledger_seq || a.seq) - (b.ledger_seq || b.seq));
        for (const event of ordered) this.insertEventInternal(event, true);
        this.db.exec('COMMIT');
      } catch (error) {
        try { this.db.exec('ROLLBACK'); } catch { /* transaction already closed */ }
        throw error;
      }
    });
  }
}

/** Immutable append-only event store. SQLite is canonical when enabled. */
export class EventStore {
  private events: SignalEvent[] = [];
  private listeners: Set<EventListener> = new Set();
  private storagePath: string | null = null;
  private sqliteDriver: SQLiteStorageDriver | null = null;
  private sqlitePath: string | null = null;
  private runDir: string | null = null;
  private seqCounter = 0;
  private maxInMemoryEvents: number;
  private eventContext: EventContext;
  private projectionWatermarks = new Map<string, { eventSeq: number; projectionVersion: string }>();
  private latestSnapshot: { seq: number; state: string; context: Record<string, any> } | null = null;
  private maxJsonlBytes: number;
  private readonly readOnly: boolean;
  private readonly explicitRunId: boolean;
  private lockFd: number | null = null;
  private lockPath: string | null = null;

  constructor(options: EventStoreOptions = {}) {
    this.maxInMemoryEvents = options.maxInMemoryEvents || 1000;
    this.maxJsonlBytes = options.maxJsonlBytes || 10 * 1024 * 1024;
    this.readOnly = options.readOnly === true;
    this.explicitRunId = Boolean(options.jobId || options.runId || options.run_id);
    const runId = options.jobId || options.runId || options.run_id || createSortableId();
    this.eventContext = {
      skill_id: options.skillId,
      run_id: runId,
      runId,
      correlation_id: options.correlationId || options.correlation_id || createSortableId(),
      correlationId: options.correlationId || options.correlation_id,
      request_id: options.requestId || options.request_id,
      requestId: options.requestId || options.request_id,
      trace_parent: options.traceParent || options.trace_parent,
      traceParent: options.traceParent || options.trace_parent,
      parent_run_id: options.parentRunId || options.parent_run_id,
      parentRunId: options.parentRunId || options.parent_run_id,
      schema_version: options.schemaVersion || options.schema_version || '1.0.3',
      schemaVersion: options.schemaVersion || options.schema_version || '1.0.3',
    };

    if (options.inMemory) {
      if (options.enableSqlite) {
        this.sqliteDriver = new SQLiteStorageDriver(':memory:', { runId, skillId: options.skillId });
        this.sqliteDriver.ensureRun(runId, { name: options.runName || options.run_name, skillId: options.skillId });
      }
      return;
    }

    const workspaceDir = options.workspaceDir || process.cwd();
    const scopeDir = options.skillId ? path.join(workspaceDir, '.reactive', 'skills', options.skillId) : path.join(workspaceDir, '.reactive');
    this.runDir = options.skillId ? path.join(scopeDir, 'runs', runId) : path.join(scopeDir, runId);
    fs.mkdirSync(path.join(this.runDir, 'artifacts'), { recursive: true });
    fs.mkdirSync(path.join(this.runDir, 'logs'), { recursive: true });
      this.storagePath = options.storagePath
        || (options.sqlitePath ? `${options.sqlitePath}.jsonl` : path.join(scopeDir, 'events.jsonl'));
    if (options.enableSqlite || options.sqlitePath) {
      this.sqlitePath = options.sqlitePath || path.join(scopeDir, 'events.db');
      this.sqliteDriver = new SQLiteStorageDriver(this.sqlitePath, { runId, skillId: options.skillId });
      this.sqliteDriver.ensureRun(runId, { name: options.runName || options.run_name, skillId: options.skillId, parentRunId: options.parentRunId || options.parent_run_id });
      if (options.skillId) this.importLegacyRunStores(scopeDir, options.skillId);
    }
    if (options.acquireLock && this.runDir) this.acquireRunLock(this.runDir);
    this.initializeStorage();
  }

  private acquireRunLock(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
    this.lockPath = path.join(dir, '.lock');
    try {
      this.lockFd = fs.openSync(this.lockPath, 'wx');
      fs.writeSync(this.lockFd, JSON.stringify({ pid: process.pid, time: new Date().toISOString() }));
    } catch (error: any) {
      if (error.code !== 'EEXIST') throw error;
      try {
        const data = JSON.parse(fs.readFileSync(this.lockPath, 'utf8'));
        if (data.pid) {
          try {
            process.kill(data.pid, 0);
            const lockError: any = new Error(`JOB_LOCKED: Job directory is currently locked by PID ${data.pid}`);
            lockError.code = 'JOB_LOCKED';
            throw lockError;
          } catch (killError: any) {
            if (killError.code !== 'ESRCH') throw killError;
            fs.unlinkSync(this.lockPath);
            this.lockFd = fs.openSync(this.lockPath, 'wx');
            fs.writeSync(this.lockFd, JSON.stringify({ pid: process.pid, time: new Date().toISOString() }));
          }
        }
      } catch (readError: any) {
        if (readError.code === 'JOB_LOCKED') throw readError;
        const lockError: any = new Error('JOB_LOCKED: Run directory is currently locked');
        lockError.code = 'JOB_LOCKED';
        throw lockError;
      }
    }
  }

  private releaseRunLock(): void {
    if (this.lockFd !== null) {
      try { fs.closeSync(this.lockFd); } catch { /* ignore */ }
      this.lockFd = null;
    }
    if (this.lockPath && fs.existsSync(this.lockPath)) {
      try { fs.unlinkSync(this.lockPath); } catch { /* ignore */ }
    }
    this.lockPath = null;
  }

  private initializeStorage(): void {
    if (this.sqliteDriver) {
      if (!this.explicitRunId && this.sqliteDriver.getEventCount(this.eventContext.run_id) === 0) {
        const runIds = this.sqliteDriver.getRunIds();
        if (runIds.length === 1) {
          this.eventContext.run_id = runIds[0];
          this.eventContext.runId = runIds[0];
        }
      }
      const latest = this.sqliteDriver.getLatestSequence(this.eventContext.run_id);
      if (latest > 0) {
        this.seqCounter = latest;
        this.events = this.sqliteDriver.getRecentEvents(this.maxInMemoryEvents, this.eventContext.run_id);
        if (!this.readOnly) this.syncJsonlFromSqlite();
        return;
      }
      if (this.readOnly) return;
    }
    if (!this.storagePath || !fs.existsSync(this.storagePath)) return;
    const fileEvents = this.readAllJsonlEvents();
    if (this.sqliteDriver && fileEvents.length > 0) {
      const runIds = [...new Set(fileEvents.map(event => event.run_id).filter((value): value is string => Boolean(value)))];
      if (!this.explicitRunId && runIds.length === 1 && this.sqliteDriver.getEventCount(this.eventContext.run_id) === 0) {
        this.eventContext.run_id = runIds[0];
        this.eventContext.runId = runIds[0];
      }
      const normalized = fileEvents.map(event => event.run_id ? event : { ...event, run_id: this.eventContext.run_id, skill_id: event.skill_id || this.eventContext.skill_id });
      this.sqliteDriver.rebuildEvents(this.deduplicateById(normalized));
      this.seqCounter = this.sqliteDriver.getLatestSequence(this.eventContext.run_id);
      this.events = this.sqliteDriver.getRecentEvents(this.maxInMemoryEvents, this.eventContext.run_id);
      return;
    }
    this.events = fileEvents.slice(-this.maxInMemoryEvents);
    this.seqCounter = this.events.reduce((max, event) => Math.max(max, event.seq), 0);
  }

  private importLegacyRunStores(scopeDir: string, skillId: string): void {
    if (!this.sqliteDriver || this.readOnly) return;
    const legacyJobsDir = path.join(scopeDir, 'jobs');
    if (!fs.existsSync(legacyJobsDir)) return;
    const mappingPath = path.join(scopeDir, '.legacy-run-migrations.json');
    let mapping: Record<string, string> = {};
    if (fs.existsSync(mappingPath)) {
      try { mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8')); } catch { mapping = {}; }
    }
    let mappingChanged = false;
    for (const entry of fs.readdirSync(legacyJobsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const legacyId = entry.name;
      const legacyDir = path.join(legacyJobsDir, legacyId);
      const runId = mapping[legacyId] || createSortableId();
      if (!mapping[legacyId]) {
        mapping[legacyId] = runId;
        mappingChanged = true;
      }
      this.sqliteDriver.ensureRun(runId, { skillId });
      let events = this.readLegacyJsonl(path.join(legacyDir, 'events.jsonl'), runId, skillId);
      if (events.length === 0 && fs.existsSync(path.join(legacyDir, 'events.db'))) {
        events = this.readLegacyDb(path.join(legacyDir, 'events.db'), runId, skillId);
      }
      if (events.length > 0) this.sqliteDriver.importEvents(events);

      const targetDir = path.join(scopeDir, 'runs', runId);
      fs.mkdirSync(path.join(targetDir, 'artifacts'), { recursive: true });
      fs.mkdirSync(path.join(targetDir, 'logs'), { recursive: true });
      for (const lane of ['artifacts', 'logs']) {
        const sourceLane = path.join(legacyDir, lane);
        const targetLane = path.join(targetDir, lane);
        if (fs.existsSync(sourceLane)) {
          fs.cpSync(sourceLane, targetLane, { recursive: true, force: false, errorOnExist: false });
        }
      }
      const legacyMetadataPath = path.join(legacyDir, 'job.json');
      const targetMetadataPath = path.join(targetDir, 'job.json');
      if (!fs.existsSync(targetMetadataPath)) {
        let metadata: any = {
          id: runId,
          runId,
          name: legacyId,
          skillId,
          status: 'active',
          currentState: 'INIT',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (fs.existsSync(legacyMetadataPath)) {
          try { metadata = { ...metadata, ...JSON.parse(fs.readFileSync(legacyMetadataPath, 'utf8')), id: runId, runId }; } catch { /* use fallback */ }
        }
        fs.writeFileSync(targetMetadataPath, JSON.stringify(metadata, null, 2), 'utf8');
      }
    }
    if (mappingChanged) fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2), 'utf8');
    this.syncJsonlFromSqlite();
  }

  private readLegacyJsonl(filePath: string, runId: string, skillId: string): SignalEvent[] {
    if (!fs.existsSync(filePath)) return [];
    const events: SignalEvent[] = [];
    for (const line of fs.readFileSync(filePath, 'utf8').split('\n').filter(line => line.trim())) {
      try {
        const event = JSON.parse(line) as SignalEvent;
        events.push({ ...event, run_id: runId, skill_id: event.skill_id || skillId });
      } catch { /* skip malformed legacy lines */ }
    }
    return this.deduplicateById(events);
  }

  private readLegacyDb(filePath: string, runId: string, skillId: string): SignalEvent[] {
    let db: DatabaseSync | null = null;
    try {
      db = new DatabaseSync(filePath, { readOnly: true } as any);
      const rows = db.prepare('SELECT * FROM events ORDER BY seq ASC').all() as any[];
      return rows.map(row => ({
        id: row.id,
        seq: Number(row.seq),
        ledger_seq: row.ledger_seq ? Number(row.ledger_seq) : undefined,
        timestamp: row.timestamp,
        type: row.type,
        state: row.state || undefined,
        source: row.source || undefined,
        event_id: row.event_id || row.id,
        occurred_at: row.occurred_at || row.timestamp,
        event_type: row.event_type || row.type,
        causation_id: row.causation_id || undefined,
        correlation_id: row.correlation_id || undefined,
        request_id: row.request_id || undefined,
        trace_parent: row.trace_parent || undefined,
        skill_id: row.skill_id || skillId,
        run_id: runId,
        parent_run_id: row.parent_run_id || undefined,
        schema_version: row.schema_version || undefined,
        payload: JSON.parse(row.payload),
      }));
    } catch {
      return [];
    } finally {
      try { db?.close(); } catch { /* best effort */ }
    }
  }

  private readAllJsonlEvents(): SignalEvent[] {
    if (!this.storagePath) return [];
    const events: SignalEvent[] = [];
    for (const jsonlPath of this.getJsonlPaths()) {
      if (!fs.existsSync(jsonlPath)) continue;
      const lines = fs.readFileSync(jsonlPath, 'utf8').split('\n').filter(line => line.trim());
      for (const line of lines) {
        try { events.push(JSON.parse(line) as SignalEvent); } catch { /* skip incomplete or malformed line */ }
      }
    }
    return events;
  }

  private deduplicateById(events: SignalEvent[]): SignalEvent[] {
    const byId = new Map<string, SignalEvent>();
    for (const event of events) {
      const existing = byId.get(event.id);
      if (!existing || event.seq > existing.seq || (event.seq === existing.seq && (event.ledger_seq || 0) > (existing.ledger_seq || 0))) byId.set(event.id, event);
    }
    return [...byId.values()].sort((a, b) => (a.ledger_seq || a.seq) - (b.ledger_seq || b.seq));
  }

  private getJsonlPaths(): string[] {
    if (!this.storagePath) return [];
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) return [];
    const baseName = path.basename(this.storagePath).replace(/\.jsonl$/, '');
    const archived = fs.readdirSync(dir).filter(name => new RegExp(`^${baseName}-\\d{6}\\.jsonl$`).test(name)).sort().map(name => path.join(dir, name));
    return [...archived, ...(fs.existsSync(this.storagePath) ? [this.storagePath] : [])];
  }

  private rotateJsonlIfNeeded(nextLineBytes: number): void {
    if (!this.storagePath || !fs.existsSync(this.storagePath)) return;
    const currentBytes = fs.statSync(this.storagePath).size;
    if (currentBytes === 0 || currentBytes + nextLineBytes <= this.maxJsonlBytes) return;
    const dir = path.dirname(this.storagePath);
    const baseName = path.basename(this.storagePath).replace(/\.jsonl$/, '');
    let segment = 1;
    let archivePath = path.join(dir, `${baseName}-${String(segment).padStart(6, '0')}.jsonl`);
    while (fs.existsSync(archivePath)) {
      segment += 1;
      archivePath = path.join(dir, `${baseName}-${String(segment).padStart(6, '0')}.jsonl`);
    }
    fs.renameSync(this.storagePath, archivePath);
  }

  private withJsonlProjectionLock<T>(operation: () => T): T {
    if (!this.storagePath) return operation();
    const lockPath = `${this.storagePath}.lock`;
    let fd: number | null = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        fd = fs.openSync(lockPath, 'wx');
        fs.writeSync(fd, JSON.stringify({ pid: process.pid, time: new Date().toISOString() }));
        break;
      } catch (error: any) {
        if (error.code !== 'EEXIST') throw error;
        try {
          const owner = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
          process.kill(owner.pid, 0);
        } catch (ownerError: any) {
          if (ownerError.code === 'ESRCH' || ownerError.code === 'ENOENT' || ownerError instanceof SyntaxError) {
            try { fs.unlinkSync(lockPath); } catch { /* another repairer may have removed it */ }
            continue;
          }
        }
        pauseSync(10);
      }
    }
    if (fd === null) throw new Error('JSONL projection lock timeout');
    try {
      return operation();
    } finally {
      try { fs.closeSync(fd); } catch { /* best effort */ }
      try { fs.unlinkSync(lockPath); } catch { /* best effort */ }
    }
  }

  private rewriteJsonlFromSqlite(): number {
    if (!this.sqliteDriver || !this.storagePath) return 0;
    return this.withJsonlProjectionLock(() => {
      const allEvents = this.sqliteDriver!.queryEvents({ allRuns: true });
      const dir = path.dirname(this.storagePath!);
      fs.mkdirSync(dir, { recursive: true });
      const tempPath = `${this.storagePath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, allEvents.map(event => JSON.stringify(event)).join('\n') + (allEvents.length ? '\n' : ''), 'utf8');
      fs.renameSync(tempPath, this.storagePath!);
      for (const archived of this.getJsonlPaths()) {
        if (archived !== this.storagePath) {
          try { fs.unlinkSync(archived); } catch { /* best effort */ }
        }
      }
      return allEvents.length;
    });
  }

  /** Repair the JSONL projection from the canonical SQLite ledger. */
  public syncJsonlFromSqlite(): number {
    if (!this.sqliteDriver || !this.storagePath) return 0;
    try {
      return this.withJsonlProjectionLock(() => {
        const sqliteEvents = this.sqliteDriver!.queryEvents({ allRuns: true });
        const jsonlIds = new Set(this.readAllJsonlEvents().map(event => event.id));
        const missing = sqliteEvents.filter(event => !jsonlIds.has(event.id));
        if (missing.length === 0) return 0;
        fs.mkdirSync(path.dirname(this.storagePath!), { recursive: true });
        for (const event of missing) {
          const line = `${JSON.stringify(event)}\n`;
          this.rotateJsonlIfNeeded(Buffer.byteLength(line, 'utf8'));
          fs.appendFileSync(this.storagePath!, line, 'utf8');
        }
        return missing.length;
      });
    } catch (error) {
      console.warn('EventStore: JSONL projection repair deferred', error);
      return 0;
    }
  }

  /** Compatibility name retained for callers that repair the JSONL mirror. */
  public syncJsonlToSqlite(): number { return this.syncJsonlFromSqlite(); }

  /** Explicit legacy import path. SQLite remains canonical after this operation. */
  public rebuildFromJsonl(): number {
    if (!this.sqliteDriver) throw new Error('rebuildFromJsonl requires a SQLite driver to be enabled');
    if (!this.storagePath) throw new Error('rebuildFromJsonl requires a storagePath (JSONL audit log)');
    const normalized = this.readAllJsonlEvents().map(event => event.run_id ? event : { ...event, run_id: this.eventContext.run_id, skill_id: event.skill_id || this.eventContext.skill_id });
    const events = this.deduplicateById(normalized);
    this.sqliteDriver.rebuildEvents(events);
    this.events = this.sqliteDriver.getRecentEvents(this.maxInMemoryEvents, this.eventContext.run_id);
    this.seqCounter = this.sqliteDriver.getLatestSequence(this.eventContext.run_id);
    return events.length;
  }

  public append<T = Record<string, any>>(
    type: string,
    payload: T,
    metadata: {
      source?: string;
      causationId?: string;
      correlationId?: string;
      requestId?: string;
      idempotencyKey?: string;
      traceParent?: string;
      parentRunId?: string;
      skillId?: string;
      runId?: string;
      state?: string;
    } = {},
  ): SignalEvent<T> {
    const event: SignalEvent<T> = {
      id: createSortableId(), seq: 0, timestamp: new Date().toISOString(), type, payload,
      source: metadata.source, causationId: metadata.causationId, state: metadata.state,
      event_id: '', occurred_at: new Date().toISOString(), event_type: type,
      causation_id: metadata.causationId,
      correlation_id: metadata.correlationId || this.eventContext.correlation_id,
      request_id: metadata.requestId || this.eventContext.request_id,
      idempotency_key: metadata.idempotencyKey,
      trace_parent: metadata.traceParent || this.eventContext.trace_parent,
      skill_id: metadata.skillId || this.eventContext.skill_id,
      run_id: metadata.runId || this.eventContext.run_id,
      parent_run_id: metadata.parentRunId || this.eventContext.parent_run_id,
      schema_version: this.eventContext.schema_version,
    };
    event.event_id = event.id;

    let persisted = event as SignalEvent<T>;
    if (this.sqliteDriver) {
      try { persisted = this.sqliteDriver.appendEvent(event as SignalEvent) as SignalEvent<T>; }
      catch (error) { throw new Error('Event persistence failed: SQLite write did not complete.', { cause: error as Error }); }
      this.seqCounter = persisted.seq;
      if (persisted.id !== event.id) {
        this.syncJsonlFromSqlite();
        return persisted as SignalEvent<T>;
      }
      this.syncJsonlFromSqlite();
    } else {
      this.seqCounter += 1;
      persisted.seq = this.seqCounter;
      if (this.storagePath) {
        try {
          const line = `${JSON.stringify(persisted)}\n`;
          fs.mkdirSync(path.dirname(this.storagePath), { recursive: true });
          this.rotateJsonlIfNeeded(Buffer.byteLength(line, 'utf8'));
          fs.appendFileSync(this.storagePath, line, 'utf8');
        } catch (error) { throw new Error('Event persistence failed: JSONL write did not complete.', { cause: error as Error }); }
      }
    }
    this.events.push(persisted as SignalEvent);
    if (this.events.length > this.maxInMemoryEvents) this.events.shift();
    for (const listener of this.listeners) {
      try { listener(persisted as SignalEvent); } catch (error) { console.error('Error in event store listener:', error); }
    }
    return persisted as SignalEvent<T>;
  }

  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getAll(): SignalEvent[] { return this.sqliteDriver ? this.sqliteDriver.queryEvents({ runId: this.eventContext.run_id }) : [...this.events]; }
  public getSince(seq: number): SignalEvent[] { return this.sqliteDriver ? this.sqliteDriver.queryEvents({ sinceSeq: seq, runId: this.eventContext.run_id }) : this.events.filter(event => event.seq > seq); }
  public getLatestSequence(): number { return this.sqliteDriver ? this.sqliteDriver.getLatestSequence(this.eventContext.run_id) : (this.events.at(-1)?.seq || 0); }
  public getEventCount(): number { return this.sqliteDriver ? this.sqliteDriver.getEventCount(this.eventContext.run_id) : this.events.length; }
  public getLatestEvent(): SignalEvent | null { return this.sqliteDriver ? this.sqliteDriver.getLatestEvent(this.eventContext.run_id) : (this.events.at(-1) || null); }
  public getEventContext(): EventContext { return { ...this.eventContext }; }
  public getRunVersion(): number { return this.sqliteDriver?.getRunVersion(this.eventContext.run_id || 'default') || this.getLatestSequence(); }
  public assertRunVersion(version: number): void { this.sqliteDriver?.assertRunVersion(this.eventContext.run_id || 'default', version); }
  public getEventByIdempotencyKey(key: string): SignalEvent | null { return this.sqliteDriver?.getEventByIdempotencyKey(key, this.eventContext.run_id) || null; }

  public saveProjectionWatermark(name: string, eventSeq: number, projectionVersion: string): void {
    const watermark = { eventSeq, projectionVersion };
    this.projectionWatermarks.set(name, watermark);
    this.sqliteDriver?.saveProjectionWatermark(name, eventSeq, projectionVersion, this.eventContext.run_id);
  }

  public getProjectionWatermark(name: string): { eventSeq: number; projectionVersion: string } | null {
    return this.sqliteDriver?.getProjectionWatermark(name, this.eventContext.run_id) || this.projectionWatermarks.get(name) || null;
  }

  public saveSnapshot(seq: number, state: string, context: Record<string, any>): void {
    this.latestSnapshot = { seq, state, context: { ...context } };
    this.sqliteDriver?.saveSnapshot(seq, state, context, this.eventContext.run_id);
  }

  public getLatestSnapshot(): { seq: number; state: string; context: Record<string, any> } | null {
    return this.sqliteDriver?.getLatestSnapshot(this.eventContext.run_id) || (this.latestSnapshot ? { ...this.latestSnapshot, context: { ...this.latestSnapshot.context } } : null);
  }

  public query(filter: EventQueryOptions = {}): SignalEvent[] {
    if (this.sqliteDriver) return this.sqliteDriver.queryEvents({ ...filter, runId: filter.runId || this.eventContext.run_id });
    const filtered = this.events.filter(event => {
      if (filter.type && event.type !== filter.type) return false;
      if (filter.state && event.state !== filter.state) return false;
      if (filter.sinceSeq !== undefined && event.seq <= filter.sinceSeq) return false;
      if (filter.runId && event.run_id !== filter.runId) return false;
      return true;
    });
    return filter.limit ? filtered.slice(0, filter.limit) : filtered;
  }

  public close(): void { this.releaseRunLock(); this.sqliteDriver?.close(); }
  public getSqliteDriver(): SQLiteStorageDriver | null { return this.sqliteDriver; }

  public clear(): void {
    this.events = [];
    this.seqCounter = 0;
    this.projectionWatermarks.clear();
    this.latestSnapshot = null;
    if (this.sqliteDriver) {
      this.sqliteDriver.clear();
      this.rewriteJsonlFromSqlite();
    } else if (this.storagePath) {
      for (const jsonlPath of this.getJsonlPaths()) {
        try { fs.unlinkSync(jsonlPath); } catch { /* best effort */ }
      }
    }
  }
}

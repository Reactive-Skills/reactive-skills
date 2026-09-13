import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { EventContext, SignalEvent } from './types.js';

export const EVENT_STORE_SCHEMA_VERSION = 2;

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
}

export interface EventQueryOptions {
  type?: string;
  state?: string;
  sinceSeq?: number;
  limit?: number;
}

/**
 * SQLite Storage Driver for EventStore
 * Provides ACID relational storage, indexing, and direct SQL querying
 */
export class SQLiteStorageDriver {
  private db: DatabaseSync;
  private isClosed = false;

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA busy_timeout = 5000');
    this.db.exec('PRAGMA journal_mode = WAL');
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        event_id TEXT,
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
        trace_parent TEXT,
        skill_id TEXT,
        run_id TEXT,
        parent_run_id TEXT,
        schema_version TEXT,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_seq ON events(seq);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_events_state ON events(state);

      CREATE TABLE IF NOT EXISTS projections (
        name TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS state_snapshots (
        seq INTEGER PRIMARY KEY,
        state TEXT NOT NULL,
        context TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projection_watermarks (
        name TEXT PRIMARY KEY,
        event_seq INTEGER NOT NULL,
        projection_version TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS seq_counter (
        id INTEGER PRIMARY KEY,
        last_seq INTEGER NOT NULL
      );
      INSERT OR IGNORE INTO seq_counter (id, last_seq) VALUES (1, 0);
      INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (2, datetime('now'));
    `);

    this.ensureSchemaVersion();
  }

  private ensureSchemaVersion(): void {
    const stmt = this.db.prepare('SELECT MAX(version) as v FROM schema_version');
    const row = stmt.get() as { v: number | null };
    const currentVersion = row?.v ?? 0;
    if (currentVersion < EVENT_STORE_SCHEMA_VERSION) {
      this.runMigrations(currentVersion);
    }
  }

  private runMigrations(fromVersion: number): void {
    if (fromVersion < 2) {
      const envelopeColumns: Record<string, string> = {
        event_id: 'TEXT',
        occurred_at: 'TEXT',
        event_type: 'TEXT',
        correlation_id: 'TEXT',
        request_id: 'TEXT',
        trace_parent: 'TEXT',
        skill_id: 'TEXT',
        run_id: 'TEXT',
        parent_run_id: 'TEXT',
        schema_version: 'TEXT',
      };
      for (const [column, type] of Object.entries(envelopeColumns)) {
        try {
          this.db.exec(`ALTER TABLE events ADD COLUMN ${column} ${type}`);
        } catch {
          // Column already exists, skip
        }
      }
      this.db.exec(`INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (2, datetime('now'))`);
      console.warn('EventStore: Migrated schema from v' + fromVersion + ' to v2 (added event envelope fields)');
    }
  }

  public insertEvent(event: SignalEvent): void {
    const stmt = this.db.prepare(`
      INSERT INTO events (id, event_id, seq, timestamp, occurred_at, type, event_type, state, source, causation_id, correlation_id, request_id, trace_parent, skill_id, run_id, parent_run_id, schema_version, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      event.id,
      event.event_id || event.id,
      event.seq,
      event.timestamp,
      event.occurred_at || event.timestamp,
      event.type,
      event.event_type || event.type,
      event.state || null,
      event.source || null,
      event.causation_id || event.causationId || null,
      event.correlation_id || null,
      event.request_id || null,
      event.trace_parent || null,
      event.skill_id || null,
      event.run_id || null,
      event.parent_run_id || null,
      event.schema_version || null,
      JSON.stringify(event.payload)
    );
  }

  public beginTransaction(): void {
    this.db.exec('BEGIN IMMEDIATE');
  }

  public commitTransaction(): void {
    this.db.exec('COMMIT');
  }

  public queryEvents(options: EventQueryOptions = {}): SignalEvent[] {
    let sql = 'SELECT * FROM events WHERE 1=1';
    const params: any[] = [];

    if (options.type) {
      sql += ' AND type = ?';
      params.push(options.type);
    }
    if (options.state) {
      sql += ' AND state = ?';
      params.push(options.state);
    }
    if (options.sinceSeq !== undefined) {
      sql += ' AND seq > ?';
      params.push(options.sinceSeq);
    }
    sql += ' ORDER BY seq ASC';
    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => this.rowToEvent(row));
  }

  public getLatestSequence(): number {
    const stmt = this.db.prepare('SELECT seq FROM events ORDER BY seq DESC LIMIT 1');
    const row = stmt.get() as { seq: number } | undefined;
    return row ? Number(row.seq) : 0;
  }

  public nextSequence(): number {
    const stmt = this.db.prepare('UPDATE seq_counter SET last_seq = last_seq + 1 WHERE id = 1');
    stmt.run();
    const selectStmt = this.db.prepare('SELECT last_seq FROM seq_counter WHERE id = 1');
    const row = selectStmt.get() as { last_seq: number };
    return Number(row.last_seq);
  }


  public getRecentEvents(limit: number): SignalEvent[] {
    const boundedLimit = Math.max(1, Math.floor(limit));
    const stmt = this.db.prepare('SELECT * FROM events ORDER BY seq DESC LIMIT ?');
    const rows = stmt.all(boundedLimit) as any[];
    return rows.reverse().map(row => this.rowToEvent(row));
  }

  public querySql(sql: string, params: any[] = []): any[] {
    const normalizedSql = sql.replace(/--.*(?:\r?\n|$)/g, '').trim();
    const statements = normalizedSql.split(';').map(statement => statement.trim()).filter(Boolean);
    if (statements.length !== 1 || !/^(SELECT|EXPLAIN)\b/i.test(statements[0])) {
      throw new Error('Only single-statement SELECT or EXPLAIN queries are allowed.');
    }
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  public saveSnapshot(seq: number, state: string, context: Record<string, any>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO state_snapshots (seq, state, context, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(seq, state, JSON.stringify(context), new Date().toISOString());
  }

  public getLatestSnapshot(): { seq: number; state: string; context: Record<string, any> } | null {
    const stmt = this.db.prepare(`
      SELECT * FROM state_snapshots ORDER BY seq DESC LIMIT 1
    `);
    const row = stmt.get() as any;
    if (!row) return null;
    return {
      seq: Number(row.seq),
      state: row.state,
      context: JSON.parse(row.context),
    };
  }

  public saveProjectionWatermark(name: string, eventSeq: number, projectionVersion: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO projection_watermarks (name, event_seq, projection_version, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(name, eventSeq, projectionVersion, new Date().toISOString());
  }

  public getProjectionWatermark(name: string): { eventSeq: number; projectionVersion: string } | null {
    const stmt = this.db.prepare('SELECT event_seq, projection_version FROM projection_watermarks WHERE name = ?');
    const row = stmt.get(name) as any;
    return row
      ? { eventSeq: Number(row.event_seq), projectionVersion: row.projection_version }
      : null;
  }

  public saveProjection(name: string, content: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO projections (name, content, updated_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(name, content, new Date().toISOString());
  }

  public getProjection(name: string): string | null {
    const stmt = this.db.prepare(`
      SELECT content FROM projections WHERE name = ?
    `);
    const row = stmt.get(name) as any;
    return row ? row.content : null;
  }

  public close(): void {
    if (this.isClosed) return;
    try {
      this.db.close();
    } catch {
      // already closed
    } finally {
      this.isClosed = true;
    }
  }

  public static getSchemaVersion(dbPath: string): number {
    const db = new DatabaseSync(dbPath);
    const stmt = db.prepare('SELECT MAX(version) as v FROM schema_version');
    const row = stmt.get() as { v: number | null };
    db.close();
    return row?.v ?? 0;
  }

  private rowToEvent(row: any): SignalEvent {
    return {
      id: row.id,
      seq: Number(row.seq),
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
      trace_parent: row.trace_parent || undefined,
      skill_id: row.skill_id || undefined,
      run_id: row.run_id || undefined,
      parent_run_id: row.parent_run_id || undefined,
      schema_version: row.schema_version || undefined,
      payload: JSON.parse(row.payload),
    };
  }

public clear(): void {
    this.db.exec(`
      DELETE FROM events;
      DELETE FROM projections;
      DELETE FROM state_snapshots;
      DELETE FROM projection_watermarks;
    `);
  }

  /**
   * Purge every table including seq_counter so a rebuilt store starts from a
   * clean slate. Used by EventStore.rebuildFromJsonl().
   */
  public clearAll(): void {
    this.db.exec(`
      DELETE FROM events;
      DELETE FROM projections;
      DELETE FROM state_snapshots;
      DELETE FROM projection_watermarks;
      DELETE FROM seq_counter;
    `);
    this.db.exec(`INSERT OR IGNORE INTO seq_counter (id, last_seq) VALUES (1, 0)`);
  }

  /**
   * Replace the entire events table with the supplied ordered list.
   * Preserves caller-supplied seq numbers (JSONL heritage). seq_counter is
   * reset to the max seq so future appends continue from the correct point.
   */
  public rebuildEvents(orderedEvents: SignalEvent[]): void {
    this.clearAll();
    if (orderedEvents.length === 0) return;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      let maxSeq = 0;
      for (const event of orderedEvents) {
        this.insertEvent(event);
        if (event.seq > maxSeq) maxSeq = event.seq;
      }
      const updateStmt = this.db.prepare('UPDATE seq_counter SET last_seq = ? WHERE id = 1');
      updateStmt.run(maxSeq);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }
}


/**
 * Immutable Append-Only Event Store
 * All signals, tool results, guard evaluations, and state transitions are recorded here.
 */
export class EventStore {
  private events: SignalEvent[] = [];
  private listeners: Set<EventListener> = new Set();
  private storagePath: string | null = null;
  private sqliteDriver: SQLiteStorageDriver | null = null;
  private sqlitePath: string | null = null;
  private seqCounter = 0;
  private maxInMemoryEvents: number;
  private eventContext: EventContext;
  private projectionWatermarks = new Map<string, { eventSeq: number; projectionVersion: string }>();
  private latestSnapshot: { seq: number; state: string; context: Record<string, any> } | null = null;
  private maxJsonlBytes: number;
  private lockFd: number | null = null;
  private lockPath: string | null = null;

  constructor(options: EventStoreOptions = {}) {
    this.maxInMemoryEvents = options.maxInMemoryEvents || 1000;
    this.maxJsonlBytes = options.maxJsonlBytes || 10 * 1024 * 1024;
    const effectiveJobId = options.jobId || options.runId || options.run_id;
    this.eventContext = {
      skill_id: options.skillId,
      run_id: effectiveJobId || createSortableId(),
      correlation_id: options.correlationId || createSortableId(),
      request_id: options.requestId,
      trace_parent: options.traceParent,
      parent_run_id: options.parentRunId,
      schema_version: options.schemaVersion || '1.0.3',
    };

    if (!options.inMemory) {
      const workspaceDir = options.workspaceDir || process.cwd();
      const scopeDir = options.skillId
        ? path.join(workspaceDir, '.reactive', 'skills', options.skillId)
        : path.join(workspaceDir, '.reactive');

      let runScopedDir = scopeDir;
      if (options.skillId && effectiveJobId) {
        const isLegacyFallback = effectiveJobId === 'default' &&
          !fs.existsSync(path.join(scopeDir, 'jobs', effectiveJobId)) &&
          fs.existsSync(path.join(scopeDir, 'events.jsonl'));

        if (!isLegacyFallback) {
          runScopedDir = path.join(scopeDir, 'jobs', effectiveJobId);
        }
      } else if (effectiveJobId) {
        runScopedDir = path.join(scopeDir, effectiveJobId);
      }

      if (options.acquireLock && runScopedDir) {
        this.acquireJobLock(runScopedDir);
      }

      this.storagePath = options.storagePath || path.join(runScopedDir, 'events.jsonl');
      
      if (options.enableSqlite || options.sqlitePath) {
        const dbPath = options.sqlitePath || path.join(runScopedDir, 'events.db');
        this.sqlitePath = dbPath;
        this.sqliteDriver = new SQLiteStorageDriver(dbPath);
      }

      this.initializeStorage();
    } else if (options.enableSqlite) {
      this.sqliteDriver = new SQLiteStorageDriver(':memory:');
    }
  }

  private acquireJobLock(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.lockPath = path.join(dir, '.lock');
    try {
      this.lockFd = fs.openSync(this.lockPath, 'wx');
      fs.writeSync(this.lockFd, JSON.stringify({ pid: process.pid, time: new Date().toISOString() }));
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        try {
          const content = fs.readFileSync(this.lockPath, 'utf8');
          const data = JSON.parse(content);
          if (data.pid) {
            try {
              process.kill(data.pid, 0);
              const lockError: any = new Error(`JOB_LOCKED: Job directory is currently locked by PID ${data.pid}`);
              lockError.code = 'JOB_LOCKED';
              throw lockError;
            } catch (killErr: any) {
              if (killErr.code === 'ESRCH') {
                fs.unlinkSync(this.lockPath);
                this.lockFd = fs.openSync(this.lockPath, 'wx');
                fs.writeSync(this.lockFd, JSON.stringify({ pid: process.pid, time: new Date().toISOString() }));
                return;
              }
              throw killErr;
            }
          }
        } catch (readErr: any) {
          if (readErr.code === 'JOB_LOCKED') throw readErr;
        }
        const lockError: any = new Error(`JOB_LOCKED: Job directory is currently locked`);
        lockError.code = 'JOB_LOCKED';
        throw lockError;
      }
      throw err;
    }
  }

  private releaseJobLock(): void {
    if (this.lockFd !== null) {
      try {
        fs.closeSync(this.lockFd);
      } catch {
        // ignore
      }
      this.lockFd = null;
    }
    if (this.lockPath && fs.existsSync(this.lockPath)) {
      try {
        fs.unlinkSync(this.lockPath);
      } catch {
        // ignore
      }
      this.lockPath = null;
    }
  }

private initializeStorage(): void {
    // SQLite is authoritative. If it already has events, load the recent
    // sliding window and check JSONL for divergence before returning.
    if (this.sqliteDriver) {
      const sqliteLatestSeq = this.sqliteDriver.getLatestSequence();
      if (sqliteLatestSeq > 0) {
        this.seqCounter = sqliteLatestSeq;
        this.events = this.sqliteDriver.getRecentEvents(this.maxInMemoryEvents);

        // Divergence detection: JSONL may have events SQLite never saw (e.g.
        // a prior run with SQLite disabled, or a failed SQLite write). If so,
        // rebuild SQLite from JSONL so the authoritative store matches the
        // audit log. Only run when JSONL and SQLite share a directory so an
        // explicit sqlitePath in a different location isn't clobbered by a
        // stray JSONL in the working directory.
        if (this.storagePath && this.sqlitePath && path.dirname(this.storagePath) === path.dirname(this.sqlitePath)) {
          const jsonlStats = this.readJsonlStats();
          if (jsonlStats.count > 0 && jsonlStats.maxSeq > sqliteLatestSeq) {
            console.warn(
              'EventStore: JSONL has events beyond SQLite (jsonl max seq=' +
                jsonlStats.maxSeq +
                ', sqlite max seq=' +
                sqliteLatestSeq +
                '). Rebuilding SQLite from JSONL.'
            );
            this.rebuildFromJsonl();
            this.seqCounter = this.sqliteDriver.getLatestSequence();
            this.events = this.sqliteDriver.getRecentEvents(this.maxInMemoryEvents);
          } else if (jsonlStats.count > 0 && jsonlStats.maxSeq < sqliteLatestSeq) {
            // SQLite is authoritative; JSONL is a stale mirror. Optionally
            // backfill the audit log so it stays complete.
            this.syncJsonlToSqlite();
          }
        }
        return;
      }
    }

    if (!this.storagePath) return;
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const jsonlPaths = this.getJsonlPaths();
    if (jsonlPaths.length > 0) {
      const fileEvents: SignalEvent[] = [];
      for (const jsonlPath of jsonlPaths) {
        const content = fs.readFileSync(jsonlPath, 'utf8');
        const lines = content.split('\n').filter(l => l.trim().length > 0);
        for (const line of lines) {
          try {
            const event = JSON.parse(line) as SignalEvent;
            fileEvents.push(event);
            if (event.seq > this.seqCounter) {
              this.seqCounter = event.seq;
            }
          } catch {
            // skip malformed lines
          }
        }
      }
      this.events = fileEvents.slice(-this.maxInMemoryEvents);

      // No SQLite yet but JSONL exists: seed SQLite from the audit log so the
      // authoritative store is initialised from the same source of truth.
      // Only when JSONL and SQLite share a directory (paired stores).
      if (this.sqliteDriver && this.events.length > 0 && this.sqlitePath &&
          path.dirname(this.storagePath) === path.dirname(this.sqlitePath)) {
        this.rebuildFromJsonl();
        this.seqCounter = this.sqliteDriver.getLatestSequence();
        this.events = this.sqliteDriver.getRecentEvents(this.maxInMemoryEvents);
      }
    }
  }

  /**
   * Scan all JSONL files for the authoritative max seq and event count.
   * Returns { count: 0, maxSeq: 0 } when no JSONL is present.
   */
  private readJsonlStats(): { count: number; maxSeq: number } {
    if (!this.storagePath) return { count: 0, maxSeq: 0 };
    const paths = this.getJsonlPaths();
    let count = 0;
    let maxSeq = 0;
    for (const jsonlPath of paths) {
      if (!fs.existsSync(jsonlPath)) continue;
      const content = fs.readFileSync(jsonlPath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim().length > 0);
      for (const line of lines) {
        try {
          const event = JSON.parse(line) as SignalEvent;
          count += 1;
          if (event.seq > maxSeq) maxSeq = event.seq;
        } catch {
          // skip malformed lines
        }
      }
    }
    return { count, maxSeq };
  }

  /**
   * Rebuild SQLite from JSONL. Reads every JSONL file, deduplicates by event
   * id (keeping the highest seq on conflict), clears SQLite, and re-inserts
   * in seq order preserving original seq numbers. seq_counter is reset to the
   * max seq. In-memory state is left untouched; callers must refresh it.
   */
  public rebuildFromJsonl(): number {
    if (!this.sqliteDriver) {
      throw new Error('rebuildFromJsonl requires a SQLite driver to be enabled');
    }
    if (!this.storagePath) {
      throw new Error('rebuildFromJsonl requires a storagePath (JSONL audit log)');
    }

    const events = this.readAllJsonlEvents();
    const deduped = this.deduplicateById(events);
    deduped.sort((a, b) => a.seq - b.seq);

    this.sqliteDriver.rebuildEvents(deduped);
    return deduped.length;
  }

  /**
   * Read every event from every JSONL file (active + archived segments).
   */
  private readAllJsonlEvents(): SignalEvent[] {
    if (!this.storagePath) return [];
    const paths = this.getJsonlPaths();
    const events: SignalEvent[] = [];
    for (const jsonlPath of paths) {
      if (!fs.existsSync(jsonlPath)) continue;
      const content = fs.readFileSync(jsonlPath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim().length > 0);
      for (const line of lines) {
        try {
          events.push(JSON.parse(line) as SignalEvent);
        } catch {
          // skip malformed lines
        }
      }
    }
    return events;
  }

  /**
   * Deduplicate events by id, keeping the entry with the highest seq.
   */
  private deduplicateById(events: SignalEvent[]): SignalEvent[] {
    const byId = new Map<string, SignalEvent>();
    for (const event of events) {
      const existing = byId.get(event.id);
      if (!existing || event.seq > existing.seq) {
        byId.set(event.id, event);
      }
    }
    return Array.from(byId.values());
  }

  /**
   * Backfill JSONL with events SQLite has that JSONL is missing. SQLite is
   * authoritative; this keeps the audit log complete when a JSONL write
   * failed mid-write. Best-effort: failures are logged, not thrown.
   */
  public syncJsonlToSqlite(): number {
    if (!this.sqliteDriver || !this.storagePath) return 0;

    const sqliteEvents = this.sqliteDriver.queryEvents();
    const sqliteIds = new Set(sqliteEvents.map(event => event.id));
    const jsonlEvents = this.readAllJsonlEvents();
    const jsonlIds = new Set(jsonlEvents.map(event => event.id));

    const missing = sqliteEvents.filter(event => !jsonlIds.has(event.id));
    if (missing.length === 0) return 0;

    try {
      const line = missing.map(event => JSON.stringify(event)).join('\n') + '\n';
      fs.appendFileSync(this.storagePath, line, 'utf8');
      return missing.length;
    } catch (err) {
      console.warn('EventStore: failed to backfill JSONL from SQLite', err);
      return 0;
    }
  }

  private getJsonlPaths(): string[] {
    if (!this.storagePath) return [];
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) return [];
    const activeName = path.basename(this.storagePath);
    const baseName = activeName.replace(/\.jsonl$/, '');
    const archived = fs.readdirSync(dir)
      .filter(name => new RegExp(`^${baseName}-\\d{6}\\.jsonl$`).test(name))
      .sort()
      .map(name => path.join(dir, name));
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

/**
   * Append a new event to the immutable log.
   *
   * SQLite is the authoritative store when enabled; JSONL is an append-only
   * audit mirror that can optionally be checked into git. If JSONL mirroring
   * fails the run stays live because SQLite already persisted the event.
   */
  public append<T = Record<string, any>>(
    type: string,
    payload: T,
    metadata: {
      source?: string;
      causationId?: string;
      correlationId?: string;
      requestId?: string;
      traceParent?: string;
      parentRunId?: string;
      skillId?: string;
      runId?: string;
      state?: string;
    } = {}
  ): SignalEvent<T> {
    this.seqCounter = this.sqliteDriver ? this.sqliteDriver.nextSequence() : this.seqCounter + 1;
    const event: SignalEvent<T> = {
      id: createSortableId(),
      seq: this.seqCounter,
      timestamp: new Date().toISOString(),
      type,
      payload,
      source: metadata.source,
      causationId: metadata.causationId,
      state: metadata.state,
      event_id: '',
      occurred_at: new Date().toISOString(),
      event_type: type,
      causation_id: metadata.causationId,
      correlation_id: metadata.correlationId || this.eventContext.correlation_id,
      request_id: metadata.requestId || this.eventContext.request_id,
      trace_parent: metadata.traceParent || this.eventContext.trace_parent,
      skill_id: metadata.skillId || this.eventContext.skill_id,
      run_id: metadata.runId || this.eventContext.run_id,
      parent_run_id: metadata.parentRunId || this.eventContext.parent_run_id,
      schema_version: this.eventContext.schema_version,
    };
    event.event_id = event.id;

    // 1. Authoritative SQLite persistence
    if (this.sqliteDriver) {
      try {
        this.sqliteDriver.insertEvent(event as SignalEvent);
      } catch (err) {
        console.error('Error writing event to SQLite driver:', err);
        throw new Error('Event persistence failed: SQLite write did not complete.', { cause: err as Error });
      }
    }

    // 2. Append to JSONL stream
    if (this.storagePath) {
      try {
        const line = JSON.stringify(event) + '\n';
        this.rotateJsonlIfNeeded(Buffer.byteLength(line, 'utf8'));
        fs.appendFileSync(this.storagePath, line, 'utf8');
      } catch (err) {
        if (this.sqliteDriver) {
          // SQLite is authoritative when enabled; keep execution live if optional JSONL mirroring fails.
          console.warn('Warning writing event to JSONL log; SQLite persistence remains authoritative.', err);
        } else {
          console.error('Error writing event to JSONL log:', err);
          throw new Error('Event persistence failed: JSONL write did not complete.', { cause: err as Error });
        }
      }
    }

    // 3. Update bounded in-memory ring-buffer
    this.events.push(event as SignalEvent);
    if (this.events.length > this.maxInMemoryEvents) {
      this.events.shift(); // Evict oldest from RAM; preserved forever in SQLite/JSONL
    }

    // 4. Notify live listeners
    for (const listener of this.listeners) {
      try {
        listener(event as SignalEvent);
      } catch (err) {
        console.error('Error in event store listener:', err);
      }
    }

    return event;
  }

  /**
   * Subscribe to new events
   */
  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get all recorded events (delegates to SQLite if available, otherwise in-memory buffer)
   */
  public getAll(): SignalEvent[] {
    if (this.sqliteDriver) {
      return this.sqliteDriver.queryEvents();
    }
    return [...this.events];
  }

  public getSince(seq: number): SignalEvent[] {
    if (this.sqliteDriver) {
      return this.sqliteDriver.queryEvents({ sinceSeq: seq });
    }
    return this.events.filter(event => event.seq > seq);
  }

  public getLatestSequence(): number {
    if (this.sqliteDriver) {
      const latest = this.sqliteDriver.querySql('SELECT seq FROM events ORDER BY seq DESC LIMIT 1') as Array<{ seq: number }>;
      return latest.length > 0 ? Number(latest[0].seq) : 0;
    }
    return this.events.length > 0 ? this.events[this.events.length - 1].seq : 0;
  }

  public getEventContext(): EventContext {
    return { ...this.eventContext };
  }

  public saveProjectionWatermark(name: string, eventSeq: number, projectionVersion: string): void {
    const watermark = { eventSeq, projectionVersion };
    this.projectionWatermarks.set(name, watermark);
    this.sqliteDriver?.saveProjectionWatermark(name, eventSeq, projectionVersion);
  }

  public getProjectionWatermark(name: string): { eventSeq: number; projectionVersion: string } | null {
    if (this.sqliteDriver) {
      return this.sqliteDriver.getProjectionWatermark(name);
    }
    return this.projectionWatermarks.get(name) || null;
  }

  public saveSnapshot(seq: number, state: string, context: Record<string, any>): void {
    this.latestSnapshot = { seq, state, context: { ...context } };
    if (this.sqliteDriver) {
      this.sqliteDriver.saveSnapshot(seq, state, context);
    }
  }

  public getLatestSnapshot(): { seq: number; state: string; context: Record<string, any> } | null {
    if (this.sqliteDriver) {
      return this.sqliteDriver.getLatestSnapshot();
    }
    return this.latestSnapshot ? { ...this.latestSnapshot, context: { ...this.latestSnapshot.context } } : null;
  }

  /**
   * Query recorded events (relational index in SQLite, or in-memory filter)
   */
  public query(filter: EventQueryOptions = {}): SignalEvent[] {
    if (this.sqliteDriver) {
      return this.sqliteDriver.queryEvents(filter);
    }
    const filtered = this.events.filter(e => {
      if (filter.type && e.type !== filter.type) return false;
      if (filter.state && e.state !== filter.state) return false;
      if (filter.sinceSeq !== undefined && e.seq <= filter.sinceSeq) return false;
      return true;
    });
    return filter.limit ? filtered.slice(0, filter.limit) : filtered;
  }

  /**
   * Close storage drivers and release file handles and locks
   */
  public close(): void {
    this.releaseJobLock();
    if (this.sqliteDriver) {
      this.sqliteDriver.close();
    }
  }

  /**
   * Get SQLite driver instance if enabled
   */
  public getSqliteDriver(): SQLiteStorageDriver | null {
    return this.sqliteDriver;
  }

  /**
   * Clear in-memory and file events (for test isolation)
   */
  public clear(): void {
    this.events = [];
    this.seqCounter = 0;
    this.projectionWatermarks.clear();
    this.latestSnapshot = null;
    this.releaseJobLock();
    if (this.sqliteDriver) {
      this.sqliteDriver.clear();
    }
    if (this.storagePath && fs.existsSync(this.storagePath)) {
      fs.unlinkSync(this.storagePath);
    }
    for (const jsonlPath of this.getJsonlPaths()) {
      if (jsonlPath !== this.storagePath && fs.existsSync(jsonlPath)) fs.unlinkSync(jsonlPath);
    }
  }
}


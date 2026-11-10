import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { URL } from 'node:url';
import yaml from 'js-yaml';
import { EventStore } from '../core/event-store.js';
import { JobManager } from '../core/job-manager.js';
import { JobMetadata, SignalEvent } from '../core/types.js';
import {
  TelemetryBrokerEventEnvelope,
  TelemetryBrokerOptions,
  TelemetryBrokerStateResponse,
  TelemetryCatalogJob,
  TelemetryCatalogResponse,
  TelemetryCatalogSkill,
} from './types.js';
import {
  DEFAULT_TELEMETRY_PORT,
  listenWithPortSelection,
} from './port-selection.js';

interface BrokerTarget {
  key: string;
  skillId: string;
  skillName: string;
  jobId: string;
  job: JobMetadata;
  workspaceDir: string;
  jobManager: JobManager;
  eventStore: EventStore | null;
  tailCursor: number;
}

interface BrokerClient {
  response: http.ServerResponse;
  targetKeys: Set<string> | null;
  lastSeqByTarget: Map<string, number>;
  heartbeatTimer: ReturnType<typeof setInterval>;
}

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;
const DEFAULT_TAIL_INTERVAL_MS = 250;
const DEFAULT_CATALOG_REFRESH_INTERVAL_MS = 1_000;
// Keeps the synchronous catalog refresh under roughly one seventh of the event loop.
const REFRESH_BACKOFF_FACTOR = 6;

/**
 * Read-only local telemetry broker for multiple skill and job event stores.
 */
export class TelemetryBroker {
  private server: http.Server | null = null;
  private readonly primaryDir: string;
  private readonly extraDirs: string[] | (() => string[]);
  private jobManagers: JobManager[];
  private rootsResolvedAt = 0;
  private readonly requestedPort?: number;
  private readonly preferredPort?: number;
  private readonly host: string;
  private readonly heartbeatIntervalMs: number;
  private readonly tailIntervalMs: number;
  private readonly catalogRefreshIntervalMs: number;
  private readonly targets = new Map<string, BrokerTarget>();
  private readonly activeClients = new Set<BrokerClient>();
  private readonly activeSockets = new Set<any>();
  private tailerTimer?: ReturnType<typeof setInterval>;
  private catalogTimer?: ReturnType<typeof setInterval>;
  private refreshInProgress = false;
  private nextRefreshAt = 0;
  private startTime = Date.now();

  constructor(options: TelemetryBrokerOptions = {}) {
    this.primaryDir = path.resolve(options.workspaceDir || process.cwd());
    this.extraDirs = options.workspaceDirs ?? [];
    this.jobManagers = [];
    this.requestedPort = options.port;
    this.preferredPort = options.preferredPort;
    this.host = options.host ?? DEFAULT_HOST;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
    this.tailIntervalMs = options.tailIntervalMs ?? DEFAULT_TAIL_INTERVAL_MS;
    this.catalogRefreshIntervalMs = options.catalogRefreshIntervalMs ?? DEFAULT_CATALOG_REFRESH_INTERVAL_MS;
    this.resolveRoots();
  }

  public getPort(): number {
    if (!this.server) return this.requestedPort ?? this.preferredPort ?? DEFAULT_TELEMETRY_PORT;
    const address = this.server.address();
    return typeof address === 'object' && address !== null
      ? address.port
      : this.requestedPort ?? this.preferredPort ?? DEFAULT_TELEMETRY_PORT;
  }

  public getUrl(): string {
    return `http://${this.host}:${this.getPort()}`;
  }

  public async start(): Promise<{ port: number; url: string }> {
    if (this.server) {
      return { port: this.getPort(), url: this.getUrl() };
    }

    this.refreshCatalog();
    this.startTime = Date.now();
    const bound = await listenWithPortSelection({
      host: this.host,
      requestedPort: this.requestedPort,
      preferredPort: this.preferredPort,
      createServer: () => {
        const server = http.createServer((req, res) => this.handleRequest(req, res));
        server.on('connection', (socket) => {
          this.activeSockets.add(socket);
          socket.on('close', () => this.activeSockets.delete(socket));
        });
        return server;
      },
    });
    this.server = bound.server;
    this.tailerTimer = setInterval(() => this.pollForNewEvents(), this.tailIntervalMs);
    this.catalogTimer = setInterval(() => this.refreshCatalog(), this.catalogRefreshIntervalMs);
    return { port: bound.port, url: this.getUrl() };
  }

  public async stop(): Promise<void> {
    if (this.tailerTimer) {
      clearInterval(this.tailerTimer);
      this.tailerTimer = undefined;
    }
    if (this.catalogTimer) {
      clearInterval(this.catalogTimer);
      this.catalogTimer = undefined;
    }

    for (const client of this.activeClients) {
      clearInterval(client.heartbeatTimer);
      try {
        client.response.end();
      } catch {
        // Ignore clients that already closed.
      }
    }
    this.activeClients.clear();

    for (const socket of this.activeSockets) {
      try {
        socket.destroy();
      } catch {
        // Ignore sockets that already closed.
      }
    }
    this.activeSockets.clear();

    for (const target of this.targets.values()) {
      target.eventStore?.close();
    }
    this.targets.clear();

    if (this.server) {
      const serverToClose = this.server;
      this.server = null;
      await new Promise<void>((resolve, reject) => {
        serverToClose.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  }

  private setCorsHeaders(res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Last-Event-ID, Cache-Control');
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    this.setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const hostHeader = req.headers.host || `${this.host}:${this.getPort()}`;
    const parsedUrl = new URL(req.url || '/', `http://${hostHeader}`);
    const pathname = parsedUrl.pathname;
    const isGetOrHead = req.method === 'GET' || req.method === 'HEAD';

    if (isGetOrHead && pathname === '/') {
      this.handleRoot(req, res);
      return;
    }
    if (isGetOrHead && pathname === '/health') {
      this.handleHealth(req, res);
      return;
    }
    if (isGetOrHead && pathname === '/catalog') {
      this.handleCatalog(req, res);
      return;
    }
    if (isGetOrHead && pathname === '/state') {
      this.handleState(req, parsedUrl, res);
      return;
    }
    if (req.method === 'GET' && pathname === '/events') {
      this.handleSseEvents(req, parsedUrl, res);
      return;
    }

    this.sendJson(res, 404, { error: `Not found: ${pathname}` });
  }

  private handleRoot(req: http.IncomingMessage, res: http.ServerResponse): void {
    this.sendJson(res, 200, {
      service: 'reactive-skills-telemetry-broker',
      readOnly: true,
      catalog: '/catalog',
      state: '/state?skillId=<skill-id>&jobId=<job-id>',
      events: '/events',
    }, req.method === 'HEAD');
  }

  private handleHealth(req: http.IncomingMessage, res: http.ServerResponse): void {
    this.refreshCatalog();
    const catalog = this.buildCatalog();
    const body = {
      status: 'ok',
      mode: 'broker',
      readOnly: true,
      url: this.getUrl(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      skillCount: catalog.skills.length,
      jobCount: catalog.skills.reduce((total, skill) => total + skill.jobs.length, 0),
    };
    this.sendJson(res, 200, body, req.method === 'HEAD');
  }

  private handleCatalog(req: http.IncomingMessage, res: http.ServerResponse): void {
    this.refreshCatalog();
    this.sendJson(res, 200, this.buildCatalog(), req.method === 'HEAD');
  }

  private handleState(req: http.IncomingMessage, url: URL, res: http.ServerResponse): void {
    this.refreshCatalog();
    const skillId = url.searchParams.get('skillId') || '';
    const jobId = url.searchParams.get('jobId') || '';
    const target = this.targets.get(this.targetKey(skillId, jobId));

    if (!target) {
      this.sendJson(res, 404, {
        error: 'Invalid telemetry target',
        skillId,
        jobId,
      }, req.method === 'HEAD');
      return;
    }

    const state = this.readState(target);
    this.sendJson(res, 200, state, req.method === 'HEAD');
  }

  private handleSseEvents(req: http.IncomingMessage, url: URL, res: http.ServerResponse): void {
    this.refreshCatalog();
    const filter = this.parseTargetFilter(url, res);
    if (filter === false) return;

    const sinceSeq = this.parseSinceSeq(url.searchParams.get('sinceSeq'));
    const client: BrokerClient = {
      response: res,
      targetKeys: filter,
      lastSeqByTarget: new Map(),
      heartbeatTimer: setInterval(() => {
        try {
          res.write(': heartbeat\n\n');
        } catch {
          clearInterval(client.heartbeatTimer);
        }
      }, this.heartbeatIntervalMs),
    };

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    this.activeClients.add(client);

    const selectedTargets = Array.from(this.targets.values()).filter((target) => {
      return filter === null || filter.has(target.key);
    });
    res.write(`event: connected\ndata: ${JSON.stringify({
      mode: 'broker',
      connectedAt: new Date().toISOString(),
      targets: selectedTargets.map((target) => ({ skillId: target.skillId, jobId: target.jobId })),
    })}\n\n`);

    for (const target of selectedTargets) {
      const baseline = sinceSeq ?? target.tailCursor;
      client.lastSeqByTarget.set(target.key, baseline);
      if (sinceSeq !== null && target.eventStore) {
        for (const event of target.eventStore.getSince(sinceSeq)) {
          this.sendSseEvent(client, target, event);
        }
      }
    }

    req.on('close', () => {
      clearInterval(client.heartbeatTimer);
      this.activeClients.delete(client);
    });
  }

  private parseTargetFilter(url: URL, res: http.ServerResponse): Set<string> | null | false {
    const rawTargets = url.searchParams.getAll('target');
    if (rawTargets.length === 0) return null;

    const targetKeys = new Set<string>();
    for (const rawTarget of rawTargets) {
      const separator = rawTarget.indexOf('/');
      if (separator <= 0 || separator === rawTarget.length - 1) {
        this.sendJson(res, 400, { error: 'Invalid target filter. Use target=<skillId>/<jobId>.' });
        return false;
      }

      const skillId = rawTarget.slice(0, separator);
      const jobId = rawTarget.slice(separator + 1);
      const key = this.targetKey(skillId, jobId);
      if (!this.targets.has(key)) {
        this.sendJson(res, 404, { error: 'Invalid telemetry target', skillId, jobId });
        return false;
      }
      targetKeys.add(key);
    }
    return targetKeys;
  }

  private parseSinceSeq(rawSinceSeq: string | null): number | null {
    if (rawSinceSeq === null || rawSinceSeq.trim() === '') return null;
    const sinceSeq = Number.parseInt(rawSinceSeq, 10);
    return Number.isInteger(sinceSeq) && sinceSeq >= 0 ? sinceSeq : null;
  }

  private sendSseEvent(client: BrokerClient, target: BrokerTarget, event: SignalEvent): void {
    const lastSeq = client.lastSeqByTarget.get(target.key);
    if (lastSeq !== undefined && event.seq <= lastSeq) return;

    const envelope: TelemetryBrokerEventEnvelope = {
      skillId: target.skillId,
      skillName: target.skillName,
      jobId: target.jobId,
      seq: event.seq,
      type: event.type,
      timestamp: event.timestamp,
      payload: event.payload,
      event,
    };

    try {
      client.response.write(`id: ${target.key}:${event.seq}\n`);
      client.response.write('event: telemetry_event\n');
      client.response.write(`data: ${JSON.stringify(envelope)}\n\n`);
      client.lastSeqByTarget.set(target.key, event.seq);
    } catch {
      clearInterval(client.heartbeatTimer);
      this.activeClients.delete(client);
    }
  }

  private pollForNewEvents(): void {
    this.refreshCatalog();

    for (const target of this.targets.values()) {
      if (!target.eventStore) continue;

      try {
        for (const event of target.eventStore.getSince(target.tailCursor)) {
          if (event.seq <= target.tailCursor) continue;
          target.tailCursor = event.seq;
          for (const client of this.activeClients) {
            if (client.targetKeys !== null && !client.targetKeys.has(target.key)) continue;
            this.sendSseEvent(client, target, event);
          }
        }
      } catch (error) {
        console.warn(`Telemetry broker tail poll failed for ${target.key}; retrying.`, error);
      }
    }
  }

  /**
   * Resolve the root list, re-reading a provider function at most once per catalog refresh interval.
   * The first root wins when two roots hold the same skill and job identifiers.
   * # Performance & Risk Budget
   * - Tier: P2 (<100ms target per resolution)
   * - Complexity: O(w), roots returned by the provider
   * - Cyclomatic Complexity (CC): target <=6
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=12
   */
  private resolveRoots(): void {
    const now = Date.now();
    if (this.jobManagers.length > 0 && (typeof this.extraDirs !== 'function' || now - this.rootsResolvedAt < this.catalogRefreshIntervalMs)) return;
    this.rootsResolvedAt = now;
    const extra = typeof this.extraDirs === 'function' ? this.extraDirs() : this.extraDirs;
    const known = new Map(this.jobManagers.map((manager) => [manager.getWorkspaceDir(), manager]));
    const dirs = [...new Set([this.primaryDir, ...extra].map((dir) => path.resolve(dir)))];
    this.jobManagers = dirs.map((dir) => known.get(dir) ?? new JobManager(dir));
  }

  /**
   * Rebuild the target catalog from every configured workspace root.
   * Calls inside the back-off window reuse the previous catalog: the window is the refresh interval, or
   * several times the last refresh's duration when that is longer, so a slow filesystem with many
   * workspaces cannot keep the synchronous refresh running back to back.
   * # Performance & Risk Budget
   * - Tier: P2 (<100ms target per refresh for tens of roots on local disk)
   * - Complexity: O(w * (s + j)), roots, skills and jobs per refresh; opens one reader per new job
   * - Cyclomatic Complexity (CC): target <=18
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=30
   */
  private refreshCatalog(): void {
    if (this.refreshInProgress || Date.now() < this.nextRefreshAt) return;
    this.refreshInProgress = true;
    const startedAt = Date.now();

    try {
      this.resolveRoots();
      const discoveredKeys = new Set<string>();
      for (const jobManager of this.jobManagers) {
        const workspaceDir = jobManager.getWorkspaceDir();
        const skillRoot = path.join(workspaceDir, '.reactive', 'skills');
        const skillEntries = fs.existsSync(skillRoot)
          ? fs.readdirSync(skillRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())
          : [];

        for (const skillEntry of skillEntries) {
          const skillId = skillEntry.name;
          const skillName = this.resolveSkillName(workspaceDir, skillId);
          for (const job of jobManager.listJobs(skillId)) {
            const key = this.targetKey(skillId, job.id);
            if (discoveredKeys.has(key)) continue;
            discoveredKeys.add(key);
            this.upsertTarget(jobManager, workspaceDir, skillId, skillName, job, key);
          }
        }
      }

      for (const [key, target] of this.targets) {
        if (discoveredKeys.has(key)) continue;
        target.eventStore?.close();
        this.targets.delete(key);
      }
    } catch (error) {
      console.warn('Telemetry broker catalog refresh failed; retaining the previous catalog.', error);
    } finally {
      this.refreshInProgress = false;
      const finishedAt = Date.now();
      this.nextRefreshAt = finishedAt + Math.max(this.catalogRefreshIntervalMs, (finishedAt - startedAt) * REFRESH_BACKOFF_FACTOR);
    }
  }

  /**
   * Create or update one catalog target and open its read-only event store when a ledger exists.
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target excluding first store open)
   * - Complexity: O(1) filesystem probes per target
   * - Cyclomatic Complexity (CC): target <=10
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=20
   */
  private upsertTarget(jobManager: JobManager, workspaceDir: string, skillId: string, skillName: string, job: JobMetadata, key: string): void {
    const existing = this.targets.get(key);
    const target: BrokerTarget = existing || {
      key,
      skillId,
      skillName,
      jobId: job.id,
      job,
      workspaceDir,
      jobManager,
      eventStore: null,
      tailCursor: 0,
    };
    target.skillName = skillName;
    target.job = job;

    const hasSqliteStore = this.hasSqliteStore(target);
    const hasPersistentStore = hasSqliteStore || this.hasJsonlStore(target);
    if (!target.eventStore && hasPersistentStore) {
      target.eventStore = new EventStore({
        workspaceDir,
        skillId,
        jobId: job.id,
        enableSqlite: hasSqliteStore,
        readOnly: hasSqliteStore,
      });
      if (!this.server) target.tailCursor = target.eventStore.getLatestSequence();
    }

    if (target.eventStore && !hasPersistentStore) {
      target.eventStore.close();
      target.eventStore = null;
      target.tailCursor = 0;
    }

    this.targets.set(key, target);
  }

  private buildCatalog(): TelemetryCatalogResponse {
    const skills = new Map<string, TelemetryCatalogSkill>();
    const sortedTargets = Array.from(this.targets.values()).sort((a, b) => a.key.localeCompare(b.key));

    for (const target of sortedTargets) {
      let skill = skills.get(target.skillId);
      if (!skill) {
        skill = { skillId: target.skillId, skillName: target.skillName, jobs: [] };
        skills.set(target.skillId, skill);
      }
      skill.jobs.push(this.catalogJob(target));
    }

    return { skills: Array.from(skills.values()) };
  }

  private catalogJob(target: BrokerTarget): TelemetryCatalogJob {
    const latestEvent = target.eventStore?.getLatestEvent() || null;
    const latestSeq = target.eventStore?.getLatestSequence() || 0;
    const updatedAt = [target.job.updatedAt, latestEvent?.timestamp].filter(Boolean).sort().pop() || target.job.updatedAt;

    return {
      jobId: target.jobId,
      runId: target.job.runId || target.job.id,
      name: target.job.name,
      status: target.job.status,
      currentState: this.readActiveState(target),
      latestSeq,
      updatedAt,
      isActive: target.jobManager.getActiveJobId(target.skillId) === target.jobId,
      workspaceRoot: target.job.workspaceRoot ?? target.workspaceDir,
    };
  }

  private readState(target: BrokerTarget): TelemetryBrokerStateResponse {
    const snapshot = target.eventStore?.getLatestSnapshot() || null;
    const latestEvent = target.eventStore?.getLatestEvent() || null;
    return {
      skillId: target.skillId,
      skillName: target.skillName,
      jobId: target.jobId,
      latestSeq: target.eventStore?.getLatestSequence() || 0,
      activeState: this.readActiveState(target),
      context: snapshot?.context,
      snapshot,
      eventCount: target.eventStore?.getEventCount() || 0,
      latestSignal: latestEvent?.type,
    };
  }

  private readActiveState(target: BrokerTarget): string {
    const snapshot = target.eventStore?.getLatestSnapshot();
    return snapshot?.state || target.job.currentState;
  }

  private resolveSkillName(workspaceDir: string, skillId: string): string {
    const candidates = [
      path.join(workspaceDir, 'skills', skillId, 'skill.yaml'),
      path.join(workspaceDir, skillId, 'skill.yaml'),
    ];

    for (const manifestPath of candidates) {
      if (!fs.existsSync(manifestPath)) continue;
      try {
        const manifest = yaml.load(fs.readFileSync(manifestPath, 'utf8')) as { name?: string };
        if (manifest?.name) return manifest.name;
      } catch {
        // Fall back to the stable skill ID when the optional manifest is invalid.
      }
    }

    return skillId;
  }

  private hasSqliteStore(target: BrokerTarget): boolean {
    const skillDir = target.jobManager.getSkillDir(target.skillId);
    return fs.existsSync(path.join(skillDir, 'events.db'));
  }

  private hasJsonlStore(target: BrokerTarget): boolean {
    const skillDir = target.jobManager.getSkillDir(target.skillId);
    return fs.existsSync(path.join(skillDir, 'events.jsonl'));
  }

  private targetKey(skillId: string, jobId: string): string {
    return `${skillId}/${jobId}`;
  }

  private sendJson(
    res: http.ServerResponse,
    statusCode: number,
    payload: unknown,
    headOnly = false,
  ): void {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
    });
    if (!headOnly) res.end(body);
    else res.end();
  }
}

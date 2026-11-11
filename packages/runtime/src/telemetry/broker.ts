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
const SITE_ORIGINS = new Set(['https://reactive-skills.com']);
const LOCAL_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/;
const LOOPBACK_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;
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
  private nextForcedRefreshAt = 0;
  private readonly warned = new Set<string>();
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

  /**
   * Grant cross-origin access only to the official site and loopback pages; other origins get no CORS headers.
   * # Performance & Risk Budget
   * - Tier: P0 (<1ms target)
   * - Complexity: O(1)
   * - Cyclomatic Complexity (CC): target <=4
   * - Branch Coverage: target >=90%
   * - CRAP Score: target <=6
   */
  private setCorsHeaders(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.setHeader('Vary', 'Origin');
    const origin = req.headers.origin;
    if (typeof origin !== 'string' || !(SITE_ORIGINS.has(origin) || LOCAL_ORIGIN.test(origin))) return;
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Last-Event-ID, Cache-Control');
  }

  /**
   * Refuse any request not addressed to a loopback host name before CORS or a route runs, which defeats DNS rebinding.
   * A request without a Host header is left to the platform, which already rejects it for HTTP/1.1.
   * # Performance & Risk Budget
   * - Tier: P0 (<1ms target for the Host check)
   * - Complexity: O(1) per request before routing
   * - Cyclomatic Complexity (CC): target <=10
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=12
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const requestHost = req.headers.host;
    if (requestHost !== undefined && !LOOPBACK_HOST.test(requestHost)) {
      this.sendJson(res, 403, { error: 'Host not allowed. Address the broker as localhost, 127.0.0.1 or [::1].' }, req.method === 'HEAD');
      return;
    }

    this.setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const hostHeader = requestHost ?? `${this.host}:${this.getPort()}`;
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
      state: '/state?skillId=<skill-id>&jobId=<job-id>[&workspaceRoot=<workspace-root>]',
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

  /**
   * Answer one job-scoped state request, resolving an omitted workspace root to the first root holding the job.
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target excluding a rate-limited catalog refresh)
   * - Complexity: O(r + s), roots probed and snapshot read
   * - Cyclomatic Complexity (CC): target <=4
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=6
   */
  private handleState(req: http.IncomingMessage, url: URL, res: http.ServerResponse): void {
    this.refreshCatalog();
    const skillId = url.searchParams.get('skillId') || '';
    const jobId = url.searchParams.get('jobId') || '';
    const workspaceRoot = url.searchParams.get('workspaceRoot') || undefined;
    const target = this.findTarget(workspaceRoot, skillId, jobId);

    if (!target) {
      this.sendJson(res, 404, {
        error: 'Invalid telemetry target',
        skillId,
        jobId,
        workspaceRoot,
      }, req.method === 'HEAD');
      return;
    }

    const state = this.readState(target);
    this.sendJson(res, 200, state, req.method === 'HEAD');
  }

  /**
   * Open one SSE stream over the filtered targets and replay from `sinceSeq` per target.
   * The first subscriber of a target seeds its tail cursor at the latest sequence, so later events are delivered once and none are replayed.
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target excluding replay of stored events)
   * - Complexity: O(t * c + e), selected targets, connected clients and replayed events
   * - Cyclomatic Complexity (CC): target <=11
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=14
   */
  private handleSseEvents(req: http.IncomingMessage, url: URL, res: http.ServerResponse): void {
    this.refreshCatalog();
    const filter = this.parseTargetFilter(url, res);
    if (filter === false) return;

    const sinceSeq = this.parseSinceSeq(url.searchParams.get('sinceSeq'));
    const selectedTargets = Array.from(this.targets.values()).filter((target) => {
      return filter === null || filter.has(target.key);
    });
    for (const target of selectedTargets) {
      if (target.eventStore && !this.hasSubscriber(target)) target.tailCursor = target.eventStore.getLatestSequence();
    }

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

    res.write(`event: connected\ndata: ${JSON.stringify({
      mode: 'broker',
      connectedAt: new Date().toISOString(),
      targets: selectedTargets.map((target) => ({
        skillId: target.skillId,
        jobId: target.jobId,
        workspaceRoot: target.workspaceDir,
      })),
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

  /**
   * Parse repeated `target=[<workspaceRoot>/]<skillId>/<jobId>` filters; an omitted root resolves to the first root holding the job.
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target excluding a rate-limited catalog refresh)
   * - Complexity: O(t * r), filters and roots
   * - Cyclomatic Complexity (CC): target <=8
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=12
   */
  private parseTargetFilter(url: URL, res: http.ServerResponse): Set<string> | null | false {
    const rawTargets = url.searchParams.getAll('target');
    if (rawTargets.length === 0) return null;

    const targetKeys = new Set<string>();
    for (const rawTarget of rawTargets) {
      const parts = rawTarget.split('/');
      const jobId = parts.pop() ?? '';
      const skillId = parts.pop() ?? '';
      if (!skillId || !jobId) {
        this.sendJson(res, 400, { error: 'Invalid target filter. Use target=[<workspaceRoot>/]<skillId>/<jobId>.' });
        return false;
      }

      const workspaceRoot = parts.length > 0 ? parts.join('/') : undefined;
      const target = this.findTarget(workspaceRoot, skillId, jobId);
      if (!target) {
        this.sendJson(res, 404, { error: 'Invalid telemetry target', skillId, jobId, workspaceRoot });
        return false;
      }
      targetKeys.add(target.key);
    }
    return targetKeys;
  }

  /**
   * Resolve a validated target by workspace root, skill and job, taking the first root in order when no root is given.
   * A miss runs one rate-limited catalog refresh so a job created just before the request is still found.
   * # Performance & Risk Budget
   * - Tier: P0 (<5ms target on a hit); a miss adds one rate-limited P2 refresh
   * - Complexity: O(r), roots
   * - Cyclomatic Complexity (CC): target <=6
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=8
   */
  private findTarget(workspaceRoot: string | undefined, skillId: string, jobId: string): BrokerTarget | undefined {
    const lookup = (): BrokerTarget | undefined => {
      const roots = workspaceRoot === undefined ? this.jobManagers.map((manager) => manager.getWorkspaceDir()) : [workspaceRoot];
      for (const root of roots) {
        const target = this.targets.get(this.targetKey(root, skillId, jobId));
        if (target) return target;
      }
      return undefined;
    };
    const found = lookup();
    if (found) return found;
    this.refreshCatalog(true);
    return lookup();
  }

  private parseSinceSeq(rawSinceSeq: string | null): number | null {
    if (rawSinceSeq === null || rawSinceSeq.trim() === '') return null;
    const sinceSeq = Number.parseInt(rawSinceSeq, 10);
    return Number.isInteger(sinceSeq) && sinceSeq >= 0 ? sinceSeq : null;
  }

  /**
   * Write one event, tagged with its workspace root, to a client that has not yet seen its sequence number.
   * # Performance & Risk Budget
   * - Tier: P0 (<5ms target)
   * - Complexity: O(b), serialized event bytes
   * - Cyclomatic Complexity (CC): target <=4
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=6
   */
  private sendSseEvent(client: BrokerClient, target: BrokerTarget, event: SignalEvent): void {
    const lastSeq = client.lastSeqByTarget.get(target.key);
    if (lastSeq !== undefined && event.seq <= lastSeq) return;

    const envelope: TelemetryBrokerEventEnvelope = {
      skillId: target.skillId,
      skillName: target.skillName,
      jobId: target.jobId,
      workspaceRoot: target.workspaceDir,
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

  /**
   * Report whether any connected SSE client selects the target.
   * # Performance & Risk Budget
   * - Tier: P0 (<1ms target)
   * - Complexity: O(c), connected clients
   * - Cyclomatic Complexity (CC): target <=4
   * - Branch Coverage: target >=90%
   * - CRAP Score: target <=6
   */
  private hasSubscriber(target: BrokerTarget): boolean {
    for (const client of this.activeClients) {
      if (client.targetKeys === null || client.targetKeys.has(target.key)) return true;
    }
    return false;
  }

  /**
   * Tail only the targets some client subscribes to, so an idle broker issues no store queries.
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target per tick for the subscribed targets)
   * - Complexity: O(s * (c + log n)) per tick for s subscribed targets, c clients and n stored events; O(1) with no clients
   * - Cyclomatic Complexity (CC): target <=9
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=12
   */
  private pollForNewEvents(): void {
    this.refreshCatalog();
    if (this.activeClients.size === 0) return;

    for (const target of this.targets.values()) {
      if (!target.eventStore || !this.hasSubscriber(target)) continue;

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
        this.warnOnce(`tail:${target.key}`, `Telemetry broker tail poll failed for ${target.key}; retrying.`, error);
      }
    }
  }

  /**
   * Resolve the root list, re-reading a provider function at most once per catalog refresh interval.
   * A failing provider keeps the roots resolved so far; each root keeps its own targets even when another root repeats a skill and job.
   * # Performance & Risk Budget
   * - Tier: P2 (<100ms target per resolution)
   * - Complexity: O(w), roots returned by the provider
   * - Cyclomatic Complexity (CC): target <=7
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=14
   */
  private resolveRoots(): void {
    const now = Date.now();
    if (this.jobManagers.length > 0 && (typeof this.extraDirs !== 'function' || now - this.rootsResolvedAt < this.catalogRefreshIntervalMs)) return;
    this.rootsResolvedAt = now;
    let extra: string[];
    try {
      extra = typeof this.extraDirs === 'function' ? this.extraDirs() : this.extraDirs;
    } catch (error) {
      this.warnOnce('workspace roots', 'Telemetry broker could not resolve workspace roots; keeping the previous roots.', error);
      extra = this.jobManagers.map((manager) => manager.getWorkspaceDir());
    }
    const known = new Map(this.jobManagers.map((manager) => [manager.getWorkspaceDir(), manager]));
    const dirs = [...new Set([this.primaryDir, ...extra].map((dir) => path.resolve(dir)))];
    this.jobManagers = dirs.map((dir) => known.get(dir) ?? new JobManager(dir));
  }

  /**
   * Rebuild the target catalog from every configured workspace root.
   * A failing root or job is skipped with one warning and keeps its previous targets; the other roots still refresh and stale targets are still pruned.
   * Periodic calls inside the back-off window reuse the previous catalog: the window is the refresh interval, or
   * several times the last refresh's duration when that is longer, so a slow filesystem with many
   * workspaces cannot keep the synchronous refresh running back to back.
   * A forced call (a request naming an unknown target) bypasses that window but is itself limited to one per window.
   * # Performance & Risk Budget
   * - Tier: P2 (<100ms target per refresh for tens of roots on local disk)
   * - Complexity: O(w * (s + j)), roots, skills and jobs per refresh; opens one reader per new job
   * - Cyclomatic Complexity (CC): target <=12
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=24
   */
  private refreshCatalog(force = false): void {
    if (this.refreshInProgress || Date.now() < (force ? this.nextForcedRefreshAt : this.nextRefreshAt)) return;
    this.refreshInProgress = true;
    const startedAt = Date.now();

    try {
      this.resolveRoots();
      const discoveredKeys = new Set<string>();
      const failedRoots = new Set<string>();
      for (const jobManager of this.jobManagers) {
        try {
          this.scanRoot(jobManager, discoveredKeys);
        } catch (error) {
          failedRoots.add(jobManager.getWorkspaceDir());
          this.warnOnce(jobManager.getWorkspaceDir(), `Telemetry broker could not scan ${jobManager.getWorkspaceDir()}; keeping its previous targets.`, error);
        }
      }

      for (const [key, target] of this.targets) {
        if (discoveredKeys.has(key) || failedRoots.has(target.workspaceDir)) continue;
        target.eventStore?.close();
        this.targets.delete(key);
      }
    } catch (error) {
      console.warn('Telemetry broker catalog refresh failed; retaining the previous catalog.', error);
    } finally {
      this.refreshInProgress = false;
      const finishedAt = Date.now();
      const backoffUntil = finishedAt + Math.max(this.catalogRefreshIntervalMs, (finishedAt - startedAt) * REFRESH_BACKOFF_FACTOR);
      this.nextRefreshAt = backoffUntil;
      if (force) this.nextForcedRefreshAt = backoffUntil;
    }
  }

  /**
   * Upsert every job of one root, isolating each skill and job so one unreadable store never hides its siblings.
   * A failing skill keeps its previous targets.
   * # Performance & Risk Budget
   * - Tier: P2 (<50ms target per root on local disk)
   * - Complexity: O(s * (j + t)), skills and jobs in the root, t catalog targets rescanned for a failing skill
   * - Cyclomatic Complexity (CC): target <=10
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=14
   */
  private scanRoot(jobManager: JobManager, discoveredKeys: Set<string>): void {
    const workspaceDir = jobManager.getWorkspaceDir();
    const skillRoot = path.join(workspaceDir, '.reactive', 'skills');
    const skillEntries = fs.existsSync(skillRoot)
      ? fs.readdirSync(skillRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())
      : [];

    for (const skillEntry of skillEntries) {
      const skillId = skillEntry.name;
      try {
        const skillName = this.resolveSkillName(workspaceDir, skillId);
        for (const job of jobManager.listJobs(skillId)) {
          const key = this.targetKey(workspaceDir, skillId, job.id);
          discoveredKeys.add(key);
          try {
            this.upsertTarget(jobManager, workspaceDir, skillId, skillName, job, key);
          } catch (error) {
            this.warnOnce(key, `Telemetry broker could not open ${skillId}/${job.id} in ${workspaceDir}; skipping it.`, error);
          }
        }
      } catch (error) {
        for (const target of this.targets.values()) {
          if (target.workspaceDir === workspaceDir && target.skillId === skillId) discoveredKeys.add(target.key);
        }
        this.warnOnce(JSON.stringify([workspaceDir, skillId]), `Telemetry broker could not list ${skillId} in ${workspaceDir}; keeping its previous targets.`, error);
      }
    }
  }

  /**
   * Log a failure once per label so a persistently broken store cannot flood the log on every refresh.
   * # Performance & Risk Budget
   * - Tier: P0 (<1ms target)
   * - Complexity: O(1) set probe
   * - Cyclomatic Complexity (CC): target <=2
   * - Branch Coverage: target >=90%
   * - CRAP Score: target <=3
   */
  private warnOnce(label: string, message: string, error: unknown): void {
    if (this.warned.has(label)) return;
    this.warned.add(label);
    console.warn(message, error);
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
        readOnly: true,
      });
    }

    if (target.eventStore && !hasPersistentStore) {
      target.eventStore.close();
      target.eventStore = null;
      target.tailCursor = 0;
    }

    this.targets.set(key, target);
  }

  /**
   * Group catalog targets by skill, ordering jobs by root order (caller first) and then job identifier.
   * # Performance & Risk Budget
   * - Tier: P1 (<25ms target)
   * - Complexity: O(t log t + r), targets sorted and roots indexed
   * - Cyclomatic Complexity (CC): target <=6
   * - Branch Coverage: target >=80%
   * - CRAP Score: target <=10
   */
  private buildCatalog(): TelemetryCatalogResponse {
    const skills = new Map<string, TelemetryCatalogSkill>();
    const rootOrder = new Map(this.jobManagers.map((manager, index) => [manager.getWorkspaceDir(), index]));
    const sortedTargets = Array.from(this.targets.values()).sort((a, b) => {
      return a.skillId.localeCompare(b.skillId)
        || (rootOrder.get(a.workspaceDir) ?? rootOrder.size) - (rootOrder.get(b.workspaceDir) ?? rootOrder.size)
        || a.jobId.localeCompare(b.jobId);
    });

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
      workspaceRoot: target.workspaceDir,
    };
  }

  private readState(target: BrokerTarget): TelemetryBrokerStateResponse {
    const snapshot = target.eventStore?.getLatestSnapshot() || null;
    const latestEvent = target.eventStore?.getLatestEvent() || null;
    return {
      skillId: target.skillId,
      skillName: target.skillName,
      jobId: target.jobId,
      workspaceRoot: target.workspaceDir,
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

  private targetKey(workspaceDir: string, skillId: string, jobId: string): string {
    return JSON.stringify([workspaceDir, skillId, jobId]);
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

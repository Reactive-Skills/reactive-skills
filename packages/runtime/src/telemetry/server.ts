import http from 'node:http';
import { URL } from 'node:url';
import { EventStore } from '../core/event-store.js';
import { FSMEngine } from '../core/fsm-engine.js';
import { SignalEvent } from '../core/types.js';
import {
  TelemetryHealthResponse,
  TelemetryServerOptions,
  TelemetrySignalRequest,
  TelemetrySignalResponse,
  TelemetryStateResponse,
} from './types.js';
import { renderDashboardHtml } from './dashboard.js';
import {
  DEFAULT_TELEMETRY_PORT,
  listenWithPortSelection,
} from './port-selection.js';

export class TelemetryServer {
  private server: http.Server | null = null;
  private eventStore: EventStore;
  private fsmEngine?: FSMEngine;
  private requestedPort?: number;
  private port?: number;
  private host: string;
  private heartbeatIntervalMs: number;
  private tailIntervalMs: number;
  private skillName?: string;
  private jobId?: string;
  private startTime: number = Date.now();
  private activeClients: Set<http.ServerResponse> = new Set();
  private clientLastSeq: Map<http.ServerResponse, number> = new Map();
  private activeSockets: Set<any> = new Set();
  private unsubscribeEventStore?: () => void;
  private tailerTimer?: ReturnType<typeof setInterval>;
  private tailCursor = 0;
  private tailPollInProgress = false;

  constructor(options: TelemetryServerOptions) {
    this.eventStore = options.eventStore;
    this.fsmEngine = options.fsmEngine;
    this.requestedPort = options.port;
    this.port = options.port;
    this.host = options.host ?? '127.0.0.1';
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 15000;
    this.tailIntervalMs = options.tailIntervalMs ?? 250;
    this.skillName = options.skillName ?? (options.fsmEngine ? options.fsmEngine.getManifest().name : undefined);
    this.jobId = options.jobId ?? options.fsmEngine?.getJobId();
  }

  public getPort(): number {
    if (!this.server) return this.port ?? DEFAULT_TELEMETRY_PORT;
    const addr = this.server.address();
    if (typeof addr === 'object' && addr !== null) {
      return addr.port;
    }
    return this.port ?? DEFAULT_TELEMETRY_PORT;
  }

  public getUrl(): string {
    return `http://${this.host}:${this.getPort()}`;
  }

  public async start(): Promise<{ port: number; url: string }> {
    if (this.server) {
      return { port: this.getPort(), url: this.getUrl() };
    }

    const bound = await listenWithPortSelection({
      host: this.host,
      requestedPort: this.requestedPort,
      createServer: () => this.createServer(),
    });
    this.server = bound.server;
    this.port = bound.port;
    this.startTime = Date.now();

    try {
      // Poll from the current sequence so local and external writers share one ordered delivery path.
      this.tailCursor = this.eventStore.getLatestSequence();
      this.unsubscribeEventStore = this.eventStore.subscribe(() => {
        this.pollForNewEvents();
      });
      this.tailerTimer = setInterval(() => {
        this.pollForNewEvents();
      }, this.tailIntervalMs);
    } catch (error) {
      await this.stop();
      throw error;
    }

    return { port: bound.port, url: this.getUrl() };
  }

  private createServer(): http.Server {
    const server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    server.on('connection', (socket) => {
      this.activeSockets.add(socket);
      socket.on('close', () => {
        this.activeSockets.delete(socket);
      });
    });

    return server;
  }

  public async stop(): Promise<void> {
    if (this.unsubscribeEventStore) {
      this.unsubscribeEventStore();
      this.unsubscribeEventStore = undefined;
    }
    if (this.tailerTimer) {
      clearInterval(this.tailerTimer);
      this.tailerTimer = undefined;
    }

    for (const client of this.activeClients) {
      try {
        client.end();
      } catch {
        // ignore client close errors
      }
    }
    this.activeClients.clear();
    this.clientLastSeq.clear();

    for (const socket of this.activeSockets) {
      try {
        socket.destroy();
      } catch {
        // ignore socket destruction errors
      }
    }
    this.activeSockets.clear();

    if (this.server) {
      const serverToClose = this.server;
      this.server = null;
      await new Promise<void>((resolve, reject) => {
        serverToClose.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  private setCorsHeaders(res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

    if (isGetOrHead && (pathname === '/' || pathname === '/index.html')) {
      this.handleDashboard(req, res);
      return;
    }

    if (isGetOrHead && (pathname === '/health' || pathname === '/status')) {
      this.handleHealth(req, res);
      return;
    }

    if (isGetOrHead && pathname === '/state') {
      this.handleState(req, res);
      return;
    }

    if (isGetOrHead && pathname === '/events/history') {
      this.handleEventsHistory(req, parsedUrl, res);
      return;
    }

    if (req.method === 'GET' && pathname === '/events') {
      this.handleSseEvents(req, parsedUrl, res);
      return;
    }

    if (req.method === 'POST' && pathname === '/signal') {
      this.handleSignal(req, res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Not found: ${pathname}` }));
  }

  private handleDashboard(req: http.IncomingMessage, res: http.ServerResponse): void {
    const html = renderDashboardHtml({
      skillName: this.skillName,
      jobId: this.jobId,
      port: this.getPort(),
      host: this.host,
    });
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(html),
    });
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(html);
    }
  }

  private handleHealth(req: http.IncomingMessage, res: http.ServerResponse): void {
    const payload: TelemetryHealthResponse = {
      status: 'ok',
      skillName: this.skillName,
      jobId: this.jobId,
      port: this.getPort(),
      url: this.getUrl(),
      latestSeq: this.eventStore.getLatestSequence(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
    const body = JSON.stringify(payload);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    });
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(body);
    }
  }

  private handleState(req: http.IncomingMessage, res: http.ServerResponse): void {
    const latestSeq = this.eventStore.getLatestSequence();
    const snapshot = this.eventStore.getLatestSnapshot();
    const activeState = this.fsmEngine ? this.fsmEngine.getCurrentState() : snapshot?.state;
    const context = this.fsmEngine ? this.fsmEngine.getContext() : snapshot?.context;

    const payload: TelemetryStateResponse = {
      skillName: this.skillName,
      jobId: this.jobId,
      port: this.getPort(),
      url: this.getUrl(),
      latestSeq,
      activeState,
      context,
      snapshot,
    };

    const body = JSON.stringify(payload);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    });
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(body);
    }
  }

  private handleEventsHistory(req: http.IncomingMessage, url: URL, res: http.ServerResponse): void {
    const sinceSeqParam = url.searchParams.get('sinceSeq');
    const limitParam = url.searchParams.get('limit');

    const sinceSeq = sinceSeqParam !== null ? parseInt(sinceSeqParam, 10) : undefined;
    const limit = limitParam !== null ? parseInt(limitParam, 10) : undefined;

    let events: SignalEvent[];
    if (sinceSeq !== undefined && !isNaN(sinceSeq)) {
      events = this.eventStore.getSince(sinceSeq);
    } else {
      events = this.eventStore.getAll();
    }

    if (limit !== undefined && !isNaN(limit) && limit > 0) {
      events = events.slice(-limit);
    }

    const payload = {
      count: events.length,
      events,
    };
    const body = JSON.stringify(payload);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    });
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(body);
    }
  }

  private handleSseEvents(req: http.IncomingMessage, url: URL, res: http.ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    this.activeClients.add(res);

    // Initial greeting / connect event
    res.write(`event: connected\ndata: ${JSON.stringify({ skillName: this.skillName, jobId: this.jobId, port: this.getPort(), url: this.getUrl(), connectedAt: new Date().toISOString() })}\n\n`);

    // Determine initial backlog sequence
    const sinceSeqParam = url.searchParams.get('sinceSeq') || (req.headers['last-event-id'] as string | undefined);
    const sinceSeq = sinceSeqParam ? parseInt(sinceSeqParam, 10) : NaN;
    this.clientLastSeq.set(res, !isNaN(sinceSeq) ? sinceSeq : this.eventStore.getLatestSequence());
    if (sinceSeqParam) {
      if (!isNaN(sinceSeq)) {
        const backlog = this.eventStore.getSince(sinceSeq);
        for (const event of backlog) {
          this.sendSseEvent(res, event);
        }
      }
    }

    // Keepalive heartbeat
    const heartbeatTimer = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeatTimer);
      }
    }, this.heartbeatIntervalMs);

    req.on('close', () => {
      clearInterval(heartbeatTimer);
      this.activeClients.delete(res);
      this.clientLastSeq.delete(res);
    });
  }

  private sendSseEvent(client: http.ServerResponse, event: SignalEvent): void {
    try {
      const lastSeq = this.clientLastSeq.get(client);
      if (lastSeq !== undefined && event.seq <= lastSeq) return;
      client.write(`id: ${event.seq}\n`);
      client.write(`event: signal_event\n`);
      client.write(`data: ${JSON.stringify(event)}\n\n`);
      this.clientLastSeq.set(client, event.seq);
    } catch {
      this.activeClients.delete(client);
      this.clientLastSeq.delete(client);
    }
  }

  private broadcastEvent(event: SignalEvent): void {
    for (const client of this.activeClients) {
      this.sendSseEvent(client, event);
    }
  }

  private pollForNewEvents(): void {
    if (this.tailPollInProgress) return;
    this.tailPollInProgress = true;

    try {
      const events = this.eventStore.getSince(this.tailCursor);
      for (const event of events) {
        if (event.seq <= this.tailCursor) continue;
        this.tailCursor = event.seq;
        this.broadcastEvent(event);
      }
    } catch (err) {
      // Keep cursor unchanged so transient SQLite errors are retried on the next interval.
      console.warn('Telemetry event tail poll failed; retrying.', err);
    } finally {
      this.tailPollInProgress = false;
    }
  }

  private handleSignal(req: http.IncomingMessage, res: http.ServerResponse): void {
    let rawBody = '';
    req.setEncoding('utf8');

    req.on('data', (chunk) => {
      rawBody += chunk;
      if (rawBody.length > 1024 * 1024) {
        // 1MB safety guard
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload too large' }));
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const parsed = JSON.parse(rawBody || '{}') as TelemetrySignalRequest;
        if (!parsed.signal) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required field: signal' }));
          return;
        }

        if (this.fsmEngine) {
          const transition = await this.fsmEngine.handleSignal(parsed.signal, parsed.payload || {});
          const response: TelemetrySignalResponse = {
            success: true,
            transition,
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } else {
          // If no FSM engine attached, append signal directly to event store
          const event = this.eventStore.append(
            parsed.signal,
            parsed.payload || {},
            { source: 'telemetry_bridge' }
          );
          const response: TelemetrySignalResponse = {
            success: true,
            event: event as SignalEvent,
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        }
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Signal dispatch failure' }));
      }
    });
  }
}

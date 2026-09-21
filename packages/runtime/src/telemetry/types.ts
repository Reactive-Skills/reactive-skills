import { EventStore } from '../core/event-store.js';
import { FSMEngine } from '../core/fsm-engine.js';
import { SignalEvent } from '../core/types.js';

export interface TelemetryServerOptions {
  /**
   * EventStore instance to observe
   */
  eventStore: EventStore;

  /**
   * Optional FSMEngine instance for executing state transitions on HITL signals
   */
  fsmEngine?: FSMEngine;

  /**
   * Port to listen on (0 for ephemeral port, default: 4242)
   */
  port?: number;

  /**
   * Host to bind to (default: '127.0.0.1')
   */
  host?: string;

  /**
   * Interval for SSE keep-alive heartbeats in ms (default: 15000)
   */
  heartbeatIntervalMs?: number;

  /**
   * Skill identifier for health/metadata reporting
   */
  skillName?: string;

  /**
   * Job identifier for health/metadata reporting
   */
  jobId?: string;

  /**
   * Interval for polling SQLite events written by another process in ms (default: 250)
   */
  tailIntervalMs?: number;
}

export interface TelemetryHealthResponse {
  status: 'ok';
  skillName?: string;
  jobId?: string;
  latestSeq: number;
  uptimeSeconds: number;
}

export interface TelemetryStateResponse {
  skillName?: string;
  jobId?: string;
  latestSeq: number;
  activeState?: string;
  context?: Record<string, any>;
  snapshot?: {
    seq: number;
    state: string;
    context: Record<string, any>;
  } | null;
}

export interface TelemetrySignalRequest {
  signal: string;
  payload?: Record<string, any>;
  context?: Record<string, any>;
}

export interface TelemetrySignalResponse {
  success: boolean;
  event?: SignalEvent;
  transition?: any;
  error?: string;
}

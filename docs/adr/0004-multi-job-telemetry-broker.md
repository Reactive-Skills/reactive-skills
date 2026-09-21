# ADR 0004: Multi-Job Telemetry Broker

Status: Accepted.

Date: 2026-09-21.

## Context

The existing telemetry server is intentionally scoped to one skill and one job.

The event store already persists each job in SQLite and supports cross-process polling.

The site needs one connection for multiple job cards without weakening job isolation or introducing an external broker.

## Decision

Add a separate read-only `TelemetryBroker` runtime service and expose it through `reactive-skills-axi dashboard`.

Keep the existing `TelemetryServer` and `reactive-skills-axi view` single-job contract unchanged.

Discover skill and job metadata from the workspace using `JobManager` and safe workspace skill manifests.

Maintain one SQLite-backed reader and local tail cursor per discovered skill/job pair.

Multiplex those readers into one SSE stream with explicit skill ID, job ID, local sequence, event type, timestamp, payload, and original event fields.

Validate all HTTP targets against the refreshed catalog before reading state or subscribing.

Keep the broker read-only and omit signal dispatch routes.

Use a site dashboard at `/telemetry` that owns one `EventSource` per browser session and filters events again at the card boundary.

## Alternatives Considered

Extending `TelemetryServer` with a multiplexed mode was rejected because it would couple single-job compatibility and broker lifecycle behavior.

An external message broker was rejected because SQLite already provides the authoritative local event source and the slice is intended for local monitoring.

Browser connections per card were rejected because they multiply connections and complicate target changes.

Scanning arbitrary filesystem paths from HTTP parameters was rejected because it creates a path traversal and data exposure boundary.

Using global sequence order was rejected because each job owns a local sequence domain.

## Consequences

The broker can monitor multiple local jobs without changing existing writers or active-job state.

The broker performs one bounded polling loop per discovered job store.

New jobs become visible after the catalog refresh interval or an explicit catalog request.

The dashboard reconnects one stream when the selected target set changes.

The broker must evict and close readers for jobs removed from the catalog.

The site must retain source identity on every event and enforce card-level isolation.

The broker remains limited to the local workspace and read-only telemetry.

## Value Sources

SQLite authority is defined by `packages/runtime/src/core/event-store.ts`.

Job and active pointer semantics are defined by `packages/runtime/src/core/job-manager.ts`.

The existing single-job telemetry contract is defined by `packages/runtime/src/telemetry/server.ts` and `docs/adr/0003-job-targeted-live-telemetry.md`.

The browser bridge workflow is defined by `apps/site/src/features/telemetry/LiveTelemetryDeck.jsx`.

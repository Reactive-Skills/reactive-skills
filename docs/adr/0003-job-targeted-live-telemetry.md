# ADR 0003: Job-Targeted Live Telemetry

Status: Accepted.

Date: 2026-09-21.

## Context

Reactive Skills isolates event history by job in SQLite and JSONL stores.

The current telemetry server subscribes to one in-process `EventStore` instance.

Separate job writers persist events but do not notify the viewer process.

Operators also lack an explicit job selector in the `view` command.

## Decision

Use a single-job telemetry viewer selected by `--job <job-id>`.

Keep the active job pointer unchanged when an explicit job is selected.

Combine the existing in-process subscription with a configurable SQLite tailer for cross-process events.

Use SQLite sequence order as the tail cursor and deduplication key.

Keep the current SSE catch-up contract through `sinceSeq` and `Last-Event-ID`.

Expose the effective job ID in CLI output, HTTP responses, SSE metadata, and the site telemetry deck.

## Alternatives Considered

JSONL file watching was rejected because JSONL is an audit mirror, can rotate, and can expose partial writes.

A central broker was rejected because it adds deployment and operational complexity for local job telemetry.

Multi-job viewer multiplexing was rejected because it weakens the default isolation boundary and expands the UI and API surface.

## Consequences

The viewer can follow an inactive or parallel job without changing shared active-job state.

Events written by separate CLI, MCP, and worker processes can reach the existing viewer stream.

SQLite polling adds bounded delivery latency and one read loop per viewer.

The telemetry server must manage tailer cursors, deduplication, timer cleanup, and transient database errors.

Existing in-process delivery remains low latency.

## Value Sources

The authoritative persistence rule comes from `packages/runtime/src/core/event-store.ts`.

The job selection and active pointer rules come from `packages/runtime/src/core/job-manager.ts`.

The current HTTP and SSE contract comes from `packages/runtime/src/telemetry/server.ts` and `packages/runtime/src/telemetry/types.ts`.

The operator-facing command contract comes from `apps/axi/src/commands/view.ts` and the AXI README.

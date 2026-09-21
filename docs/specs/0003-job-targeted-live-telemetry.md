# Specification: Job-Targeted Live Telemetry

Status: Implemented.

Target: `@reactive-skills/runtime`, `@reactive-skills/axi`, and the site telemetry deck.

Related specs: `docs/specs/job-lifecycle-and-terminal-rotation.md`.

## 1. Problem Statement

Reactive Skills stores events per job, but the telemetry viewer does not accept an explicit job ID.

The viewer therefore follows the active job pointer or `REACTIVE_JOB_ID` instead of clearly following a selected job.

The telemetry server broadcasts only events received by its in-process `EventStore` subscription.

Events written by a separate CLI, MCP, or worker process persist correctly but do not reach an existing SSE client.

Job IDs appear in some command output but not in the viewer startup output or telemetry metadata.

## 2. Scope

This slice adds a single-job telemetry viewer that follows one explicit job without changing the active job pointer.

This slice adds cross-process live event delivery from the selected job's authoritative SQLite event store.

This slice makes the selected job ID visible in CLI output, HTTP responses, SSE metadata, and the site telemetry deck.

This slice adds automated coverage for selection, isolation, cross-process delivery, reconnect catch-up, and backward compatibility.

## 3. Design Decision

The viewer uses a single-job model.

`reactive-skills-axi view <skill> --job <job-id>` selects the job explicitly.

Without `--job`, existing resolution remains unchanged through `REACTIVE_JOB_ID`, the active pointer, and the default job.

The telemetry server keeps the current in-process subscription for immediate delivery.

The telemetry server also polls the selected job's SQLite store for events after its last observed sequence.

SQLite remains the authoritative source because the event store already defines SQLite as authoritative when enabled.

The tailer deduplicates events by sequence and preserves ordered delivery to each SSE client.

The initial SSE connection replays events after `sinceSeq` or `Last-Event-ID` before entering live tailing.

The default tail interval targets sub-second delivery and remains configurable for tests and constrained environments.

The viewer does not multiplex jobs and does not mutate the active job pointer.

## 4. Job Identity Contract

The viewer startup response includes `job_id`.

`/health`, `/state`, and the SSE `connected` event include `job_id`.

Every streamed event already carries its job identity through `run_id` and retains that envelope.

`invoke`, `state`, `emit`, `jobs`, and `view` output show the effective job ID.

Existing sortable UUID job IDs remain valid.

Users can provide readable IDs through explicit `--job <job-id>` values.

## 5. Acceptance Criteria

1. `reactive-skills-axi view <skill> --job <job-id>` starts a viewer for the requested job.

2. Starting a viewer for an inactive job does not change `.reactive/skills/<skill>/active_job`.

3. Viewer startup output identifies the selected job and exposes the job-specific telemetry endpoints.

4. `/health`, `/state`, and the SSE connection metadata identify the selected job.

5. An event appended by a separate process to the selected job appears on the existing SSE stream within the configured tail interval.

6. An event appended to a different job never appears on the selected job stream.

7. SSE reconnect with `sinceSeq` or `Last-Event-ID` catches up persisted events without duplicates.

8. Existing in-process event streaming remains supported.

9. Existing active-job and legacy-store behavior remains compatible when `--job` is omitted.

10. `invoke`, `state`, `emit`, `jobs`, and `view` make the effective job ID observable to the operator.

11. Runtime, AXI, and site documentation describe explicit job telemetry following.

12. Focused tests and the repository verification gates pass.

## 6. Non-Requirements

This slice does not add a message broker or external telemetry service.

This slice does not multiplex multiple jobs in one viewer.

This slice does not change job ID generation or rename existing jobs.

This slice does not make telemetry writes authoritative in JSONL.

## 7. Ordered Build Plan

1. Extend telemetry options and responses with selected job identity.

2. Add explicit job parsing and job-scoped viewer construction to AXI.

3. Add SQLite tailing, ordered deduplication, reconnect handling, and cleanup to the telemetry server.

4. Update the site telemetry deck to display the selected job and retain live state updates.

5. Add runtime and AXI tests for isolation, cross-process delivery, reconnects, and output.

6. Update public runtime and AXI documentation.

7. Run focused tests, full verification, and fresh diff review.

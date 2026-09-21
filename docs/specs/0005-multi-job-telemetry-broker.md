# Specification: Multi-Job, Multi-Skill Telemetry Broker

Status: Implemented.

Target: `@reactive-skills/runtime`, `@reactive-skills/axi`, and the site telemetry surface.

Related specs: `docs/specs/0003-job-targeted-live-telemetry.md`.

## 1. Problem Statement

The current telemetry server follows one skill and one job per process.

Operators need one local broker and one browser connection that can monitor several jobs across several skills.

The browser must discover valid targets from the broker without reading the workspace directly.

## 2. Design Decisions

The new user-facing command is `reactive-skills-axi dashboard`.

The command starts a read-only `TelemetryBroker` that binds to `127.0.0.1` by default and accepts explicit `--host` and `--port` values.

The broker is a separate runtime class from `TelemetryServer` so the existing single-job HTTP and signal behavior remains compatible.

The broker discovers targets from the current workspace's `.reactive/skills` directory through `JobManager` and reads optional skill metadata from the workspace skill manifest.

The broker never constructs a store from an HTTP-supplied path.

The broker refreshes the catalog on a bounded interval and refreshes it before catalog and target validation responses.

Each discovered skill and job pair has one SQLite-backed `EventStore` reader and one local tail cursor.

SQLite remains the authoritative event source, and the broker polls each target store so writers in separate CLI, MCP, and worker processes are visible.

Each target retains its own local sequence numbers.

The broker uses the target key `skillId/jobId` only as a validated catalog identifier for repeated `target` query parameters.

The broker exposes only read-oriented routes and does not expose signal dispatch.

## 3. HTTP Contract

`GET /catalog` returns `{ skills: [{ skillId, skillName, jobs: [...] }] }`.

Each job entry includes `jobId`, `status`, `currentState`, `latestSeq`, `updatedAt`, and `isActive`.

`GET /state?skillId=<id>&jobId=<id>` validates both identifiers against the catalog and returns `skillId`, `skillName`, `jobId`, `latestSeq`, `activeState`, `context`, `snapshot`, `eventCount`, and `latestSignal`.

`GET /events` opens one SSE stream for all discovered targets when no filters are supplied.

Repeated `target=<skillId>/<jobId>` parameters restrict the stream to selected catalog targets.

`sinceSeq` is applied independently to every selected target because sequence numbers are local to each job.

Every streamed telemetry event contains `skillId`, `jobId`, `seq`, `type`, `timestamp`, and the original event `payload`.

The SSE event also retains the complete original `SignalEvent` under `event`.

`GET /health` reports broker status, listener metadata, and catalog counts.

`OPTIONS` responses retain the existing CORS and Local Network Access headers.

Invalid skill and job identifiers return a JSON client error without touching a filesystem path.

The existing single-job `TelemetryServer` keeps `/health`, `/state`, `/events/history`, `/events`, `/signal`, CORS, and its current response shapes.

## 4. Site Contract

The site adds a telemetry dashboard surface at `/telemetry` with a user-supplied broker URL.

The dashboard fetches `/catalog`, offers skill and job selectors, and lets the user add or remove tracked pairs.

The dashboard opens one `EventSource` for the current target set and reconnects it when the target set changes.

Each tracked card fetches job-scoped state and displays the skill, job ID, connection status, current HSM state, recorded event count, latest signal, and a live event ledger.

Events are accepted by a card only when both `skillId` and `jobId` match the card target.

The dashboard has explicit loading, empty, invalid-target, and connection-error states.

The existing registry `LiveTelemetryDeck` keeps its single-job bridge URL workflow.

The new dashboard does not dispatch signals.

## 5. Acceptance Criteria

1. Catalog discovery lists multiple skills and multiple jobs within one skill.

2. Catalog job metadata reports active-job status without changing the active-job pointer.

3. Valid state requests return only the requested skill and job, and invalid requests return a client error.

4. One multiplexed SSE stream delivers correctly identified events for multiple targets.

5. Target filtering delivers only selected skill and job pairs.

6. Events written through a separate SQLite-backed store are delivered without restarting the broker.

7. New job metadata becomes visible after catalog refresh without restarting the broker.

8. Multiple simultaneous clients receive independent, correctly filtered streams.

9. Existing single-job viewer tests and endpoint behavior remain passing.

10. The site can select at least two jobs, render both job IDs, and update only the matching card when one job receives an event.

11. Build, runtime tests, AXI tests, site build, and browser smoke verification pass.

## 6. Non-Requirements

This slice does not add a message broker or external service dependency.

This slice does not dispatch signals through the broker.

This slice does not change active-job pointer semantics.

This slice does not scan arbitrary localhost ports from the browser.

This slice does not replace or multiplex the existing single-job viewer.

## 7. Ordered Build Plan

1. Add broker contracts and target discovery in the runtime.

2. Add SQLite tailing, catalog refresh, target validation, state retrieval, and multiplexed SSE delivery.

3. Add the `dashboard` AXI command with host, port, listener URL, and lifecycle handling.

4. Add the `/telemetry` site surface and one-connection multi-card state model.

5. Add focused runtime, AXI, and dashboard behavior tests.

6. Add usage documentation without changing generated changelog files.

7. Run the required verification gates and browser smoke test.

## 8. Value Sources

SQLite authority and per-store sequence behavior come from `packages/runtime/src/core/event-store.ts`.

Job metadata, active pointer resolution, and job listing come from `packages/runtime/src/core/job-manager.ts`.

Single-job HTTP, SSE, CORS, and signal compatibility come from `packages/runtime/src/telemetry/server.ts` and `packages/runtime/src/telemetry/types.ts`.

Existing CLI host, port, and lifecycle conventions come from `apps/axi/src/commands/view.ts` and `apps/axi/src/cli/index.ts`.

The existing single-job browser workflow comes from `apps/site/src/features/telemetry/LiveTelemetryDeck.jsx`.

## 9. Manual Verification

1. Start `reactive-skills-axi dashboard --port 0` and record the printed broker URL.

2. Open the site `/telemetry` route and connect to that URL.

3. Select two jobs and confirm that each card displays the matching skill and job ID.

4. Append a new SQLite event to one job while the dashboard remains open.

5. Confirm that only the matching card's event count, latest signal, and ledger change.

6. Confirm that the second card remains unchanged and the page does not reload.

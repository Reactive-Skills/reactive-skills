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

When `--port` is omitted, the broker reuses the runtime port-selection helper and falls back through a bounded range beginning at port `4242` if the preferred port is occupied.

An explicit port remains strict, while `--port 0` requests an OS-assigned ephemeral port.

The broker is a separate runtime class from `TelemetryServer` so the existing single-job HTTP and signal behavior remains compatible.

The broker discovers targets from the `.reactive/skills` directory of `workspaceDir` and any further `workspaceDirs` through one `JobManager` per root, and reads optional skill metadata from each root's skill manifest.

When two roots hold the same skill and job identifiers, the job is listed once per root, in root order with the caller's root first, and each catalog job reports the `workspaceRoot` that holds it.

A failing root or job is skipped with one warning, keeps its previous targets, and never stops the other roots or the prune pass from running.

The broker never constructs a store from an HTTP-supplied path.

The broker refreshes the catalog on a bounded interval and before catalog and target validation responses, but skips a refresh that falls inside a back-off window: the refresh interval, or six times the last refresh's duration when that is longer.

Each discovered skill and job pair has one SQLite-backed `EventStore` reader and one local tail cursor.

Every reader is opened read-only, including for legacy JSONL-only stores, so the broker creates no run directories or other files in a recorded workspace.

A skill whose jobs cannot be listed is skipped with one warning and keeps its previous targets, so its sibling skills in the same root still refresh.

SQLite remains the authoritative event source, and the broker polls the store of every target a connected SSE client subscribes to, so writers in separate CLI, MCP, and worker processes are visible; with no client connected it issues no store queries.

The first client to subscribe to a target seeds its tail cursor at the latest sequence, so later events are delivered once and none are replayed.

Each target retains its own local sequence numbers.

The broker identifies a target by workspace root, skill and job, and uses `[workspaceRoot/]skillId/jobId` only as a validated catalog identifier for repeated `target` query parameters.

An omitted workspace root resolves to the first root in order that holds the skill and job.

A request that names a target the catalog does not hold runs one immediate catalog refresh, limited to one per back-off window, before the broker answers with a client error.

The broker exposes only read-oriented routes and does not expose signal dispatch.

## 3. HTTP Contract

`GET /catalog` returns `{ skills: [{ skillId, skillName, jobs: [...] }] }`.

Each job entry includes `jobId`, `workspaceRoot`, `status`, `currentState`, `latestSeq`, `updatedAt`, and `isActive`.

`GET /state?skillId=<id>&jobId=<id>[&workspaceRoot=<root>]` validates the identifiers against the catalog and returns `skillId`, `skillName`, `jobId`, `workspaceRoot`, `latestSeq`, `activeState`, `context`, `snapshot`, `eventCount`, and `latestSignal`.

`GET /events` opens one SSE stream for all discovered targets when no filters are supplied.

Repeated `target=[<workspaceRoot>/]<skillId>/<jobId>` parameters restrict the stream to selected catalog targets.

`sinceSeq` is applied independently to every selected target because sequence numbers are local to each job.

Every streamed telemetry event contains `skillId`, `jobId`, `workspaceRoot`, `seq`, `type`, `timestamp`, and the original event `payload`.

The SSE event also retains the complete original `SignalEvent` under `event`.

`GET /health` reports broker status, listener metadata, and catalog counts.

`OPTIONS` responses carry the CORS and Local Network Access headers only for allowlisted origins: `https://reactive-skills.com` and `http://localhost` or `http://127.0.0.1` on any port.

The broker reflects the matched origin and adds `Vary: Origin`; other origins receive no CORS headers, and requests without an `Origin` header are served unchanged.

The broker answers only requests whose `Host` header is `localhost`, `127.0.0.1` or `[::1]`, with any port, and refuses every other `Host` with `403` before CORS handling or any route runs, including `OPTIONS` and the SSE route, so DNS rebinding cannot reach it under another name.

A request with no `Host` header is left to the HTTP platform, which already rejects it for HTTP/1.1.

Because only loopback names are answered, binding with `--host 0.0.0.0` listens on every interface but is reachable only through `localhost` or `127.0.0.1`, and the printed `0.0.0.0` URL is refused.

Neither the Host rule nor the CORS allowlist stops a non-browser client on a network the broker is bound to.

The single-job `TelemetryServer` is outside this slice and keeps its wildcard CORS headers.

Invalid skill and job identifiers return a JSON client error without touching a filesystem path.

The existing single-job `TelemetryServer` keeps `/health`, `/state`, `/events/history`, `/events`, `/signal`, CORS, and its current response shapes.

## 4. Site Contract

The site adds a telemetry dashboard surface at `/telemetry` with a user-supplied broker URL.

The dashboard fetches `/catalog`, offers skill and job selectors, and lets the user add or remove tracked pairs.

The dashboard opens one `EventSource` for the current target set and reconnects it when the target set changes.

Each tracked card fetches job-scoped state and displays the skill, job ID, workspace label, connection status, current HSM state, recorded event count, latest signal, and a live event ledger.

Events are accepted by a card only when `skillId`, `jobId` and `workspaceRoot` all match the card target.

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

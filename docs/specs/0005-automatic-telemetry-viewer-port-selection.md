# Specification: Automatic Telemetry Viewer Port Selection

Status: Implemented.

Target: `@reactive-skills/runtime` and `@reactive-skills/axi`.

## Intent

Allow standalone telemetry viewers to find an available local port when the operator omits `--port`.

Keep explicit port selection strict and preserve the existing single-job viewer contract.

## Design

The runtime owns port selection so the successful HTTP bind and the reported endpoint share one source of truth.

Omitted `--port` attempts real binds in order from `127.0.0.1:4242` through a bounded ten-port range.

An explicit port, including `0`, performs exactly one real bind attempt.

The server creates no event subscription or SQLite tailer timer until a bind succeeds.

Every failed bind candidate is released before the next candidate is attempted.

The selected port and URL are returned by startup and exposed in CLI output, health responses, state responses, and SSE connection metadata.

The site uses the URL reported by AXI and does not scan local ports.

## Acceptance Criteria

1. An explicit available port is used exactly as requested.

2. An explicit occupied port fails with a clear error and does not fall back.

3. Explicit port `0` returns the OS-assigned port rather than `0`.

4. Omitted `--port` selects `4242` when it is available.

5. Omitted `--port` selects the next available candidate when `4242` is occupied.

6. Exhausting the bounded fallback range returns a clear runtime error.

7. Failed candidates leave no HTTP server, timer, event subscription, SQLite tailer, or open socket behind.

8. CLI output, telemetry URLs, machine-readable telemetry fields, and SSE metadata report the actual selected port.

9. Job-targeted telemetry behavior and the active job pointer remain unchanged.

10. Runtime, AXI, and site documentation show automatic fallback, explicit ports, port `0`, and the browser-side discovery limitation.

## Non-Requirements

This slice does not add multi-job or multi-skill broker behavior.

This slice does not make the website scan local ports.

This slice does not modify `CHANGELOG.md`.

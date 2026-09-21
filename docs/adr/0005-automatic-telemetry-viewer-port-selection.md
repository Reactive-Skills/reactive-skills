# ADR 0005: Automatic Telemetry Viewer Port Selection

Status: Accepted.

Date: 2026-09-21.

## Context

The standalone `view` command previously passed the default port `4242` directly to the telemetry server.

When another local process occupied that port, the viewer failed even though a nearby port could serve the same selected job.

The command also needed to preserve strict explicit ports and OS-assigned port `0` behavior.

## Decision

Keep port selection inside the runtime telemetry startup path.

Use real HTTP listen attempts, beginning at `4242` and proceeding through a bounded ten-port range only when no port was requested.

Treat every explicit numeric port, including `0`, as a single strict bind attempt.

Initialize subscriptions and tail timers only after a bind succeeds.

Report the successful bound port and URL from the same server instance through CLI and telemetry metadata.

## Alternatives Considered

CLI retries over separate server instances were rejected because lifecycle cleanup would be duplicated at the command boundary.

Check-then-bind port probes were rejected because another process can claim the port between the check and the real bind.

An unbounded scan was rejected because startup would become nondeterministic and could hide configuration failures.

## Consequences

Standalone viewers recover from a busy preferred port without changing the website.

Explicit ports remain predictable and fail clearly when unavailable.

The fallback range is deterministic and bounded.

The active job pointer and single-job isolation contract remain unchanged.

Clients must use the reported URL because browser-side port discovery is intentionally out of scope.

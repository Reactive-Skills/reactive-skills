# ADR-0005: Preserve Context Across Explicit Synthesis Continuations

Status: Accepted.

Date: 2026-09-21.

## Context

Synthesis writes a canonical projection for the active run and an isolated archive for each run.

A later invocation previously started from the skill defaults unless the caller manually reconstructed prior context.

That behavior made subsequent synthesis runs appear to overwrite prior work, even though the earlier run archive remained intact.

Implicitly merging the active job would make unrelated work contaminate one another and would make the source of inherited content ambiguous.

## Decision

Support explicit parent-run continuation through the `--parent` invocation flag.

The child loads the parent run's latest persisted context snapshot as read-only input.

The child's initial payload overrides inherited top-level context keys.

The child starts from the skill's initial state and does not resume the parent's state machine.

Parent and child runs remain isolated in their own event stores and projection archives.

The parent relationship is recorded in job metadata and emitted event metadata.

Missing parents and parents without persisted snapshots fail before child execution begins.

## Consequences

Existing fresh invocations keep their current behavior.

Subsequent runs preserve prior context when the caller explicitly names the parent run.

Markdown projections are not merged as prose, which avoids duplicate or conflicting document sections.

Callers must choose the parent run explicitly when continuing work.

The active root projection remains a view of one active run, while historical run archives remain recoverable.

## Alternatives considered

Implicitly inheriting from the current active job was rejected because it is unsafe for parallel or unrelated work.

Appending generated Markdown to an existing document was rejected because it cannot reliably reconcile changed facts, replaced decisions, or removed sections.

Resuming the parent state machine was rejected because continuation is a new synthesis run with a new input delta.

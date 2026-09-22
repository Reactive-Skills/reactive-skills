# ADR 0004: Runtime Compatibility Contract

Status: Proposed.

Date: 2026-09-21.

## Context

Reactive Skills manifests can use judgment adapters and other runtime features that are absent from older AXI installations.

Unknown manifest fields can be ignored by older runtimes, which creates a silent compatibility failure instead of a clear rejection.

Consumers need a reliable way to inspect the installed runtime before invoking a skill.

## Decision

Store optional runtime requirements in `skill.yaml` under `runtime_requirements`.

Validate the minimum runtime version and required capabilities during `FSMEngine` construction.

Expose the same compatibility logic through `axi capabilities` and `axi preflight <skill>`.

Keep Jev as an observed optional capability when Script fallback is available.

Record adapter selection and fallback status in judgment-related events.

Document version pinning as the consumer control for preventing an old runtime from silently ignoring new metadata.

## Alternatives Considered

A separate `runtime.json` was rejected because it requires every consumer to distribute and load a second skill artifact.

Package-only peer dependencies were rejected because standalone skills are not necessarily installed as npm packages.

A boot-state-only compatibility gate was rejected because old runtimes can ignore new metadata and bypass the intended semantic check.

Making Jev mandatory was rejected because the deterministic Script adapter is the supported fallback and remains useful without ambient Jev access.

## Consequences

Skill authors have one portable, validated compatibility declaration.

Updated runtimes fail before state execution when requirements are not met.

CLI and SDK consumers can inspect compatibility without mutating a job.

Older runtimes remain unable to enforce fields they do not understand, so published skills must document and pin their runtime floor.

The capability registry becomes a maintained compatibility surface and requires tests when new runtime features are added.

Judgment event payloads become suitable for independent adapter-use audits.

## Value Sources

The current manifest schema comes from `packages/runtime/src/core/types.ts`.

The runtime loading boundary comes from `packages/runtime/src/core/fsm-engine.ts`.

The judgment adapter cascade comes from `packages/runtime/src/core/judgment-engine.ts`.

The AXI command surface comes from `apps/axi/src/cli/index.ts` and `apps/axi/src/commands/`.

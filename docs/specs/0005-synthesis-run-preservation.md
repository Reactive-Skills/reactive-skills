# Specification: Synthesis Run Preservation and Continuation

Status: Accepted.

Target: `@reactive-skills/runtime`, `@reactive-skills/axi`, and the `synthesis` skill.

## 1. Problem Statement

Synthesis archives each job, but its canonical documents represent only the active job.

Starting a new job therefore replaces the visible project documents with the new job snapshot.

The archive remains recoverable, but the workflow does not provide an explicit way to continue from an earlier job with its context intact.

## 2. Scope

Add explicit parent-run continuation to the runtime and AXI CLI.

When a child run names a parent run, the child starts with the latest parent context snapshot and then applies its own initial context overrides.

Record the parent relationship in job metadata and event metadata.

Preserve the existing active-root snapshot and per-job archive projection behavior.

Update synthesis initialization guidance so a new mission can continue from a selected prior job without implicitly merging unrelated jobs.

Add regression coverage for parent context inheritance, array and object preservation, override precedence, archive isolation, active-root mirroring, and reset behavior.

## 3. Design Decision

Use explicit parent selection rather than implicit inheritance from the active job.

Expose parent selection through `reactive-skills-axi invoke <skill> --job <child> --parent <parent>`.

Load only the parent run's latest persisted context snapshot.

Do not resume the parent state machine or replay the parent state path into the child.

Apply child `--payload` values after inherited context so the child can intentionally replace inherited values.

Keep canonical root documents as the selected active-job snapshot.

Keep each job archive immutable from the perspective of other jobs.

Do not merge unrelated jobs automatically.

## 4. Runtime Contract

`FSMEngineOptions` accepts optional `parentRunId`.

`EventStoreOptions` and `EventContext` carry the normalized parent run identifier.

`JobManager.createJob` receives and persists `parentRunId`.

The runtime reads the parent's latest snapshot without acquiring a writer lock.

If the parent run is missing or has no snapshot, the child fails with a typed validation error rather than silently starting with incomplete context.

The existing behavior remains unchanged when no parent run is supplied.

## 5. AXI Contract

`invoke` accepts `--parent <job-id-or-alias>` and `--parent=<job-id-or-alias>`.

The parent flag is removed from the skill payload before payload parsing.

The child run is created with the selected parent relationship before `FSMEngine` starts.

Existing `--job`, `--run`, `--run-id`, and `--payload` behavior remains compatible.

## 6. Synthesis Contract

The synthesis `INIT` state explains resume, switch, fresh mission, and explicit continuation choices.

The synthesis `INIT` entry hook does not clear inherited mission, domain, baseline, invariant, slice, or execution context.

Fresh runs still receive the manifest default context.

Continuation prompts instruct the agent to preserve inherited material and add only the new delta unless the user explicitly requests replacement.

## 7. Acceptance Criteria

1. A fresh run behaves exactly as it does today when no parent is supplied.

2. A child run records its parent run ID in job metadata and event metadata.

3. A child run inherits the parent's latest context snapshot before applying child initial context overrides.

4. Nested objects and arrays survive inheritance when the child does not override them.

5. Child overrides replace only the named top-level context keys.

6. A missing parent fails before the child begins execution and does not create misleading deliverables.

7. Parent and child event stores remain isolated.

8. Parent archive files remain unchanged after child projections run.

9. Active root documents mirror only the selected active job.

10. Reset archives the child non-destructively, and purge remains the only destructive path.

11. Synthesis documentation describes explicit continuation and the active snapshot versus archive model.

12. Runtime and AXI test suites pass.

## 8. Non-Requirements

This slice does not merge Markdown files by parsing their prose.

This slice does not implicitly combine multiple parent jobs.

This slice does not change the meaning of `jobs switch`.

This slice does not modify generated `.docs` deliverables manually.

This slice does not edit `CHANGELOG.md`.

## 9. Ordered Build Plan

1. Add failing runtime tests for parent snapshot inheritance and missing-parent handling.

2. Implement read-only parent snapshot loading and parent metadata propagation.

3. Add AXI parent flag parsing and invocation wiring.

4. Add synthesis continuation guidance and remove destructive initialization clearing for inherited context.

5. Add isolation, archive, root mirror, reset, and CLI regression tests.

6. Run build, runtime tests, AXI tests, documentation checks, and fresh diff review.

## 10. Value Sources

The runtime manifest and context types are defined in `packages/runtime/src/core/types.ts`.

The runtime construction boundary is `packages/runtime/src/core/fsm-engine.ts`.

The event and snapshot persistence boundary is `packages/runtime/src/core/event-store.ts`.

The job metadata boundary is `packages/runtime/src/core/job-manager.ts`.

The CLI argument boundary is `apps/axi/src/args.ts` and `apps/axi/src/commands/invoke.ts`.

The synthesis behavior is defined in `skills/synthesis/skill.yaml` and `skills/synthesis/states/init.md`.

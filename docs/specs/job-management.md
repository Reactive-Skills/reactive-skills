# Specification: Job & Run Management for Reactive Skills

## Problem Statement

Currently, Reactive Skills operates as an implicit singleton per workspace directory. When an autonomous software delivery skill such as `synthesis` executes, all state machine transitions and deliverable projections write directly to static paths within the repository root (e.g., `.reactive/skills/synthesis/` and `.docs/synthesis/`).

This design creates severe limitations:
1. **History Loss:** Every new execution overwrites previous deliverables (`MISSION.md`, `PROGRESS.md`, `SPEC.md`, `AUDIT_REPORT.md`). Once an execution concludes or a reset is performed, prior architectural deliberations and audit records are permanently erased.
2. **Concurrency Hazards:** If a user, CI pipeline, or multiple autonomous agents run skills in the same repository simultaneously, they experience state bleeding, interleaved sequence numbering in the event ledger, and destructive race-condition file overwrites.
3. **Impaired Subagent Stigmergy:** In multi-phase skills like `synthesis` that dispatch subagents to implement tickets, subagents cannot independently use reactive state machines or work on separate vertical slices without colliding with the parent skill or each other.

Users need a way to run skills with isolated execution contexts, maintain full historical records of past runs, and execute multiple jobs concurrently in the same directory without breaking existing single-run workflows.

## Solution

Introduce first-class **Job / Run Management** to the Reactive Skills Architecture:

1. **Job Isolation:** Every execution can be scoped to a distinct `job_id` (either an auto-generated sortable identifier or a semantic slug like `auth-slice`).
2. **Isolated Event Ledgers:** Event streams, SQLite state tables, and state machine snapshots are isolated to job-specific storage directories while maintaining parent-child correlation links.
3. **Dual-Layer Deliverables (Mirror + Archive):**
   - Every projection writes to an immutable historical job archive folder.
   - The active/primary job simultaneously projects its outputs to the canonical workspace root folder, ensuring zero disruption to human developers, git diffs, and downstream tools expecting standard paths.
4. **Concurrency Safety & Mutex Locks:** Non-blocking file-based mutexes ensure two processes cannot drive the same job at the same time, while allowing different jobs to run in parallel in the same folder.
5. **Job Lifecycle CLI & 100% Backward Compatibility:** The AXI CLI and MCP tools gain optional `--job` / `job_id` parameters. If omitted, the runtime defaults to the active job, preserving full backward compatibility with all existing skills, agent prompts, and test suites.

## User Stories

1. As a developer, I want each run of `synthesis` to archive its deliverables in a run-specific directory, so that I can look back at the original mission and technical specification after completing a project.
2. As an agent orchestrator, I want to execute `synthesis` for an `auth-slice` feature and a `billing-slice` feature in the same repository simultaneously, so that independent slices can be developed in parallel without file collisions.
3. As a developer using the AXI CLI, I want to run `reactive-skills-axi state synthesis` without specifying a job ID, so that my existing workflow and prompts continue to work without any changes.
4. As an autonomous agent calling MCP tools, I want `reactive_state` and `reactive_emit_signal` to default to the currently active job, so that existing skill bootloaders do not need to be rewritten.
5. As a developer reviewing deliverables, I want the active job's projections to be automatically mirrored into the root `.docs/synthesis/` directory, so that standard documentation paths remain populated and easy to browse in my editor.
6. As a developer, I want to provide a human-readable job name (e.g. `--job payment-gateways`), so that the generated deliverables and event stores reflect the semantic feature being built.
7. As an agent dispatcher in `synthesis` Phase 4, I want to spawn subagents with a dedicated `job_id` and pass `parent_run_id`, so that subagent skill executions can be traced back to the parent ticket.
8. As a developer, I want to list all past and current jobs using `reactive-skills-axi jobs <skill>`, so that I can inspect the lifecycle status, start time, and active state of every run.
9. As a developer, I want to switch the active job using `reactive-skills-axi jobs switch <skill> <job-id>`, so that the canonical root deliverables update to reflect the newly active job.
10. As a developer, I want to run `reactive-skills-axi reset <skill>` to archive the current run and start a fresh job, so that resetting a skill does not permanently destroy past work.
11. As a developer, I want to run `reactive-skills-axi reset <skill> --purge`, so that I can explicitly delete all historical jobs and event data when I intentionally want a clean slate.
12. As a CI/CD pipeline operator, I want parallel test runs to use isolated job IDs in the same checkout, so that concurrent verification steps do not clobber each other's test results.
13. As a developer working on Windows, macOS, or Linux, I want the dual-write mirroring mechanism to work reliably without requiring filesystem symlinks or administrator privileges.
14. As an agent monitoring execution, I want `reactive-skills-axi events --job <job-id>` to tail only the events belonging to that specific job, so that the log is clean and unambiguous.
15. As a developer, I want to compare deliverables between two runs using `reactive-skills-axi diff <skill> <job-a> <job-b>`, so that I can see how specifications and plans evolved across iterations.
16. As a developer, I want existing repositories with legacy un-itemized event stores to be automatically recognized as the `default` job without manual migration, so that upgrading the runtime is seamless.
17. As a skill author, I want to define `skill.yaml` without adding any job management boilerplate, so that skill authoring remains focused purely on states, transitions, and templates.
18. As an agent that encountered an error, I want to resume an interrupted job using `reactive-skills-axi resume <skill> --job <job-id>`, so that I can recover execution without restarting from the initial state.
19. As a developer, I want the runtime to prevent two agents from sending conflicting signals to the same job at the same instant, so that state transitions remain strictly deterministic.
20. As a telemetry viewer user, I want the SSE event stream and web viewer to filter events by `job_id`, so that I can observe the real-time execution of a single selected job.

## Implementation Decisions

### 1. Job Identifier and Resolution Strategy
- Every job will possess a unique, chronologically sortable identifier.
- When the user or agent supplies a semantic name (e.g. `auth-slice`), the runtime normalizes this into a slug and stores it as the job alias while maintaining an immutable internal UUID/ULID.
- The active job pointer is stored in a plain-text marker file within the skill's reactive directory. If this file does not exist, the runtime falls back to resolving or creating a job named `default`.
- All CLI commands and MCP endpoints accept an optional job flag/argument. When omitted, the runtime queries the active marker file, ensuring 100% backward compatibility for all callers.

### 2. Event Store Scoping & Concurrency Controls
- Event ledgers (JSONL files and SQLite databases) are scoped to a subfolder per job.
- When initialized, the event store assigns the job identifier to the event context envelope (`run_id`) for every emitted signal and transition.
- A lockfile mechanism based on standard non-blocking file descriptor locks guards each job directory. If an agent attempts to drive a job that is already running in another active process, the runtime rejects the operation with a clear concurrency error code (`JOB_LOCKED`). Different jobs operate concurrently with zero contention.

### 3. Dual-Write Projection Delivery
- The projection engine receives the resolved job identifier and active status upon instantiation.
- For every projection trigger, the engine writes rendered artifacts to two locations:
  1. The historical archive path within the skill's deliverables directory, namespaced by job identifier.
  2. The canonical root path declared in the skill manifest, provided the executing job is designated as the active job.
- To prevent cross-platform symlink failures (particularly on Windows machines lacking Developer Mode permissions), mirroring is performed via direct atomic file write rather than filesystem links.

### 4. Legacy Store Compatibility & In-Place Auto-Migration
- If the runtime encounters an existing root event file without a job subfolder, it treats this existing ledger as the `default` job in place.
- The active pointer is initialized to `default` without relocating or modifying existing event files, ensuring no breaking changes to legacy directories or ongoing runs.

### 5. CLI Command Suite Extensions
- The top-level CLI adds a `jobs` command group with subcommands:
  - `list`: Displays all known jobs for a skill, their current state, start time, and active indicator.
  - `switch`: Sets the active pointer to a specified job and synchronizes the canonical root deliverables with that job's latest projections.
  - `archive`: Marks the current job as completed and detaches it from the active pointer.
- Existing commands (`state`, `emit`, `events`, `inspect`, `reset`) accept an optional `--job <id>` flag.
- The `reset` command defaults to archiving the current job and cleanly initializing a fresh job, while a `--purge` flag is provided for complete directory cleanup.

### 6. Job Metadata Envelope Schema (Prototype Reference)
```typescript
interface JobMetadata {
  id: string;
  name: string;
  skillId: string;
  status: 'active' | 'completed' | 'failed' | 'archived';
  currentState: string;
  parentRunId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

## Testing Decisions

### What Makes a Good Test
- Tests must exclusively evaluate **external observable behavior** through public command interfaces and engine contracts. Tests should never assert on internal private class variables or unexposed helper functions.
- Every test must verify:
  1. Given a command/action, the expected output matches the contract.
  2. The correct filesystem artifacts (event entries, deliverables) are created in the expected locations.
  3. Concurrent operations behave deterministically (isolated execution succeeds; double-locking on the same job fails cleanly).

### Modules and Seams to Test
1. **CLI Seam (`apps/axi/tests/commands/`):**
   - Testing `state`, `emit`, `reset`, and `jobs` commands across temporary isolated directories.
   - Verifying that running commands without `--job` creates and uses the `default` job.
   - Verifying that passing `--job slice-a` creates isolated archives without touching `slice-b`.
2. **Runtime Engine Seam (`packages/runtime/tests/`):**
   - Testing `FSMEngine` rehydration when switching between multiple jobs in the same workspace.
   - Testing `ProjectionEngine` dual-writing (verifying both the archive directory and the canonical root are written).
   - Testing `EventStore` concurrency locks preventing simultaneous modifications to the same job.

### Prior Art
- `apps/axi/tests/commands/state.test.ts`: Tests TOON rendering and engine initialization via CLI commands.
- `apps/axi/tests/commands/reset.test.ts`: Tests filesystem clearing and state re-initialization.
- `packages/runtime/tests/fsm-engine.test.ts`: Tests state transitions, snapshots, and event rehydration.
- `packages/runtime/tests/sqlite-event-store.test.ts`: Tests concurrent SQLite transactions, sequences, and queries.

## Out of Scope

1. **Distributed / Multi-Machine Scheduling:** This feature is scoped strictly to local workspace execution on single machines. Distributed job distribution across clusters (e.g. via Redis, RabbitMQ, or Celery) is out of scope.
2. **Collaborative Live Merging of Single Deliverable Files:** Real-time multi-agent collaborative editing (OT/CRDT) within a single file in the same job is out of scope; isolation happens at the job and slice boundary.
3. **Changes to `skill.yaml` Language Specification:** Modifying the core state machine schema in `skill.yaml` to require job syntax is out of scope; all job management is handled transparently by the runtime.

## Further Notes

- Once this specification is approved, implementation can proceed cleanly in two phased vertical slices:
  1. **Slice 1 (Core Isolation):** `EventStore` run scoping, `FSMEngine` job options, and `ProjectionEngine` dual-write mirroring.
  2. **Slice 2 (Interface & Ergonomics):** AXI CLI `jobs` command suite, `--job` flag plumbing, and MCP tool parameter support.

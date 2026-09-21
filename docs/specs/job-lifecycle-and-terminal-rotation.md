# Specification: Job Lifecycle Ergonomics & Terminal Auto-Rotation

**Status:** Draft / Approved for Implementation  
**Target:** `@reactive-skills/runtime` & `reactive-skills-axi`  
**Related Specs:** `docs/specs/job-management.md`  

---

## 1. Problem Statement

When an AI agent or developer begins a new task using a reactive skill, they typically invoke `reactive-skills-axi state <skill>` or the MCP tool `reactive_state`. 

Under the current architecture:
1. **Dead Pointer Trap:** The active job pointer (`.reactive/skills/<skill>/active_job`) remains pinned to the *previous* run. If that run reached a terminal state (`COMPLETED`, `DONE`, `ABORTED`), `state` queries return the completed run's state and exit prompt, halting the agent with:
   ```
   current_state: COMPLETED
   help: Current job is terminal. Run `reactive-skills-axi reset <skill>` or `reactive-skills-axi invoke <skill>`.
   ```
2. **Bootloader Inversion:** The universal reactive bootloader (`<!-- REACTIVE BOOTLOADER -->`) in `SKILL.md` lists `1. Run reactive-skills-axi state <skill>` as the primary step, prompting agents to treat `state` as the start command instead of `invoke`.
3. **Concurrency Bottleneck:** Parallel subagents or CI workers operating on the same skill collide on the single `.reactive/skills/<skill>/active_job` file.

---

## 2. Invariants & Desired Behavior

### Invariant 1: Natural Task Inception via Bootloader
- The bootloader contract must explicitly differentiate starting a task from resuming an in-progress task.
- Agents reading `SKILL.md` must be instructed:
  - **New Task:** `reactive-skills-axi invoke <skill> [--payload JSON]`
  - **Resume Task:** `reactive-skills-axi state <skill>`

### Invariant 2: Terminal Auto-Rotation Safety Net
- When `axi state <skill>` or `reactive_state` is queried without an explicit `--job` or `job_id`:
  - If the active job is currently in a terminal state (`COMPLETED`, `DONE`, `SUCCESS`, `ERROR`, `ABORTED`, `BYPASS_DETECTED`):
    - The runtime must **non-destructively archive** the completed job.
    - The runtime must **automatically rotate** the active pointer to a newly generated sortable job ID.
    - The runtime boots into the skill's `initial_state` and returns the fresh prompt slice.
  - If a user/agent explicitly wants to inspect a completed job, they can pass `--job <id>` or use `axi inspect` / `axi jobs list`.

### Invariant 3: Environment-Scoped Job Isolation (`REACTIVE_JOB_ID`)
- `JobManager.getActiveJobId(skillId)` must check `process.env.REACTIVE_JOB_ID` before falling back to the filesystem marker file `.reactive/skills/<skill>/active_job`.
- This allows multi-agent swarms (e.g. subagents launched with different environment variables) to execute concurrent jobs on the same skill without filesystem race conditions or clobbering each other's active pointers.

---

## 3. Architecture & Implementation Plan

### Vertical Slice: Job Lifecycle Ergonomics (Slice 3)

#### Leaf 1: Bootloader Contract Inversion
- **Files to update:**
  - `apps/axi/src/bootloader.ts`: Update `createReactiveBootloader` to promote `invoke` for new tasks and `state` for resuming.
  - `packages/runtime/src/core/migration.ts`: Update `createReactiveBootloader` in migration engine.
  - Fixtures and tests expecting the old bootloader wording.
- **Verification:** `pnpm vitest run apps/axi/tests/commands/init.test.ts packages/runtime/tests/migration.test.ts`

#### Leaf 2: Runtime Terminal Auto-Rotation
- **Files to update:**
  - `packages/runtime/src/core/job-manager.ts`: Add `isJobTerminal(job: JobMetadata): boolean` and helper `rotateIfTerminal(skillId: string): { rotated: boolean; activeJobId: string }`.
  - `packages/runtime/src/core/fsm-engine.ts`: In constructor, if no explicit `jobId` was supplied and the active job is terminal, automatically rotate to a fresh job before rehydration.
  - `apps/axi/src/commands/state.ts`: Handle seamless rendering when auto-rotation occurs.
  - `packages/runtime/src/mcp/server.ts`: Apply the same resolution in `getEngine(...)`.
- **Verification:** Unit and integration tests verifying that calling `state` on a skill in `COMPLETED` automatically boots a fresh job into `INIT` with a new sortable ID.

#### Leaf 3: Environment Isolation (`REACTIVE_JOB_ID`)
- **Files to update:**
  - `packages/runtime/src/core/job-manager.ts`: Read `process.env.REACTIVE_JOB_ID` in `getActiveJobId()`.
  - `apps/axi/src/args.ts`: Support `REACTIVE_JOB_ID` fallback in CLI argument extraction.
  - Test suite verifying that parallel subagents with different `REACTIVE_JOB_ID` values run in isolated sandboxes without touching `active_job`.
- **Verification:** `pnpm vitest run packages/runtime/tests/job-domain.test.ts apps/axi/tests/commands/job-flags.test.ts`

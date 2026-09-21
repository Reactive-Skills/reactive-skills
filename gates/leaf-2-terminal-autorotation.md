# Gate: Leaf 2 — Runtime Terminal Auto-Rotation

**Slice:** 3 (Job Lifecycle Ergonomics & Terminal Auto-Rotation)  
**Leaf:** 2  
**Spec:** `docs/specs/job-lifecycle-and-terminal-rotation.md`  
**Description:** Enable the runtime (`JobManager`, `FSMEngine`, and `stateCommand`) to auto-rotate terminal active jobs (`COMPLETED`, `DONE`, `SUCCESS`, `ERROR`, `ABORTED`, `BYPASS_DETECTED`) to a fresh job when queried with `state` without an explicit `--job`.

## Targeted Files
- `packages/runtime/src/core/job-manager.ts`
- `packages/runtime/src/core/fsm-engine.ts`
- `apps/axi/src/commands/state.ts`
- `packages/runtime/src/mcp/server.ts`

## Expected Behavior
1. In `JobManager`, add `isJobTerminal(job: JobMetadata): boolean` checking terminal states: `['COMPLETED', 'DONE', 'SUCCESS', 'ERROR', 'ABORTED', 'BYPASS_DETECTED']`.
2. When `FSMEngine` or `getEngine()` resolves the active job:
   - If `options.jobId` was NOT explicitly provided, and the resolved `activeJob` is terminal:
   - Non-destructively archive the completed job (`status: 'archived'`, `completedAt: now`).
   - Create a fresh job (`createJob(skillId, { setActive: true })`).
   - Boot into `initial_state` of the fresh job.
3. If `--job <id>` is explicitly passed to `state`, the runtime returns the historical state without auto-rotating.

## Verification Gates
- [ ] G1: Calling `isJobTerminal` returns true for `COMPLETED`, `DONE`, etc.
- [ ] G2: When active job is terminal, `stateCommand` boots into `INIT` with a fresh sortable ID instead of failing with `Current job is terminal`.
- [ ] G3: Calling `stateCommand` with explicit `--job <completed-id>` still inspects the completed job.
- [ ] G4: Vitest test suite for terminal auto-rotation passes.

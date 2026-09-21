# Gate: Leaf 3 — Environment-Scoped Job Isolation (`REACTIVE_JOB_ID`)

**Slice:** 3 (Job Lifecycle Ergonomics & Terminal Auto-Rotation)  
**Leaf:** 3  
**Spec:** `docs/specs/job-lifecycle-and-terminal-rotation.md`  
**Description:** Decouple concurrent subagents and parallel workers from the global `.reactive/skills/<skill>/active_job` file by prioritizing `process.env.REACTIVE_JOB_ID`.

## Targeted Files
- `packages/runtime/src/core/job-manager.ts`
- `apps/axi/src/args.ts`
- `packages/runtime/tests/job-domain.test.ts`
- `apps/axi/tests/commands/job-flags.test.ts`

## Expected Behavior
1. In `JobManager.getActiveJobId(skillId)`:
   - If `process.env.REACTIVE_JOB_ID` is set and non-empty, return that value immediately without reading `.reactive/skills/<skill>/active_job`.
2. In `extractJobFlag(args)`:
   - If `--job` flag is not explicitly passed in args, fall back to `process.env.REACTIVE_JOB_ID`.
3. In `JobManager.setActiveJobId(skillId, jobId)`:
   - If `process.env.REACTIVE_JOB_ID` is set, log or no-op so the global pointer file is not mutated by isolated child subagents.

## Verification Gates
- [x] G1: `JobManager.getActiveJobId` returns `process.env.REACTIVE_JOB_ID` when defined.
  CHECK: npx vitest run packages/runtime/tests/job-domain.test.ts -t "prioritizes REACTIVE_JOB_ID"
  EVIDENCE: passed (1 test passed)
- [x] G2: CLI `state` and `emit` commands pick up `process.env.REACTIVE_JOB_ID` when `--job` flag is omitted.
  CHECK: npx vitest run apps/axi/tests/commands/job-flags.test.ts -t "prioritizes REACTIVE_JOB_ID"
  EVIDENCE: passed (1 test passed)
- [x] G3: Parallel subagent isolation test passes without cross-talk on `active_job`.
  CHECK: npx vitest run packages/runtime/tests/job-domain.test.ts apps/axi/tests/commands/job-flags.test.ts
  EVIDENCE: passed (20 passed out of 20 tests)

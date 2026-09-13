# Gate: Leaf 4 — AXI CLI Flag Plumbing & Fallbacks

**Slice:** 2 (CLI & MCP Job Orchestration)  
**Leaf:** 4  
**Engine:** `/implement-spec`  
**Description:** Plumb optional `--job <id>` through `state`, `emit`, `events`, and `reset` in AXI CLI with transparent default resolution.

## Verification Gates

- [x] G1: `reactive-skills-axi state <skill>` without `--job` reads state from active job
  CHECK: pnpm vitest run apps/axi/tests/commands/job-flags.test.ts -t "state default job resolution"
  EXPECT: passed
  EVIDENCE: passed (1 test passed in 29ms)

- [x] G2: `reactive-skills-axi state <skill> --job <id>` isolates read to specified job
  CHECK: pnpm vitest run apps/axi/tests/commands/job-flags.test.ts -t "state explicit job flag"
  EXPECT: passed
  EVIDENCE: passed (1 test passed in 51ms)

- [x] G3: `reactive-skills-axi emit <skill> <signal> --job <id>` transitions only targeted job
  CHECK: pnpm vitest run apps/axi/tests/commands/job-flags.test.ts -t "emit targeted job transition"
  EXPECT: passed
  EVIDENCE: passed (1 test passed in 45ms)

- [x] G4: `reactive-skills-axi reset <skill>` archives current active job without destroying historical jobs
  CHECK: pnpm vitest run apps/axi/tests/commands/job-flags.test.ts -t "reset archives active job"
  EXPECT: passed
  EVIDENCE: passed (1 test passed in 53ms)

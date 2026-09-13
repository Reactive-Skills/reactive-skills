# Gate: Leaf 5 — AXI `jobs` Command Suite & TOON Output

**Slice:** 2 (CLI & MCP Job Orchestration)  
**Leaf:** 5  
**Engine:** `/unlazy`  
**Description:** Implement `reactive-skills-axi jobs [list|switch|archive]` command suite with TOON formatted tables.

## Verification Gates

- [x] G1: `reactive-skills-axi jobs <skill>` (or `jobs list`) renders TOON table of all jobs
  CHECK: pnpm vitest run apps/axi/tests/commands/jobs.test.ts -t "jobs list renders toon table"
  EXPECT: passed
  EVIDENCE: ✓ apps/axi/tests/commands/jobs.test.ts > AXI jobs Command Suite (Leaf 5) > jobs list renders toon table: shows all jobs with status and active marker (passed)

- [x] G2: `reactive-skills-axi jobs switch <skill> <job-id>` switches active pointer and re-mirrors deliverables
  CHECK: pnpm vitest run apps/axi/tests/commands/jobs.test.ts -t "jobs switch re-mirrors root deliverables"
  EXPECT: passed
  EVIDENCE: ✓ apps/axi/tests/commands/jobs.test.ts > AXI jobs Command Suite (Leaf 5) > jobs switch re-mirrors root deliverables: switches active pointer and mirrors archive files (passed)

- [x] G3: `reactive-skills-axi jobs archive <skill>` marks job as completed/archived and rotates active pointer
  CHECK: pnpm vitest run apps/axi/tests/commands/jobs.test.ts -t "jobs archive rotates pointer"
  EXPECT: passed
  EVIDENCE: ✓ apps/axi/tests/commands/jobs.test.ts > AXI jobs Command Suite (Leaf 5) > jobs archive rotates pointer: marks target job as archived and rotates active pointer (passed)

- [x] G4: Full AXI test suite passes cleanly
  CHECK: pnpm test:axi
  EXPECT: passed
  EVIDENCE: Test Files: 13 passed (13), Tests: 53 passed (53) (passed)

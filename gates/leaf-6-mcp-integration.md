# Gate: Leaf 6 — MCP Job Protocol Integration

**Slice:** 2 (CLI & MCP Job Orchestration)  
**Leaf:** 6  
**Engine:** `/implement-spec`  
**Description:** Expose optional `job_id` parameter across MCP tools (`reactive_state`, `reactive_emit_signal`) and register `reactive_list_jobs`.

## Verification Gates

- [x] G1: `reactive_state` accepts optional `job_id` and defaults to active job when omitted
  CHECK: pnpm vitest run packages/runtime/tests/mcp-server.test.ts -t "reactive_state job parameter"
  EXPECT: passed
  EVIDENCE: ✓ packages/runtime/tests/mcp-server.test.ts > Reactive MCP Server Integration > reactive_state job parameter: accepts optional job_id and defaults to active job (82ms)

- [x] G2: `reactive_emit_signal` routes transition to targeted `job_id`
  CHECK: pnpm vitest run packages/runtime/tests/mcp-server.test.ts -t "reactive_emit_signal targeted job"
  EXPECT: passed
  EVIDENCE: ✓ packages/runtime/tests/mcp-server.test.ts > Reactive MCP Server Integration > reactive_emit_signal targeted job: routes transition to targeted job_id without bleeding (98ms)

- [x] G3: `reactive_list_jobs` MCP tool returns all known jobs for a skill with status metadata
  CHECK: pnpm vitest run packages/runtime/tests/mcp-server.test.ts -t "reactive_list_jobs tool"
  EXPECT: passed
  EVIDENCE: ✓ packages/runtime/tests/mcp-server.test.ts > Reactive MCP Server Integration > reactive_list_jobs tool: returns all known jobs for a skill with status metadata (105ms)

- [x] G4: Full runtime and MCP Vitest suite passes cleanly
  CHECK: pnpm test
  EXPECT: passed
  EVIDENCE: Test Files: 17 passed (17), Tests: 136 passed (136). Documentation Invariants and Prose quality gate passed.

# Depth Tree: Job & Run Management for Reactive Skills

- [x] Slice 1: Core Job Isolation & Dual-Write Projections (Full Vertical)
  - [x] Leaf 1: Define `JobMetadata` schema, ID/slug normalization, active pointer resolution, and core job domain decider. (Engine: `/tdd`, Gate: `gates/leaf-1-job-domain.md`)
  - [x] Leaf 2: Implement job-scoped `EventStore` pathing (`.reactive/skills/<skill>/jobs/<jobId>/`), job lockfile mutex, and legacy fallback. (Engine: `/implement-spec`, Gate: `gates/leaf-2-job-storage.md`)
  - [x] Leaf 3: Implement `FSMEngine` job resolution and `ProjectionEngine` dual-write mirroring (job archive + canonical root). (Engine: `/tdd`, Gate: `gates/leaf-3-job-engine-projections.md`)

- [x] Slice 2: CLI & MCP Job Orchestration (Full Vertical)
  - [x] Leaf 4: Plumb optional `--job <id>` through `state`, `emit`, `events`, and `reset` in AXI CLI with transparent default resolution. (Engine: `/implement-spec`, Gate: `gates/leaf-4-cli-flag-plumbing.md`)
  - [x] Leaf 5: Implement `reactive-skills-axi jobs [list|switch|archive]` command suite with TOON formatted tables. (Engine: `/unlazy`, Gate: `gates/leaf-5-axi-jobs-command.md`)
  - [x] Leaf 6: Expose optional `job_id` parameter across MCP tools (`reactive_state`, `reactive_emit_signal`) and register `reactive_list_jobs`. (Engine: `/implement-spec`, Gate: `gates/leaf-6-mcp-integration.md`)

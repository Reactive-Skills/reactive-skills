
## [0.8.6] - 2026-09-21

- fix(axi): add version flag (9a43cf0)
- chore(release): v0.8.5 - automatic telemetry broker port fallback (269c0a9)
- fix(telemetry): reuse automatic broker port selection (417ecd5)
- feat(telemetry): add multi-job broker (#1) (d96ee85)
- chore(release): v0.8.3 - add viewer port fallback (10e686e)

## [0.8.5] - 2026-09-21

- fix(telemetry): reuse automatic broker port selection (417ecd5)
- feat(telemetry): add multi-job broker (#1) (d96ee85)
- chore(release): v0.8.3 - add viewer port fallback (10e686e)
- fix(site): restore live telemetry updates (0d76add)
- chore(release): v0.8.2 - add job-targeted live telemetry (4efd2ae)

## [0.8.4] - 2026-09-21

- Merge remote-tracking branch 'origin/main' into feature/multi-job-telemetry-broker (e55530b)
- feat(telemetry): add multi-job broker (680d5c4)
- chore(release): v0.8.3 - add viewer port fallback (10e686e)
- fix(site): restore live telemetry updates (0d76add)
- chore(release): v0.8.2 - add job-targeted live telemetry (4efd2ae)

## [0.8.3] - 2026-09-21

- fix(site): restore live telemetry updates (0d76add)
- chore(release): v0.8.2 - add job-targeted live telemetry (4efd2ae)
- chore(prose): expand prose quality gate to blog and docs, de-slop site content (4bb1a9a)
- chore(blog): de-slop launch series prose and tighten technical voice (02fc333)
- feat(blog): integrate Decap CMS, markdown loader, and launch reactive runtime series (690995b)

## [0.8.2] - 2026-09-21

- chore(prose): expand prose quality gate to blog and docs, de-slop site content (4bb1a9a)
- chore(blog): de-slop launch series prose and tighten technical voice (02fc333)
- feat(blog): integrate Decap CMS, markdown loader, and launch reactive runtime series (690995b)
- chore(release): v0.8.1 - preserve named job isolation and read-only state semantics (9a107e6)
- fix(runtime): preserve isolation for named parallel jobs (87d0832)

## [0.8.1] - 2026-09-21

- fix(runtime): preserve isolation for named parallel jobs (87d0832)
- chore(release): bump version to v0.8.0 and update documentation (6d792c7)
- feat(axi): support --run and REACTIVE_JOB_ID in events command (9709621)
- feat(runtime): implement REACTIVE_JOB_ID environment isolation and flag synonyms (Leaf 3) (715ccf3)
- feat(runtime): implement terminal job auto-rotation on state queries (Leaf 2) (abdc9df)

## [0.8.0] - 2026-09-21

- feat(axi): support --run and REACTIVE_JOB_ID in events command (9709621)
- feat(runtime): implement REACTIVE_JOB_ID environment isolation and flag synonyms (Leaf 3) (715ccf3)
- feat(runtime): implement terminal job auto-rotation on state queries (Leaf 2) (abdc9df)
- feat(axi): invert reactive bootloader to promote invoke for new tasks (Leaf 1) (4aa92d6)
- docs(spec): add job lifecycle ergonomics, terminal auto-rotation, and stigmergic gates (a9915a9)

## [0.7.0] - 2026-09-21

### Features

- **Decoupled Judgment Engine & Snap-On Adapters (`JudgmentPort`, `JudgmentAdapter`):**
  - Integrated SASH / Hexagonal Ports-and-Adapters architecture for transition guard evaluation without introducing hard dependencies on external AI SDKs.
  - Built-in `ScriptJudgmentAdapter` provides instant zero-dependency (<1ms) deterministic sandboxed heuristics.
  - Snap-on `JevJudgmentAdapter` dynamically discovers TypeSafe AI's System One decision model via ambient CLI (`npx -y jev-axi`) or HTTP endpoints, executing semantic evaluations in ~400ms.
  - Safe cross-platform state serialization via temporary JSON files prevents shell quoting corruption and stdin-pipe hanging on Windows.

- **Circuit Breaker Resilience & Fallback Routing:**
  - `CircuitBreaker` wrapper safeguards against external judgment API latency, network partitioning, or outages (trips after configurable failure thresholds with automatic cooldown recovery).
  - Transition contracts support `fallback_target`: if a judgment adapter fails, is unavailable, or times out, the FSM transitions directly to a designated mitigation state (e.g. `BLOCKED` or `MANUAL_REVIEW`) and emits a `GUARD_FALLBACK_TRIGGERED` event.

- **Semantic Model Capability Tiers:**
  - Manifests (`skill.yaml`) now support per-state `model` capability tier declarations (`tier: fast | balanced | reasoning | decision`) with optional `preferred_provider` and `cost_budget`.
  - Injects a structured `<model_contract>` into prompt slices to allow orchestrators or parent agents to route state turns to optimal model architectures (e.g., Claude Haiku vs Sonnet vs Opus, Gemini Flash vs Pro, Codex/o3).
  - Full backward compatibility: all tier declarations and judgment blocks are completely optional.

- **Developer Experience & Scaffolding:**
  - Updated `skill-manager` with model capability tier selection and semantic judgment verification questions in RED phase discovery.
  - Added runnable interactive demo `pnpm --filter @reactive-skills/runtime demo:judgment`.

## [0.6.0] - 2026-09-20

- docs: add project context and architecture documentation files (18e2a78)
- docs: add Reactive Skills Architecture overview to AGENTS.md (f064203)
- chore(release): v0.5.4 - -- (9b4c347)
- fix(axi): isolate jobs and default bootloaders to AXI (8264acc)
- feat(site): refactor hero to tactical workbench and fix simulation controls (40c340e)

## [0.5.4] - 2026-09-20

- fix(axi): isolate jobs and default bootloaders to AXI (8264acc)
- feat(site): refactor hero to tactical workbench and fix simulation controls (40c340e)
- fix(site): update api-contract mermaid chart syntax (a71334b)
- fix(site): add fallback Mermaid generation from skill states and restore tdd-refactor statechart (5fddc7e)
- docs: add customer-facing Syncing Skills guide and cross-references (cb6214d)

## [0.5.3] - 2026-09-18

- chore(release): v0.5.2 - Fix global skill workspace resolution, handle stale state, and add reactive_reset MCP tool (966c130)
- fix(axi,runtime): resolve workspace correctly for global skills, handle stale state, and add reactive_reset MCP tool (c527380)
- chore(release): v0.5.1 - Fix check-docs invariant: follow AGENTS.md reference to repository-map.md (2790cf8)
- feat: add context scoping with per-state scope and delta tracking (028d383)
- chore: groom AGENTS.md into terse references (c6f17da)

## [0.5.2] - 2026-09-17

- fix(axi,runtime): resolve workspace correctly for global skills, handle stale state, and add reactive_reset MCP tool (c527380)
- chore(release): v0.5.1 - Fix check-docs invariant: follow AGENTS.md reference to repository-map.md (2790cf8)
- feat: add context scoping with per-state scope and delta tracking (028d383)
- chore: groom AGENTS.md into terse references (c6f17da)
- refactor(docs): reorganize documentation and move performance standards to context (947975e)

## [0.5.2] - 2026-09-17

- fix(axi,runtime): resolve workspace correctly for global skills, handle stale state, and add reactive_reset MCP tool (c527380)
- chore(release): v0.5.1 - Fix check-docs invariant: follow AGENTS.md reference to repository-map.md (2790cf8)
- feat: add context scoping with per-state scope and delta tracking (028d383)
- chore: groom AGENTS.md into terse references (c6f17da)
- refactor(docs): reorganize documentation and move performance standards to context (947975e)

## [0.4.5] - 2026-09-14

- feat(sync): add Windows NTFS Directory Junction linking and POSIX symlink engine for zero-drift live skill sync
- feat(sync): support multi-source authoring discovery via ~/.agents/sources.json and --all-sources flag
- feat(sync): add tilde (~) path expansion and intelligent current-working-directory fallback for third-party authors
- feat(sync): add --link, --copy, and repeatable --source / --target CLI flags

## [0.4.2] - 2026-09-14

- feat(runtime): add in-engine telemetry, template caching, and performance budget verification (7dfae37)
- feat(telemetry): record real-time transition_duration_ms, slice_duration_ms, and slice_tokens_est in STATE_TRANSITION events
- feat(fsm): L1 Handlebars compiled template delegate cache for sub-millisecond prompt slicing
- feat(alarms): emit PERF_DEGRADATION event on slice (>10ms) or transition (>25ms) threshold breaches
- test(perf): add automated Vitest test suite enforcing P0 (<5ms) and P1 (<25ms) latency budgets

## [0.4.1] - 2026-09-14

- feat(runtime,axi): add mcp job tools, template jobId context, and flexible jobs cli arguments (2b31451)
- feat(mcp): add reactive_switch_job and reactive_archive_job tools with active job indicators
- feat(projections): expose jobId directly in ProjectionContext for Handlebars templates
- feat(axi): support bidirectional argument ordering in jobs command (jobs list <skill> and jobs <skill> list)
- docs: introduce PERFORMANCE-STANDARDS.md for P0-P3 latency budgets, caching tiers, and CRAP score limits

## [0.4.0] - 2026-09-14

- feat(axi): implement native validate command for skill manifest and statechart verification (3b75a21)
- docs: add v0.3.0 release highlights to READMEs and bundle changelog in package files (732f72b)
- chore: release v0.3.0 (ae379ca)
- feat(core): implement job management, isolated run storage, dual-write projections, and AXI jobs suite (c76c6cb)
- chore: release v0.2.0 (bb33cfc)

## [0.3.0] - 2026-09-13

- feat(core): implement job management, isolated run storage, dual-write projections, and AXI jobs suite (c76c6cb)

## [2.0.0] - 2026-09-01

- feat: implement SQLite event store engine, state snapshotting, and JSONL log rotation with supporting documentation (6912493)
- feat: implement skill-scoped SQLite event storage and migration infrastructure (b28fb19)
- feat: implement core event-store with SQLite persistence, FSM engine, and projection tracking. (5926118)
- feat: implement reactive skill core with FSM engine, event-sourced SQLite storage, and Zod-validated manifest schemas (b542c0a)
- feat: add CLI tool for reactive skill management, project documentation, and state inspection workflows (39830d0)

## [1.0.3] - 2026-08-31

- refactor(core): migrate to clean semantic state filenames and convention-over-configuration resolution (8180b1b)
- feat(hitl): add pre-implementation collaboration gate with 3 interaction modes (direct build, brainstorm, plan review) (0cd22b7)
- fix(core): resolve P2 memory leak - add bounded in-memory sliding buffer with SQLite backing (7fefae5)
- fix(core): resolve all Principal Engineer review findings - state rehydration, lifecycle signal queue, VM sandbox, and dual-write durability (791753e)
- feat(mcp): add reactive_migrate tool to MCP server suite (e35779c)

## [1.0.2] - 2026-08-31

- chore(release): add automated multi-file semver bumping script and changelog generator (d0f9abd)
- feat(docs): add automated doc invariant checker script and synchronize all project docs (280a95d)
- feat(core): upgrade to v2 with Event Modeling 4-slice CQRS, statechart topology validation, and retroactive migration (c9801ed)
- docs: clarify workspace layout, file destination paths, and greenfield/brownfield execution (1c79455)
- docs: add Model Context Protocol (MCP) server documentation to README, architecture, and AGENTS (f2e638b)
# Changelog

## [1.0.1] - 2026-08-31

- feat(docs): add automated doc invariant checker script and synchronize all project docs (280a95d)
- feat(core): upgrade to v2 with Event Modeling 4-slice CQRS, statechart topology validation, and retroactive migration (c9801ed)
- docs: clarify workspace layout, file destination paths, and greenfield/brownfield execution (1c79455)
- docs: add Model Context Protocol (MCP) server documentation to README, architecture, and AGENTS (f2e638b)
- feat(mcp): build universal reactive-mcp-server with 6 tools and live resources (9a01807)

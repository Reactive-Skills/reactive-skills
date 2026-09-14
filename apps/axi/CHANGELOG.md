
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

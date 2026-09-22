# Repository Map

## Runtime Core
- `packages/runtime/src/core/types.ts`: Zod schemas & TypeScript types for FSM, signals, and projections.
- `packages/runtime/src/core/event-store.ts`: Immutable append-only event ledger (JSONL + native SQLite driver).
- `packages/runtime/src/core/guard-evaluator.ts`: Sandbox evaluator for transition conditions.
- `packages/runtime/src/core/judgment-engine.ts`: Decoupled Ports-and-Adapters judgment engine with snap-on adapters and circuit breaking.
- `packages/runtime/src/core/runtime-capabilities.ts`: Runtime version, capability, compatibility, and transport selection contracts.
- `packages/runtime/src/core/projection-engine.ts`: Handlebars deliverable generator.
- `packages/runtime/src/core/fsm-engine.ts`: State machine loader, state path resolver & bubbling engine.
- `packages/runtime/src/core/runtime-hooks.ts`: In-harness interceptor hooks (onBeforeAgentTurn, onAfterToolExecution, onHumanResponse).
- `packages/runtime/src/core/legacy-adapter.ts`: Backward compatibility wrapper and converter for `SKILL.md`.
- `packages/runtime/src/core/migration.ts`: Retroactive project migrator and schema upgrader.
- `packages/runtime/src/core/job-manager.ts`: Run isolation, active pointer resolution & job metadata manager.

## MCP & Telemetry
- `packages/runtime/src/mcp/server.ts`: Stdio Model Context Protocol (MCP) server integration.
- `packages/runtime/src/telemetry/server.ts`: Real-time telemetry server and SSE event streamer.

## CLI & Tests
- `apps/axi/src/cli/index.ts`: AXI CLI entry point (`reactive-skills-axi`).
- `skills/`: Synthetic test and verification fixtures (`_test_fsm_skill`, `_test_hitl_skill`, `_test_hsm_skill`, `_test_legacy_skill`).
- `tests/`: Automated unit and integration test suites.

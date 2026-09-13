# @reactive-skills/runtime

Reactive Skills Architecture (RSA) core runtime - FSM engine, event store, guard evaluator, projection engine, and MCP server.

## Installation

```bash
npm install @reactive-skills/runtime
```

## Usage

```ts
import { FSMEngine, EventStore, LegacySkillAdapter, ProjectionEngine } from '@reactive-skills/runtime';
```

## Core Modules

- `FSMEngine` - Hierarchical State Machine loader, state path resolver, and signal-driven transition engine
- `EventStore` - Immutable append-only event ledger (JSONL + SQLite)
- `GuardEvaluator` - Sandbox evaluator for transition guard expressions
- `ProjectionEngine` - Handlebars deliverable generator for read-model projections
- `LegacySkillAdapter` - Backward compatibility wrapper and converter for SKILL.md
- `McpServer` - Stdio Model Context Protocol (MCP) server integration
- `TelemetryServer` - Real-time Server-Sent Events (SSE) broadcaster and Private Network Access (PNA) HTTP bridge

## Skill Manifest Schema

Reactive skills use `skill.yaml` with `schema_version: "2.0.0"`:

```yaml
schema_version: "2.0.0"
name: "my-skill"
description: "Skill description"
initial_state: "START"

context_keys:
  - "project_type"
  - "mission"

states:
  START:
    description: "Initial state"
    prompt_template: "states/start.md"
    on_enter:
      - set_context:
          active_phase: "start"
    transitions:
      DONE:
        target: "DONE"
        guard: "event.payload.completed === true"
```

## Integration Modes

The runtime has no dependency on any specific integration mode:

1. **Direct API** - Import and use `FSMEngine` directly in your application
2. **MCP stdio** - Use the `McpServer` class to expose tools over stdio
3. **Legacy hooks (removed)** - `runtime-hooks.ts` was removed in v2.0. Use `on_enter`/`on_exit` lifecycle hooks and explicit `engine.handleSignal()` calls instead

## Event Store

Dual-mode event sourcing:

1. **JSONL** (`.reactive/skills/<skill>/events.jsonl`) - Human-readable append-only log
2. **SQLite** (`.reactive/skills/<skill>/events.db`) - Indexed relational database

## License

MIT


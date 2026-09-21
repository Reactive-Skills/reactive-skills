# @reactive-skills/runtime

Reactive Skills Architecture (RSA) core runtime — FSM engine, event store, guard evaluator, projection engine, job manager, and MCP server.

> 🚀 **What's New in v0.7.0:** Decoupled Judgment Engine & Snap-on Adapters (Jev/Script), Circuit Breaker Fallback Routing, and Semantic Model Capability Tiers. [Read Full Release Notes →](https://github.com/Reactive-Skills/reactive-skills/releases/tag/v0.7.0) · [View Changelog](https://github.com/Reactive-Skills/reactive-skills/blob/main/CHANGELOG.md)

## Installation

```bash
npm install @reactive-skills/runtime
```

## Usage

```ts
import { FSMEngine, EventStore, JobManager, LegacySkillAdapter, ProjectionEngine } from '@reactive-skills/runtime';
```

## Core Modules

- `FSMEngine` - Hierarchical State Machine loader, state path resolver, and signal-driven transition engine
- `JobManager` - Run isolation, active pointer resolution, metadata management, and safe directory pathing
- `EventStore` - Immutable append-only event ledger (JSONL + SQLite)
- `GuardEvaluator` - Sandbox evaluator for transition guard expressions
- `ProjectionEngine` - Handlebars deliverable generator for read-model projections with dual-write archiving
- `LegacySkillAdapter` - Backward compatibility wrapper and converter for SKILL.md
- `McpServer` - Stdio Model Context Protocol (MCP) server integration
- `SyncEngine` - Skill synchronization engine managing zero-drift directory junctions and physical mirroring across agent satellites
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

## Context Scoping (Optional)

For hierarchical skills with many substates, you can declare `context_scope` on individual states to limit the context variables passed into that state's prompt. This reduces token cost when revisiting states and enables delta-aware prompt delivery.

```yaml
context_keys:
  - mission
  - glossary
  - slices
  - depth_tree
  - active_leaf
  - execution_log

states:
  ENTRY:
    prompt_template: states/entry.md
    context_scope:
      - mission          # Only pass `mission` and internal keys to this state's prompt
    transitions:
      PROCEED: WORK
  WORK:
    initial_substate: TASK_A
    substates:
      TASK_A:
        prompt_template: states/task_a.md
        context_scope:
          - slices
          - depth_tree     # Only pass `slices` and `depth_tree` to TASK_A
        transitions:
          GOTO_B: WORK.TASK_B
      TASK_B:
        prompt_template: states/task_b.md
        context_scope:
          - active_leaf
          - execution_log
```

**Rules:**
- `context_scope` is optional. States without it receive the full context (backward compatible).
- Only keys declared in `context_keys` are eligible for scoping.
- Internal keys (prefixed with `_`) are always included regardless of scope.
- When a state is visited more than once, the prompt slice includes a `<context_delta>` block showing which scoped keys changed since the previous visit.
- The MCP `reactive_state` response includes `scopedContext`, `contextDelta`, and `visitCount` fields for client-side consumption.

## Integration Modes

The runtime has no dependency on any specific integration mode:

1. **Direct API** - Import and use `FSMEngine` directly in your application
2. **MCP stdio** - Use the `McpServer` class to expose tools over stdio
3. **Legacy hooks (removed)** - `runtime-hooks.ts` was removed in v2.0. Use `on_enter`/`on_exit` lifecycle hooks and explicit `engine.handleSignal()` calls instead

## Event Store

Dual-mode event sourcing:

1. **JSONL** (`.reactive/skills/<skill>/events.jsonl`) - Human-readable append-only log
2. **SQLite** (`.reactive/skills/<skill>/events.db`) - Indexed relational database

## Job & Run Management

The runtime isolates execution runs through `JobManager`:

```ts
import { JobManager, FSMEngine } from '@reactive-skills/runtime';

// 1. Manage isolated runs:
const jobManager = new JobManager();
jobManager.createJob('my-skill', { id: 'sprint-1', name: 'Sprint 1 Run', setActive: true });

// 2. Instantiate engine targeted to a specific run:
const engine = new FSMEngine({
  skillDir: './skills/my-skill',
  jobId: 'sprint-1',
});

// Deliverables automatically mirror to .docs/my-skill/jobs/sprint-1/ and canonical .docs/
```

## Performance & Telemetry

The runtime captures execution telemetry and token estimates with zero latency penalty:

```ts
// 1. In-turn prompt slice telemetry:
const slice = engine.generatePromptSlice();
console.log(slice.metrics);
// => { slice_duration_ms: 0.23, slice_tokens_est: 282, allowed_tools_count: 4 }

// 2. State transition telemetry:
const res = await engine.handleSignal('TEST_RAN', { exit_code: 0 });
console.log(res.metrics);
// => { transition_duration_ms: 1.05, slice_duration_ms: 0.23, slice_tokens_est: 282 }
```

See [PERFORMANCE-STANDARDS.md](../../PERFORMANCE-STANDARDS.md) for full latency budgets and caching architecture.

## License

MIT



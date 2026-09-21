# @reactive-skills/runtime

Reactive Skills Architecture (RSA) core runtime — FSM engine, event store, guard evaluator, projection engine, job manager, and MCP server.

> 🚀 **What's New in v0.8.5: automatic telemetry broker port fallback** [Read Full Release Notes](https://github.com/Reactive-Skills/reactive-skills/releases/tag/v0.8.5) · [View Changelog](https://github.com/Reactive-Skills/reactive-skills/blob/main/CHANGELOG.md)

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
- `TelemetryBroker` - Read-only multi-skill, multi-job catalog, state, and multiplexed SSE broker

### Job-Scoped Live Telemetry

Start a viewer for one job without changing the active job pointer:

```bash
npx -y @reactive-skills/axi view my-skill --job sprint-1
```

The viewer reports the selected job ID through CLI output, `/health`, `/state`, and the SSE connection metadata.

The telemetry server combines in-process event notifications with a configurable SQLite tailer.

This lets events written by separate CLI, MCP, or worker processes reach the existing SSE stream.

Omit `--job` to preserve existing resolution through `REACTIVE_JOB_ID`, the active pointer, and the default job.

### Multi-Job Telemetry Broker

`TelemetryBroker` reads the current workspace's `.reactive/skills` catalog and opens SQLite-backed readers for discovered jobs.

It exposes `GET /catalog`, job-scoped `GET /state`, and one filtered `GET /events` SSE stream.

The broker preserves each job's local sequence numbers and includes skill and job identity in every event envelope.

It refreshes the catalog on a bounded interval so new jobs appear without a process restart.

It polls SQLite so events written by separate CLI, MCP, and worker processes reach connected clients.

The broker is intentionally read-only and does not dispatch signals or mutate the active-job pointer.

The existing `TelemetryServer` remains the compatibility path for `view` and its single-job `/health`, `/state`, `/events`, `/events/history`, and `/signal` behavior.

### Automatic Telemetry Port Selection

When `--port` is omitted, the standalone viewer and multi-job broker make real HTTP bind attempts starting at `127.0.0.1:4242`.

If the preferred port is occupied, the runtime tries the next available port through a bounded deterministic fallback range.

Use `--port <number>` to bind only to an explicit port, or use `--port 0` to preserve OS-assigned ephemeral port selection.

The selected port and URL are reported by the CLI, `/health`, `/state`, and the SSE `connected` event.

The browser viewer does not scan local ports automatically, so clients should use the URL reported by AXI.

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

- **Terminal Auto-Rotation:** AXI `state` and MCP `reactive_state` queries without an explicit job ID automatically archive completed runs and rotate to a fresh job ID. Generic `FSMEngine` construction remains side-effect-free unless `autoRotateTerminal: true` is requested.
- **Environment Isolation (`REACTIVE_JOB_ID`):** Parallel subagents set `process.env.REACTIVE_JOB_ID = 'worker-1'` to run without mutating the shared filesystem active pointer.

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



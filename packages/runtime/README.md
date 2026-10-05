# @reactive-skills/runtime

Reactive Skills Architecture (RSA) core runtime — FSM engine, event store, guard evaluator, projection engine, job manager, and MCP server.

> 🚀 **What's New in v0.18.0:**
> - Gates no model can judge record `APPROVAL_REQUESTED` and wait for a person; decisions are validated by causation and recorded with `decidedBy`.
> - Self-reported decisions need an operator grant stored in the user's home folder, and guards return refusal reasons.
> - Breaking: an engine refuses signals once another process writes to its run; use `hasExternalChanges()` and `reopen()` for long-lived engines.
>
> [Read Full Release Notes](https://github.com/Reactive-Skills/reactive-skills/releases/tag/v0.18.0) · [View Changelog](https://github.com/Reactive-Skills/reactive-skills/blob/main/CHANGELOG.md)

## Installation

```bash
npm install @reactive-skills/runtime
```

## Usage

```ts
import { FSMEngine, EventStore, JobManager, LegacySkillAdapter, ProjectionEngine } from '@reactive-skills/runtime';
```

### Semantic Judgment Adapter

`JevJudgmentAdapter` uses the production `@typesafe-ai/sdk` package and calls TypeSafe AI's System One API directly.
It never invokes `jev-axi`, starts a shell, or writes a temporary state file.

Configure `TYPESAFE_API_KEY` when semantic judgments are needed:

```bash
npm install @reactive-skills/runtime
```

The adapter supports predicate, categorical, and ordered score judgments.
Score judgments accept an array such as `rubric: ["weak", "acceptable", "strong"]`, or a string separated by `|`.
A criterion written as a JavaScript expression always runs in the Script adapter.
With the key set, a failed or rejected Jev request refuses the signal for a natural-language criterion, and the run stays in its state (ADR 0011).
When Jev rejects its credentials or a judgment is misconfigured, the refusal says that retrying will not help.

### Approval for Gates No Model Can Judge

A natural-language criterion that no model can judge refuses the signal and waits for a person (ADR 0012).
That happens when no model is configured, during a model outage, and when Jev rejects its key.
The runtime records an `APPROVAL_REQUESTED` event, and the refusal reason tells the agent to stop and ask the user to run `reactive-skills-axi approve <skill> --job <id>` in their own terminal.

`approve` runs only in an interactive terminal.
It shows each waiting gate with the agent's payload and asks the user to type back a one-time code.
The code approves the gate, and typing `reject` rejects it; any other answer asks again.
The runtime records `APPROVAL_DECIDED` and re-sends the original signal.
An approval passes the judgment with `decidedBy: "human"`, and a rejection routes to `fallback_target` or refuses.
Each decision applies once, to the same state and signal.
MCP has no tool that approves a gate.

An engine refuses `handleSignal` and `decideApproval` with `RUN_VERSION_CONFLICT` when another process wrote to its run after the engine loaded it, so it never acts on a state the run already left.
Code that keeps an engine open for a long time checks `engine.hasExternalChanges()` and switches to `engine.reopen()`, as the MCP server and the `view` dashboard do.

Within one OS account this channel stops an agent from approving by accident.
It does not stop an agent that drives a terminal session, for example through an MCP server that provides one, or that calls the runtime library directly.
An agent that writes into your home folder can still create a grant.

### Self-Reported Decisions

Self-reported decisions let the signal payload decide natural-language criteria when no model is configured.
They are off by default, and only the user can turn them on, by running `reactive-skills-axi approve <skill> --allow-self-reported` in an interactive terminal and typing back the code.
The grant applies to the whole workspace and is stored in your home folder at `~/.reactive-skills/grants/`, keyed by the workspace path, never in the workspace.
A file copied, committed, or restored into a workspace does not count, so a revoke stays revoked.
The runtime records the first decision each grant allows in a run as `SELF_REPORT_GRANT_USED`.
A grant applies only to processes that use the same home folder, so a runtime in a container or under another account does not see it.
`reactive-skills-axi approve <skill> --revoke-self-reported` removes it.

Every self-reported transition reports `judgment_basis: self_reported` with a warning in the emit output.
A grant never applies during an outage of a configured model, so a broken Jev setup still waits for a person.
Every judgment result records `decidedBy` as `model`, `expression`, `human`, or `self_reported` in `GUARD_EVALUATED`.

### Guard Refusal Reasons

A refused guard returns a reason, so the agent can see what to fix.
A guard function may return `{ passed, reason }` instead of a boolean, and a falsy `passed` refuses with `reason`.
An inline guard may declare `guard_message`, which is returned when it refuses.
Without a message, the refusal names the guard expression or the guard function file.

```yaml
transitions:
  USER_APPROVED:
    target: DEVELOP
    guard: "payload.dod_record?.criteria?.length > 0"
    guard_message: "Send dod_record with at least one criterion."
```

### Judgment Thresholds

`min_probability` states the probability a judgment needs.
For predicates it is compared directly with P(yes).
For categorical judgments it is compared with the picked label's probability, and the label must be one of `options`.
A predicate `min_probability` must be at least `0.5`, and `evaluation` judgments do not support it.

An optional `escalate` band routes grey-zone results to a review state.
A result at or above `escalate.min_probability` and below `min_probability` moves to `escalate.target`.
Lower results move to `fallback_target`, or the transition is refused when no `fallback_target` is declared.

```yaml
runtime_requirements:
  required_capabilities: [judgment.probability_thresholds]

states:
  REVIEW:
    transitions:
      REVIEW_SUBMITTED:
        target: MERGE
        judgment:
          type: predicate
          criterion: "Does the diff satisfy every approved acceptance criterion?"
          min_probability: 0.85
          escalate:
            min_probability: 0.3
            target: HUMAN_REVIEW
          fallback_target: REVISE
```

`min_confidence` keeps its meaning.
For predicates the runtime reports confidence as `|P(yes) - 0.5| * 2`, so `min_confidence: m` requires `P(yes) >= 0.5 + m / 2`.
For categorical judgments `min_confidence` is compared with the adapter's own confidence score.
A judgment sets `min_probability` or `min_confidence`, not both, and a judgment with neither uses `min_confidence: 0.75`.

| `min_confidence` | Required P(yes) | Equivalent `min_probability` |
| --- | --- | --- |
| 0.6 | 0.80 | 0.8 |
| 0.7 | 0.85 | 0.85 |
| 0.75 (default) | 0.875 | 0.875 |
| 0.85 | 0.925 | 0.925 |
| 0.9 | 0.95 | 0.95 |

Runtimes without the `judgment.probability_thresholds` capability drop `min_probability` and `escalate` and apply `min_confidence: 0.75`.
Require the capability before migrating a skill so older runtimes refuse it instead of silently changing its gates.
`GUARD_EVALUATED` records the judgment's `probability`, `threshold`, and `band` (`accept`, `escalate`, or `reject`), and `GUARD_FALLBACK_TRIGGERED` records the `band`.
`reactive-skills-axi validate` warns on semantic judgments that still rely on `min_confidence` and reports drift between `guards/*.yaml` contracts and the `skill.yaml` judgments the runtime enforces.

## Core Modules

- `FSMEngine` - Hierarchical State Machine loader, state path resolver, and signal-driven transition engine
- `JobManager` - Run isolation, active pointer resolution, metadata management, and safe directory pathing
- `EventStore` - Immutable append-only event ledger (JSONL + SQLite)
- `GuardEvaluator` - Sandbox evaluator for transition guard expressions
- `ContextRouter` - Jev-backed skill and context selection before prompt assembly
- `ProjectionEngine` - Handlebars deliverable generator for read-model projections with dual-write archiving
- `LegacySkillAdapter` - Backward compatibility wrapper and converter for SKILL.md
- `McpServer` - Stdio Model Context Protocol (MCP) server integration
- `SyncEngine` - Copies ordered skill sources into a physical central directory, then updates linked or physical agent satellites
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

`TelemetryBroker` reads the current workspace's `.reactive/skills` catalog and opens run-scoped readers over each skill's shared SQLite ledger.

It exposes `GET /catalog`, job-scoped `GET /state`, and one filtered `GET /events` SSE stream.

The broker preserves each run's local sequence numbers and includes skill and run identity in every event envelope.

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

## Signal Context

A signal can update context through `contextUpdates` in its payload and through payload fields named in `context_keys`.
Guards and judgments read the stored context plus the signal's `context_keys` fields.
Guards read the signal's pending `contextUpdates` through `payload.contextUpdates`, and Jev judgments receive the payload as `event`.
A guard that compares old and new values, such as `payload.contextUpdates.version === context.version + 1`, therefore sees the stored value in `context`.
The signal's updates become context only when its transition commits.
A refused or unhandled signal stays in the event ledger but leaves context unchanged, both in the running engine and when a later process rehydrates the run.
A possible follow-up is an opt-in guard variable holding the merged copy, which would leave `context` unchanged for existing guards.

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

Skill-scoped event sourcing:

1. **SQLite** (`.reactive/skills/<skill>/events.db`) - Canonical indexed relational event ledger
2. **JSONL** (`.reactive/skills/<skill>/events.jsonl`) - Recoverable human-readable export

Run metadata and filesystem isolation:

- `.reactive/skills/<skill>/runs/<run-id>/job.json`
- `.reactive/skills/<skill>/runs/<run-id>/artifacts/`
- `.reactive/skills/<skill>/runs/<run-id>/logs/`

Run names are mutable display aliases.

`run_id` is an immutable generated UUIDv7-style identifier.

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

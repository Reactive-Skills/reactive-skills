# ⚡ Reactive Skills Architecture (RSA)

> **Event-Driven Hierarchical State Machine Engine and Immutable Event Store for Agentic Skills**

[![CI](https://github.com/Reactive-Skills/reactive-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/Reactive-Skills/reactive-skills/actions/workflows/ci.yml)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![npm version](https://img.shields.io/npm/v/@reactive-skills/axi.svg)](https://www.npmjs.com/package/@reactive-skills/axi)
[![Release Notes](https://img.shields.io/github/v/release/Reactive-Skills/reactive-skills?label=release%20notes)](https://github.com/Reactive-Skills/reactive-skills/releases/tag/v0.4.2)

---

> 🚀 **What's New in v0.4.2:**
> - **In-Engine Telemetry & Zero I/O Metrics:** Automatic capture of `transition_duration_ms`, `slice_duration_ms`, and `slice_tokens_est` directly inside `STATE_TRANSITION` event payloads.
> - **L1 Handlebars Template Caching:** Pre-compiled template delegate caching reduces active prompt slice latency to sub-millisecond execution.
> - **Performance Degradation Alarms:** Automated `PERF_DEGRADATION` events emitted to the event store if prompt slicing (>10ms) or state transitions (>25ms) breach latency budgets.
> - **Automated Performance Budget Suite:** Vitest test suite enforcing P0 (<5ms) and P1 (<25ms) latency tiers in continuous integration.
> 
> [Read Full Release Notes →](https://github.com/Reactive-Skills/reactive-skills/releases/tag/v0.4.2) · [View Changelog](CHANGELOG.md)

---

## 🌟 What is Reactive Skills?

Conventional agent skills are static markdown instruction files (`SKILL.md`). An LLM reads all instructions upfront, enters an unstructured execution loop, and guesses its next steps without state verification or deterministic progress guarantees.

**Reactive Skills** upgrade passive agent skills into **Hierarchical State Machines (HSM)** driven by a reactive **Event/Signal Bus**:

1. **Just-In-Time Prompt Slices:** Only the prompt, constraints, and tool whitelists for the *active state* are loaded into the LLM turn (~70% token reduction).
2. **Signal-Driven Ingress:** Transitions are triggered by typed runtime signals (`REQUIREMENTS_GATHERED`, `TESTS_PASSED`, `USER_APPROVED`).
3. **Deterministic Guard Gates:** Progress requires deterministic programmatic invariants to evaluate `true` (preventing hallucinated completion).
4. **Event Sourcing & Live Deliverables:** Every transition is recorded to an append-only ledger (`events.jsonl` + SQLite `events.db`). Documentation, PR bodies, and review matrices are live read-model projections rendered from the event stream.

---

## 📦 Packages

This repository is a monorepo containing:

- **`@reactive-skills/runtime`**: The core TypeScript statechart engine, SQLite event store driver, guard evaluator, and stdio MCP server.
- **`@reactive-skills/axi`**: The Agent Experience Interface (AXI) CLI (`reactive-skills-axi`) providing human- and agent-ergonomic state inspection and signal dispatch in TOON format.

---

## 🚀 Quickstart

### 1. Execution Options

You can execute commands on-demand via **`npx`** (zero installation required) or install the CLI globally:

```bash
# Zero install — works immediately for any agent or shell:
npx -y @reactive-skills/axi state <skill-name>
npx -y @reactive-skills/axi emit <skill-name> <signal-name>

# Optional: Install globally for instant local commands (`reactive-skills-axi` or `axi`):
npm install -g @reactive-skills/axi
```

### 2. Inspect a Skill's Current State

```bash
npx -y @reactive-skills/axi state <skill-name>
```

Outputs the current state, active prompt instructions, allowed tools, and available transitions in structured format:

```yaml
state:
  skill_id: my-skill
  current_state: STEP_ONE
prompt:
  raw_prompt: "# State: Processing Step One ..."
  allowed_tools: "view_file,grep_search,find_by_name,ask_question"
help[2]:
  Read the state prompt above and execute the instructed tasks
  Run `npx -y @reactive-skills/axi emit <skill> <signal>` to advance
```

### 3. Emit a Signal to Advance

```bash
npx -y @reactive-skills/axi emit <skill-name> <signal-name> [--payload '{"exit_code":0}']
```

The state machine evaluates transition guards, appends to the immutable event ledger, updates deliverables, and outputs the next state instructions.

---

## 🔌 Integration Modes

Reactive skills can be driven through two primary integration paths:

1. **AXI CLI (Universal Shell Mode):** Any agent capable of running terminal commands can drive the skill using `npx -y @reactive-skills/axi state <skill>` (or `reactive-skills-axi state <skill>`) and `npx -y @reactive-skills/axi emit <skill> <signal>`.
2. **MCP Server (Model Context Protocol):** Exposes `reactive_state` and `reactive_emit_signal` tools over stdio for Claude Desktop, Antigravity, Cursor, and any MCP-compatible harness:
   ```bash
   npx -y @reactive-skills/axi mcp
   ```

---

## 🛠️ CLI Reference

> **Note:** Commands below are shown using the zero-install `npx -y @reactive-skills/axi` prefix. If installed globally (`npm install -g @reactive-skills/axi`), you can substitute `reactive-skills-axi` or `axi`.

| Command | Usage | Description |
| :--- | :--- | :--- |
| `state` | `npx -y @reactive-skills/axi state <skill>` | Display current active state, unabridged prompt slice, and allowed tools |
| `emit` | `npx -y @reactive-skills/axi emit <skill> <signal>` | Emit a signal to evaluate guards and advance to the next state |
| `invoke` | `npx -y @reactive-skills/axi invoke <skill> [--payload JSON]` | Initialize and start a skill run |
| `events` | `npx -y @reactive-skills/axi events <skill> [limit]` | Tail recent events from the append-only event store |
| `inspect` | `npx -y @reactive-skills/axi inspect <skill>` | Print statechart topology, substates, and guard rules |
| `validate` | `npx -y @reactive-skills/axi validate [path]` | Validate skill manifest, prompt templates, transition targets, and bootloader |
| `init` | `npx -y @reactive-skills/axi init <name>` | Scaffold a new modular reactive skill package |
| `reset` | `npx -y @reactive-skills/axi reset <skill>` | Clear execution run state while preserving deliverables |
| `jobs` | `npx -y @reactive-skills/axi jobs <skill> [list\|switch\|archive]` | Inspect, switch, and archive isolated execution runs and deliverables |
| `view` | `npx -y @reactive-skills/axi view <skill>` | Launch real-time telemetry server and live visual statechart viewer |

---

## 🛠️ Authoring Reactive Skills

Avoid manually hand-authoring reactive skill packages from scratch. A reactive skill binds together statechart topology (`skill.yaml`), individual state prompt templates (`states/*.md`), deterministic guards (`guards/`), projection deliverables (`templates/*.hbs`), and strict execution bootloaders. Hand-authoring these files easily introduces syntax drift, broken transitions, or missing guards.

### Recommended: Use the `skill-manager` Skill

The canonical method to scaffold, modify, and migrate reactive skills is the **`skill-manager`** agent skill.

Instead of writing YAML manifests manually, ask your AI agent:

```text
"Use skill-manager to create a reactive skill named my-feature-workflow"
```

The `skill-manager` skill validates schemas, coordinates state prompts with strict execution invariants, and handles lifecycle operations (CREATE, UPDATE, MIGRATE_LEGACY, MIGRATE_REACTIVE).

### Visual Statecharts with `STATECHART.md`

`skill-manager` supports and generates a `STATECHART.md` alongside `skill.yaml`. This document contains a Mermaid `stateDiagram-v2` visualization of the entire state machine:

```mermaid
stateDiagram-v2
    [*] --> INIT
    INIT --> START : RUNTIME_READY
    INIT --> SETUP_MCP : SETUP_REQUIRED
    SETUP_MCP --> START : SETUP_COMPLETE [exit_code == 0]
    SETUP_MCP --> ERROR : SETUP_FAILED [exit_code != 0]
    START --> DONE : DONE
    DONE --> [*]
```

- **Visual-first design:** You can sketch a proposed state machine using a Mermaid `stateDiagram-v2` block in `STATECHART.md`, and `skill-manager` will parse it into the corresponding `skill.yaml` and state templates.
- **Continuous synchronization:** When modifying a skill's states or transitions, `skill-manager` updates both `skill.yaml` and `STATECHART.md` to keep documentation and runtime contracts identical.

### Terminal Scaffolding (`init`)

For quick command-line scaffolding, you can also use the AXI CLI:

```bash
npx -y @reactive-skills/axi init <skill-name>
```

This scaffolds the modular file layout in `skills/<skill-name>/`:

```text
skills/<skill-name>/
├── skill.yaml            # Statechart manifest (states, transitions, guards)
├── STATECHART.md         # Visual Mermaid statechart diagram
├── SKILL.md              # Skill entry point with reactive bootloader
├── states/               # State-specific markdown prompt templates
│   ├── init.md
│   ├── setup_mcp.md
│   ├── start.md
│   ├── done.md
│   └── bypass_detected.md
└── skill-release.json    # Release and schema metadata
```

---

## 🗂️ Job & Run Isolation (Multi-Run Management)

RSA provides multi-run isolation, allowing teams and autonomous agents to execute multiple independent runs of the same skill without event log pollution or deliverable overwrites.

### Storage Architecture

- **Isolated Event Ledgers:** Each run maintains its own scoped event ledger under `.reactive/skills/<skill>/jobs/<job-id>/` with independent `events.jsonl` and SQLite `events.db` stores.
- **Active Job Pointer:** The active run pointer is tracked at `.reactive/skills/<skill>/active_job` (defaults to `default`). All CLI commands and MCP operations target the active run unless explicitly overridden.
- **Dual-Write Deliverable Mirroring:** Projections write to `.docs/<skill>/jobs/<job-id>/` for permanent archival, and automatically mirror to the canonical `.docs/` path for the active job.
- **Template Context:** Handlebars templates receive `jobId` directly inside `ProjectionContext`, enabling deliverables to reference their run ID.

### CLI Run Management

```bash
# List all execution runs for a skill (active job highlighted)
npx -y @reactive-skills/axi jobs <skill> list
# (or bidirectional syntax: npx -y @reactive-skills/axi jobs list <skill>)

# Switch the active execution run
npx -y @reactive-skills/axi jobs <skill> switch <job-id>

# Archive a completed run
npx -y @reactive-skills/axi jobs <skill> archive <job-id>

# Target a specific job explicitly without switching active pointer
npx -y @reactive-skills/axi state <skill> --job <job-id>
npx -y @reactive-skills/axi emit <skill> <signal> --job <job-id>
```

### Model Context Protocol (MCP) Tools

When interacting with agents over MCP, job operations are exposed as native tools:
- `reactive_list_jobs`: Lists all runs for a skill with state and active indicators.
- `reactive_switch_job`: Switches the active job pointer.
- `reactive_archive_job`: Marks a job run as archived.

---

## 📊 Telemetry & Performance Metrics

RSA provides real-time performance instrumentation and token economy tracking with zero runtime latency tax.

### Inspecting Metrics from the Event Ledger

Every state transition records execution telemetry inside `.reactive/skills/<skill>/events.jsonl`:

```json
{
  "type": "STATE_TRANSITION",
  "payload": {
    "from": "RED_SPEC",
    "to": "GREEN_CODE",
    "metrics": {
      "transition_duration_ms": 1.151,
      "slice_duration_ms": 0.922,
      "slice_tokens_est": 282
    }
  }
}
```

Tail latest transition metrics from your terminal:

```bash
# PowerShell
Get-Content .reactive/skills/<skill>/events.jsonl | ConvertFrom-Json | Where-Object { $_.type -eq "STATE_TRANSITION" } | Select-Object -ExpandProperty payload | Select-Object from, to, metrics

# SQLite
sqlite3 .reactive/skills/<skill>/events.db "SELECT seq, json_extract(payload, '$.metrics') FROM events WHERE type = 'STATE_TRANSITION';"
```

### Real-Time Telemetry Dashboard

Launch the live telemetry dashboard and SSE event stream:

```bash
npx -y @reactive-skills/axi view <skill-name>
```

For performance tiers, algorithmic budgets, and caching standards, see [PERFORMANCE-STANDARDS.md](PERFORMANCE-STANDARDS.md).

---

## 📜 License

The core Reactive Skills framework (`@reactive-skills/runtime` and `@reactive-skills/axi`) is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See [LICENSE](LICENSE) for details.

Reactive skills created using the Reactive Skills Architecture (e.g. in community skill repositories or third-party agents) may be licensed independently under permissive licenses such as MIT.


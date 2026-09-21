# Architecture: Reactive Skills Architecture (RSA)

---

## 1. Technology Stack

| Concern | Technology |
|---|---|
| Language & Runtime | TypeScript (ES2022 / NodeNext modules), Node.js ≥ 22.5 |
| Schema Validation | Zod v3.23+ |
| Manifest Parsing | js-yaml v4.1+ |
| Deliverable Projections | Handlebars v4.7+ |
| Sandbox Guard Evaluation | `node:vm` (`vm.createContext`, 100ms timeout) |
| Testing & Verification | Vitest v3.0+, tsx |
| Visual Review | Lavish Editor (Tailwind CSS v4 + DaisyUI v5) |
| Marketing Site | Next.js (`apps/site/`) |

---

## 2. Monorepo Structure

The repository is an **Nx-managed pnpm workspace**. Core packages live under `packages/`; user-facing apps live under `apps/`.

```
reactive-skills/                          # Repo root
├── packages/
│   └── runtime/                          # @reactive-skills/runtime (core engine)
│       ├── src/
│       │   ├── index.ts                  # Public API re-exports
│       │   ├── core/
│       │   │   ├── types.ts              # Zod schemas & TypeScript interfaces
│       │   │   ├── event-store.ts        # Append-only JSONL + SQLite event ledger
│       │   │   ├── guard-evaluator.ts    # node:vm sandbox invariant evaluator
│       │   │   ├── judgment-engine.ts    # Decoupled snap-on judgment engine & circuit breaker
│       │   │   ├── projection-engine.ts  # Handlebars deliverable generator
│       │   │   ├── fsm-engine.ts         # HSM loader, path resolver & bubbling engine
│       │   │   ├── runtime-hooks.ts      # Pre/post-turn in-harness interceptor hooks
│       │   │   ├── legacy-adapter.ts     # Backward compatibility wrapper for SKILL.md
│       │   │   ├── migration.ts          # Retroactive project migrator & schema upgrader
│       │   │   └── job-manager.ts        # Run isolation, active pointer & job metadata
│       │   ├── mcp/
│       │   │   └── server.ts             # Stdio MCP server (reactive-skills-mcp binary)
│       │   ├── telemetry/
│       │   │   ├── server.ts             # Real-time SSE telemetry server
│       │   │   ├── dashboard.ts          # Terminal dashboard renderer
│       │   │   └── types.ts              # Telemetry event types
│       │   ├── sync/
│       │   │   ├── engine.ts             # Workspace sync engine
│       │   │   ├── cli.ts                # Sync CLI entry (reactive-skills-sync binary)
│       │   │   └── types.ts              # Sync types
│       │   └── cli/
│       │       ├── index.ts              # AXI CLI runner (legacy, dev mode)
│       │       └── dev.ts                # reactive-skills-dev binary
│       ├── skills/                       # Synthetic test & verification fixtures
│       │   ├── _test_fsm_skill/          # Generic FSM / HSM fixture with bubbling
│       │   ├── _test_hitl_skill/         # Human-in-the-loop gate fixture
│       │   ├── _test_hsm_skill/          # Hierarchical substate bubbling fixture
│       │   └── _test_legacy_skill/       # Legacy SKILL.md migration fixture
│       ├── examples/
│       │   └── simulate-tdd.ts           # End-to-end execution simulation (pnpm demo)
│       └── tests/                        # Automated Vitest test suites
│           ├── fsm-engine.test.ts
│           ├── fsm-context-scoping.test.ts
│           ├── fsm-rehydration-hardening.test.ts
│           ├── hsm-bubbling.test.ts
│           ├── hitl-gates.test.ts
│           ├── sqlite-event-store.test.ts
│           ├── legacy-adapter.test.ts
│           ├── migration.test.ts
│           ├── job-domain.test.ts
│           ├── job-engine-projections.test.ts
│           ├── job-storage.test.ts
│           ├── mcp-server.test.ts
│           ├── perf-budget.test.ts
│           ├── strict-execution.test.ts
│           ├── telemetry.test.ts
│           ├── rel02-signal-queue-cycle.test.ts
│           ├── public-prose-quality-gate.test.ts
│           └── sync/
├── apps/
│   ├── axi/                              # @reactive-skills/axi — user-facing CLI
│   │   └── src/
│   │       ├── commands/
│   │       │   ├── state.ts              # axi state   — show current FSM state
│   │       │   ├── emit.ts               # axi emit    — emit a signal
│   │       │   ├── events.ts             # axi events  — tail event log
│   │       │   ├── inspect.ts            # axi inspect — full skill inspection
│   │       │   ├── invoke.ts             # axi invoke  — invoke a skill
│   │       │   ├── init.ts               # axi init    — scaffold a new skill
│   │       │   ├── setup.ts              # axi setup   — configure workspace
│   │       │   ├── upgrade.ts            # axi upgrade — migrate legacy SKILL.md
│   │       │   ├── reset.ts              # axi reset   — reset FSM to initial state
│   │       │   ├── jobs.ts               # axi jobs    — manage job isolation
│   │       │   ├── validate.ts           # axi validate — lint skill manifest
│   │       │   ├── view.ts               # axi view    — open Lavish visual review
│   │       │   ├── sync.ts               # axi sync    — workspace sync
│   │       │   ├── home.ts               # axi         — dashboard home
│   │       │   └── rebuild-sqlite.ts     # axi rebuild-sqlite — replay JSONL → SQLite
│   │       └── cli/                      # CLI entry point & bootloader
│   └── site/                             # Next.js marketing & documentation site
├── context/                              # Six-File Context domain documentation
├── .agents/                              # Agent operational guides & references
├── .reactive/                            # Runtime skill state (workspace-local, gitignored)
└── skills/                               # (Root-level alias; canonical fixtures live in packages/runtime/skills/)
```

---

## 3. Data Storage & Event Sourcing Model

All state changes and execution data are modeled as immutable, causal events. **Never mutate or delete historical events** — the store is strictly append-only.

```json
{
  "id": "uuid-v4",
  "seq": 4,
  "timestamp": "2026-08-31T06:30:19Z",
  "type": "STATE_TRANSITION",
  "payload": {
    "from": "RED_SPEC",
    "to": "GREEN_CODE",
    "signal": "TEST_RAN",
    "metrics": {
      "transition_duration_ms": 1.151,
      "slice_duration_ms": 0.922,
      "slice_tokens_est": 282
    }
  },
  "causationId": "parent-signal-uuid",
  "state": "GREEN_CODE"
}
```

### Dual Storage Drivers

1. **Streaming JSONL (`.reactive/skills/<skill>/events.jsonl`):** Append-only newline-delimited JSON for CLI inspection, tailing, and human auditability. Rotates at 10 MB into numbered archive segments.
2. **Relational SQLite Driver (`.reactive/skills/<skill>/events.db`):** Native `node:sqlite` providing:
   - `events` table indexed by `seq`, `type`, and `state`.
   - `projections` table for caching live deliverable state.
   - `state_snapshots` table for point-in-time state machine time-travel.
   - ACID transactions for concurrent subagent swarms.
   - WAL mode (`PRAGMA journal_mode=WAL`) for non-blocking reads during writes.

### Job Isolation

Each logical "run" is tracked as a **Job** with its own `jobId`. `JobManager` resolves the active job pointer so multiple concurrent job instances can share a skill directory without state collision.

---

## 4. Integration Modes

Three modes exist — choose based on portability requirements. The runtime itself has no dependency on any specific mode.

### Mode 1 — AXI CLI (recommended, no-install)

`reactive-skills-axi` is the recommended integration path. It requires **no installation** — agents run it directly via `npx reactive-skills-axi@latest <command>`, making it the most accessible option across any agent harness or CI environment without configuration overhead.

```
Agent Turn
  │
  ├─► npx reactive-skills-axi state    → TOON-formatted prompt slice + allowed_tools
  │
  │   [Agent reasons, executes allowed tools]
  │
  └─► npx reactive-skills-axi emit <SIGNAL> [payload]
        │
        ├─ GuardEvaluator.evaluate()   → passes/fails
        ├─ on_exit hooks (skill.yaml)  → executed by FSMEngine on leaving state
        ├─ STATE_TRANSITION event      → written to EventStore
        ├─ on_enter hooks (skill.yaml) → executed by FSMEngine on entering state
        └─ ProjectionEngine.project()  → deliverable sinks rendered
```

### Mode 2 — MCP stdio (portable, integration)

The MCP server exposes `reactive_state`, `reactive_emit_signal`, `reactive_respond_human`, `reactive_inspect`, `reactive_query_events`, and related tools over stdio. Use when the agent harness has native MCP support and the extra tool-call ergonomics are preferable to shell invocations.



### HSM Lifecycle Hooks (`on_enter` / `on_exit`)

State transitions in any integration mode automatically execute lifecycle hooks declared in `skill.yaml`. These are the primary mechanism for automatic context setup and signal emission — not the `ReactiveRuntimeHooks` class.

```yaml
states:
  GREEN_CODE:
    on_enter:
      - signal: SNAPSHOT_TAKEN
        payload: { checkpoint: true }
    on_exit:
      - signal: CLEANUP_TRIGGERED
```

`FSMEngine` executes `on_enter` hooks after entering a new state and `on_exit` hooks before leaving, appending corresponding events to the `EventStore` and potentially triggering further transitions via the signal queue.

---

## 5. Human-in-the-Loop (HITL) State Gates

States can declare explicit human interaction requirements:

```yaml
human_gate:
  type: "choice"            # approval | choice | text | visual_review | form
  tool: "ask_question"      # ask_question | lavish | chat
  options: ["Approve Plan", "Request Changes", "Abort"]
```

- **Suspension:** When entering a state with `human_gate`, the engine logs `HUMAN_GATE_ENTERED` and formats `<human_gate>` directives in the prompt slice telling the agent to collect user input and stop.
- **Reactive Wakeup:** When the human responds (via `ask_question`, Lavish, or CLI `onHumanResponse`), the response is mapped to typed signals (`USER_APPROVED`, `USER_REVISION_REQUESTED`, `USER_REJECTED`), transition guards evaluate, and context variables (e.g. `user_feedback`) are updated.

---

## 6. Critical System Invariants (Forbidden Practices)

1. **NEVER Mutate Historical Events:** The event store is strictly append-only.
2. **NEVER Trust Subjective Claims:** State transitions must be guarded by testable boolean conditions (`exit_code`, schema check, custom JS guard).
3. **NEVER Couple States Directly:** Each state's prompt in `states/*.md` must be self-contained; cross-state data must travel through `context_keys` or the event stream.
4. **ALWAYS Support Bubbling:** Unhandled events in child substates must escalate to ancestor states.
5. **NEVER Scan Full Event History in Hot Paths:** Use indexed SQLite queries or the in-memory `activeStatePath` pointer; never call `getAll()` on every turn.

### Context Scoping

States can declare an optional `context_scope` array to limit which `context_keys` are included in the prompt slice for that state. This reduces token cost on revisits and enables delta-aware delivery:

- **First visit:** `contextDelta` is `null`; `scopedContext` contains only scoped keys.
- **Revisit:** `contextDelta` includes `is_revisit`, `previous_visit_seq`, `changed_keys` (scoped keys that changed), and `new_since_last_visit`.
- The MCP `reactive_state` response includes `scopedContext`, `contextDelta`, and `visitCount` fields.

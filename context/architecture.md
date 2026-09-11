# Architecture: Reactive Skills Architecture (RSA)

---

## 1. Technology Stack
- **Language & Runtime:** TypeScript (ES2022 / NodeNext modules), Node.js v20+
- **Schema Validation:** Zod v3.23+
- **Manifest Parsing:** js-yaml v4.1+
- **Deliverable Projections:** Handlebars v4.7+
- **Testing & Verification:** Vitest v3.0+, tsx
- **Visual Review:** Lavish Editor (Tailwind CSS v4 + DaisyUI v5)

---

## 2. Directory Structure Ownership

```
├── context/                     # Six-File Context domain documentation
├── src/
│   ├── index.ts                 # Public API exports
│   ├── core/
│   │   ├── types.ts             # Zod schemas & TypeScript interfaces
│   │   ├── event-store.ts       # Append-only event store (JSONL + SQLite)
│   │   ├── guard-evaluator.ts   # Sandbox & custom function invariant evaluator
│   │   ├── projection-engine.ts # Handlebars deliverable generator
│   │   ├── fsm-engine.ts        # HSM statechart loader, path resolver & bubbling engine
│   │   ├── runtime-hooks.ts     # Pre/post-turn in-harness interceptor hooks
│   │   └── legacy-adapter.ts   # Backward compatibility wrapper for SKILL.md
│   ├── mcp/
│   │   └── server.ts            # Stdio Model Context Protocol (MCP) server
│   └── cli/
│       └── index.ts             # AXI CLI command runner (bin: reactive-skills)
├── skills/                      # Synthetic test and verification skill fixtures
│   ├── _test_fsm_skill/         # Generic FSM and HSM test fixture with bubbling
│   ├── _test_hitl_skill/        # Human-in-the-loop gate verification fixture
│   ├── _test_hsm_skill/         # Hierarchical substate bubbling fixture
│   ├── _test_legacy_skill/      # Legacy SKILL.md migration fixture
│ examples/
│   ├── simulate-tdd.ts          # End-to-end execution simulation
└── tests/                       # Automated Vitest test suites
    ├── fsm-engine.test.ts
    ├── hsm-bubbling.test.ts
    ├── legacy-adapter.test.ts
    ├── hitl-gates.test.ts
    ├── sqlite-event-store.test.ts
        └── mcp-server.test.ts
```

---

## 3. Data Storage & Event Sourcing Model

All state changes and execution data are modeled as immutable, causal events:

```json
{
  "id": "uuid-v4",
  "seq": 4,
  "timestamp": "2026-08-31T06:30:19Z",
  "type": "STATE_TRANSITION",
  "payload": {
    "from": "RED_SPEC",
    "to": "GREEN_CODE",
    "signal": "TEST_RAN"
  },
  "causationId": "parent-signal-uuid",
  "state": "GREEN_CODE"
}
```

### Dual Storage Drivers
1. **Streaming JSONL (`.reactive/skills/<skill>/events.jsonl`):** Append-only newline-delimited JSON stream for CLI inspection, tailing, and human auditability.
2. **Relational SQLite Driver (`.reactive/skills/<skill>/events.db`):** Native `node:sqlite` database providing:
   - `events` table indexed by `seq`, `type`, and `state`.
   - `projections` table for caching live deliverable state.
   - `state_snapshots` table for instant point-in-time state machine time-travel.
   - ACID transactions for concurrent subagent swarms.

- **Persistence Path:** `.reactive/skills/<skill>/events.jsonl` and `.reactive/skills/<skill>/events.db` (workspace local and skill-scoped).
- **JSONL Rotation:** The active JSONL segment rotates at 10 MB by default into numbered archive segments.
- **Decision Logging:** Human choices, approvals, and revision feedback append `DECISION_RECORDED` events.
- **Deliverable Projections:** Delivered to `.docs/*.md` and root markdown files on state transitions.

---

## 4. In-Harness Interceptor Runtime Mechanics

```
                  ┌────────────────────────┐
                  │   Event / Signal Bus   │ (Tool Results, Subagents, Human Signals)
                  └───────────┬────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                  In-Harness Interceptor                      │
│                                                              │
│  [Pre-Turn Hook]                     [Post-Turn / Human Hook]│
│  • Reads Active State (HSM)          • Ingests Tool/User Resp│
│  • Detects `human_gate` requirements • Evaluates Guard Expr  │
│  • Hydrates states/{state}.md        • Drives Transition     │
│  • Injects Scoped Prompt & Tools     • Binds User Feedback   │
└──────────────┬───────────────────────────────▲───────────────┘
               │                               │
               ▼                               │
┌──────────────────────────────┐ ┌─────────────┴────────────────┐
│      LLM Reasoning Loop      │ │     Immutable Event Store    │
│  • Reasons in focused state  │ │  • .reactive/events.jsonl    │
│  • Executes scoped tools     ├─┤  • Live Deliverable Sinks    │
│  • Emits results & signals   │ │    (.docs/*.md projections)  │
└──────────────────────────────┘ └──────────────────────────────┘
```

---

## 5. Human-in-the-Loop (HITL) State Gates

States can declare explicit human interaction requirements:
```yaml
human_gate:
  type: "choice"            # approval | choice | text | visual_review | form
  tool: "ask_question"      # ask_question | lavish | chat
  options: ["Approve Plan", "Request Changes", "Abort"]
```

- **Suspension:** When entering a state with `human_gate`, the engine logs `HUMAN_GATE_ENTERED` and formats `<human_gate>` directives in the prompt slice telling the agent to prompt the human and stop.
- **Reactive Wakeup:** When the human responds (via `ask_question`, Lavish, or CLI `onHumanResponse`), the response is mapped to typed signals (`USER_APPROVED`, `USER_REVISION_REQUESTED`, `USER_REJECTED`), transition guards evaluate, and context variables (`user_feedback`) are updated.

---

## 5. Critical System Invariants (Forbidden Practices)

1. **NEVER Mutate Historical Events:** The event store is strictly append-only.
2. **NEVER Trust Subjective Claims:** State transitions must be guarded by testable boolean conditions (`exit_code`, schema check, custom JS guard).
3. **NEVER Couple States Directly:** Each state's prompt in `states/*.md` must be self-contained; cross-state data must travel through `context_keys` or the event stream.
4. **ALWAYS Support Bubbling:** Unhandled events in child substates must escalate to ancestor states.

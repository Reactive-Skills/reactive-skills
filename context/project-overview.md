# Project Overview: Reactive Skills Architecture (RSA)

> Event-Driven Hierarchical State Machine (HSM) Engine and Event Store for Agentic Skills.

---

## 1. Executive Summary & Problem Statement
Conventional agent skills are static markdown files (`SKILL.md`). The LLM is loaded with monolithic instruction sets upfront, enters an unguided loop, and hallucinates task completion without programmatic verification gates or deterministic state management.

**Reactive Skills Architecture (RSA)** transforms passive markdown instructions into **Hierarchical State Machines (HSM)** executed by reactive in-harness interceptor hooks, backed by immutable skill-scoped event stream ledgers (`.reactive/skills/<skill>/events.jsonl`) and automated live deliverable projections.

---

## 2. Core Goals & Outcomes
1. **Just-In-Time Prompt Injection:** Only inject the prompt slices, constraints, and tool whitelists bound to the active state ($\approx 70\%$ token reduction per step).
2. **Deterministic Guard Gates:** State transitions require explicit programmatic invariants (`exit_code == 0`, schema checks) to evaluate `true`.
3. **HSM Event Bubbling:** Deep leaf substates cascade unhandled events up to parent composite states (e.g. `GLOBAL_CANCEL`, `TIMEOUT`, `SECURITY_CRITICAL`).
4. **Event Sourcing First:** All signals, tool results, guard evaluations, and state transitions are appended to an immutable ledger for auditability, replay, and time-travel.
5. **Read-Model Deliverable Sinks:** Automatic continuous rendering of documentation, PR descriptions, and ADRs via Handlebars templates without requiring the LLM to write repetitive summaries.
6. **100% Backward Compatibility:** Dynamic zero-touch wrapper and migration CLI for legacy `SKILL.md` collections.

---

## 3. User & Agent Flows

```
[Trigger / Slash Command] ──► Ingress Event ──► Load FSM Manifest
                                                      │
                                                      ▼
┌─────────────────────────────────────────────────────────────┐
│ Pre-Turn Hook: Inject active state prompt & scope tools     │
│ LLM Turn: Focused execution of active state goal            │
│ Post-Turn Hook: Intercept tool outputs -> Emit typed signal │
│ Guard Evaluation: Check invariant -> Transition state       │
│ Event Store: Append event & update live deliverable sinks   │
└─────────────────────────────────────────────────────────────┘
                                                      │ (Loop until completed)
                                                      ▼
                                         [Terminal State: COMPLETED]
```

---

## 4. Scope Boundaries

### In Scope
- Core TypeScript runtime (`FSMEngine`, `EventStore`, `GuardEvaluator`, `ProjectionEngine`, `ReactiveRuntimeHooks`, `LegacySkillAdapter`, `MigrationEngine`, `JobManager`).
- Declarative statechart schema (`skill.yaml`) with nested composite states and lifecycle hooks (`on_enter`, `on_exit`, `initial_substate`).
- **`apps/axi`** — The `reactive-skills-axi` user-facing CLI: `state`, `emit`, `events`, `inspect`, `invoke`, `init`, `setup`, `reset`, `jobs`, `validate`, `view`, `sync`, `rebuild-sqlite`, `upgrade`.
- **`apps/site`** — Next.js marketing and documentation site.
- Synthetic test and verification fixtures (`_test_fsm_skill`, `_test_hitl_skill`, `_test_hsm_skill`, `_test_legacy_skill`).
- Real-time telemetry server (SSE) and terminal dashboard.
- Workspace sync engine (`reactive-skills-sync`).

### Out of Scope (v1.0)
- Remote distributed multi-node message broker (in-process / workspace-local event store is the target).
- GUI visual editor desktop application (Lavish Editor browser review is used instead).

---

## 5. Success Criteria
- [x] Zero compilation errors with strict TypeScript settings (`pnpm -F @reactive-skills/runtime build`).
- [x] 100% test pass rate across all Vitest suites (`pnpm -F @reactive-skills/runtime test`).
- [x] Full simulation demo passes end-to-end (`pnpm -F @reactive-skills/runtime demo`).
- [x] CLI tools functional for scaffolding and inspecting skills (`reactive-skills-axi`).

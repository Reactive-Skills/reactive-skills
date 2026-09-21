# Progress Tracker: Reactive Skills Architecture (RSA)

## 🚀 Released

| Package | Version | Status |
| :--- | :--- | :--- |
| `@reactive-skills/runtime` | v0.7.0 | ✅ Published |
| `@reactive-skills/axi` | v0.7.0 | ✅ Published |

---

## 🧭 Milestone: v0.5.x — Core HSM Runtime (Shipped)

| Slice | Archetype | Status |
| :--- | :--- | :--- |
| FSM Engine (state loading, path resolution, bubbling) | Core | ✅ Done |
| EventStore (JSONL + SQLite WAL dual driver) | Core | ✅ Done |
| GuardEvaluator (node:vm sandbox, custom JS guard files) | Core | ✅ Done |
| ProjectionEngine (Handlebars deliverable sinks) | Core | ✅ Done |
| RuntimeHooks (pre/post-turn interceptor) | Core | ✅ Done |
| LegacyAdapter (zero-touch SKILL.md wrapper) | Core | ✅ Done |
| MCP Server (reactive_state, reactive_emit_signal, etc.) | Integration | ✅ Done |
| AXI CLI (state, emit, events, inspect, invoke, init, setup, reset, jobs, validate, view, sync, rebuild-sqlite, upgrade) | CLI | ✅ Done |
| HITL Gates (human_gate, ask_question, lavish, USER_* signals) | Core | ✅ Done |
| HSM Bubbling (leaf → ancestor event propagation) | Core | ✅ Done |
| Job Isolation (JobManager, active job pointer) | Core | ✅ Done |
| Migration Engine (retroactive schema upgrader) | Core | ✅ Done |
| Telemetry Server (SSE, dashboard) | Ops | ✅ Done |
| Workspace Sync Engine | Ops | ✅ Done |
| Context Scoping & Delta Delivery | Core | ✅ Done |
| Strict Execution Mode (bypass detection, idle-turn limit) | Core | ✅ Done |
| Performance Budget Tests (P0/P1 latency assertions) | Quality | ✅ Done |
| Signal Queue Cycle Guard (REL-02, MAX_QUEUE_DRAIN_DEPTH) | Core | ✅ Done |
| Public Prose Quality Gate | Quality | ✅ Done |

---

## ⚙️ Milestone: v0.6.x — Performance & Documentation Polish (Active)

| Slice | Archetype | Status |
| :--- | :--- | :--- |
| Decoupled Judgment Engine & Snap-On Adapters (`JudgmentPort`, `CircuitBreaker`) | Core | ✅ Done |
| Semantic Model Capability Tiers (`StateModelDefinition`, `<model_contract>`) | Core | ✅ Done |
| TSDoc `@Tier / @Complexity / @CRAPScore` annotations on hot-path methods | Quality | ⏳ Queued |
| Automated CC/CRAP gate in CI (`check:complexity` script) | Quality | ⏳ Queued |
| Context doc synchronization (architecture, progress tracker, project overview) | Docs | ✅ Done |

---

## 🛡️ Milestone: v1.0.0 — Public Stable Release

| Slice | Archetype | Status |
| :--- | :--- | :--- |
| Remote distributed multi-node message broker | Future | 🗓️ Planned |
| GUI visual statechart editor (desktop app) | Future | 🗓️ Planned |
| Plugin registry for community skills | Future | 🗓️ Planned |

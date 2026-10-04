# Progress Tracker: Reactive Skills Architecture (RSA)

## 🚀 Released

| Package | Version | Status |
| :--- | :--- | :--- |
| `@reactive-skills/runtime` | v0.17.1 | ✅ Published |
| `@reactive-skills/axi` | v0.17.1 | ✅ Published |

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
| Judgment probability thresholds (`min_probability`, `escalate`, `judgment.probability_thresholds`, guard contract drift checks in `validate`) | Core | ✅ Done |
| TSDoc `@Tier / @Complexity / @CRAPScore` annotations on hot-path methods | Quality | ⏳ Queued |
| Automated CC/CRAP gate in CI (`check:complexity` script) | Quality | ⏳ Queued |
| Context doc synchronization (architecture, progress tracker, project overview) | Docs | ✅ Done |

---

## 🌐 Site

| Slice | Archetype | Status |
| :--- | :--- | :--- |
| Adoption homepage, measured registry stats, registry and blog layout, telemetry nav, guide merge (`docs/specs/0013-site-adoption-ux.md`) | Site | ✅ Done |

---

## 🗺️ Backlog Release Roadmap (`docs/scope/backlog-release-roadmap.md`)

| Train | Version | Scope | Status |
| :--- | :--- | :--- | :--- |
| R1 | v0.17.0 | Probability thresholds, guard contract lint, security policy (#23, #25) | ✅ Published |
| R1b | skill releases | ameliorate and resume-manager migrate to `min_probability` | 🟡 ameliorate 2.2.0 done; resume-manager in progress separately |
| R2 | v0.17.1 | #28, #22 part 1, #15 (`docs/specs/0015-gate-integrity.md`, ADR 0011) | ✅ Published |
| R2b | v0.17.2 | Rejected-credential refusal message, test guard hint | 🔨 In progress |
| R3 | v0.18.0 | #22 part 2 first, #32, #29, #10, #39, #42, #44, #47 | ⏳ Queued |
| R4 | v0.19.0 | #14, #26, #43, #45 | ⏳ Queued |
| R5 | v0.20.0 | #31, #24 | ⏳ Queued |
| R6 | v0.21.0 | #34 phase 1, #33, #40 | ⏳ Queued |
| R7 | v0.22.0 | #34 sandbox default, #33 strict mode | ⏳ Queued |
| Triage | n/a | #12 Synthesis report scoping (likely skill or template side) | ⏳ Needs triage |

---

## 🛡️ Milestone: v1.0.0 — Public Stable Release

| Slice | Archetype | Status |
| :--- | :--- | :--- |
| Remote distributed multi-node message broker | Future | 🗓️ Planned |
| GUI visual statechart editor (desktop app) | Future | 🗓️ Planned |
| Plugin registry for community skills | Future | 🗓️ Planned |

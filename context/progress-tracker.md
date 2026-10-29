# Progress Tracker: Reactive Skills Architecture (RSA)

## 🚀 Released

| Package | Version | Status |
| :--- | :--- | :--- |
| `@reactive-skills/runtime` | v0.17.2 | ✅ Published |
| `@reactive-skills/axi` | v0.17.2 | ✅ Published |
| `@reactive-skills/runtime`, `@reactive-skills/axi` | v0.18.0 | ✅ Published (`docs/specs/0020-v0.18.0-release-preparation.md`) |
| `@reactive-skills/runtime`, `@reactive-skills/axi` | v0.20.0 | 🧪 Breaking 0.x minor release candidate; breaking changes and migration checklist in `docs/releases/v0.20.0.md` |
| `@reactive-skills/runtime`, `@reactive-skills/axi` | v0.19.0 | 🧪 Candidate prepared (`docs/specs/0022-v0.19.0-release-preparation.md`) |
| `@reactive-skills/runtime`, `@reactive-skills/axi` | v0.17.3 | ✅ Published (`docs/specs/0018-v0.17.3-release-preparation.md`) |

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
| Sync from a git ref (`ref` in `sync.json`, `--ref`), SemVer downgrade refusal (`--allow-downgrade`), working-tree branch and dirty warnings, per-skill source provenance in `sync-state.json` (#40) | Ops | ✅ Done |
| Context Scoping & Delta Delivery | Core | ✅ Done |
| Compact MCP state delivery: one XML prompt, scoped context, opt-in `include_full_context`, and UTF-8 response estimates (`src/mcp/state-response.ts`, `server.ts`, `core/fsm-engine.ts`, `core/types.ts`; `mcp-lean-state.test.ts`, `mcp-context-prepare.test.ts`; `context/architecture.md`, `PERFORMANCE-STANDARDS.md`, runtime changelog) | Runtime / MCP | ✅ Verified: 611 runtime tests, 310 AXI tests, both builds, docs and prose gates |
| Strict Execution Mode (bypass detection, idle-turn limit) | Core | ✅ Done |
| Performance Budget Tests (P0/P1 latency assertions) | Quality | ✅ Done |
| Signal Queue Cycle Guard (REL-02, MAX_QUEUE_DRAIN_DEPTH) | Core | ✅ Done |
| Public Prose Quality Gate | Quality | ✅ Done |

---

## ⚙️ Milestone: v0.6.x — Performance & Documentation Polish (Active)

Explicit shallow non-empty judgment preconditions are implemented in `packages/runtime/src/core/judgment-input.ts` as `precondition.non_empty.context_paths` / `payload_paths`, retaining existing presence/type checks and the bounded judgment cascade.
`judgment-nonempty-preconditions.test.ts` covers missing/blank/empty values, non-empty values, zero/false, manifest-seeded null/[] defaults, refusal replay/snapshots, idempotent replay and subsequent evidence updates; existing guarantee tests remain unchanged.
AXI `inspect-judgment-input.test.ts` covers read-only, content-free inspection through the shared runtime API, with the inspection complexity annotation updated in `judgment-input-inspection.ts`.
The runtime README, `docs/specs/judgment-input-selection.md` and `PERFORMANCE-STANDARDS.md` describe the additive contract and its checked-value cost.
Caller complexity annotations in `judgment-engine.ts`, `guard-evaluator.ts` and `fsm-engine.ts` account for checked string bytes/object keys without changing cascade, guard or FSM behavior.
Local validation passed 1,014 runtime tests, 387 AXI tests (one existing skip), both package builds and documentation/prose gates; new helper CC measures 2–6 and preparation CC 12.

Optional transition payload contracts and targeted guard inspection are implemented in `core/payload-contract.ts`, `payload-guard.ts`, `types.ts`, `fsm-engine.ts`, `state-view.ts`, `runtime-capabilities.ts`, `index.ts`, MCP `server.ts` and AXI `commands/guard-inspection.ts`, `inspect.ts`, `cli/commands.ts`.
The shared compact/XML renderer retains exact legacy guard fallback and owning-state order; structural checks precede unchanged guards and preserve ancestor fall-through, evidence and refusal events.
`payload-contract.test.ts` and AXI `guard-inspection.test.ts` cover typed inputs, incomplete contracts, declaration drift, replay/snapshots and read-only contained source inspection.
`scripts/benchmark-payload-contracts.ts`, `docs/payload-contracts.md`, the runtime README, authoritative changelog and `PERFORMANCE-STANDARDS.md` document the API and measured net cost including inspection.
Authored contracts render one short line per field with an `inspect guard` pointer; refusal hints and evidence sources appear only in refusals and inspection.
The pinned short TDD view shrinks from 1,552 B to 1,549 B with the authored contract (1,883 B including one inspection); the 37 B guard bounds the saving, so the 820 B design estimate is not reached and no universal savings claim is made.
`payload-contract.test.ts` also covers a run-version conflict during contract-guarded evaluation.
Local validation passed 990 runtime tests and 386 AXI tests (one existing AXI skip), both package builds and the documentation/prose gates; new contract/evaluation helpers, the targeted MCP handler and the AXI guard helper have 100% measured branch coverage.

AXI and MCP expose bounded local evidence import, explicit verified reads and an optional `evidence.reference_submission` capability.
`core/evidence-submission.ts` shares explicit field binding and keyed retry handling between AXI `commands/evidence.ts` / `commands/emit.ts` and MCP `server.ts`.
Imports return compact receipts; folded import-and-emit records immutable references through the existing SDK resolver, preserving guard/judgment/projection and export behavior.
`apps/axi/tests/commands/evidence.test.ts`, `evidence-cli.test.ts` and runtime `mcp-evidence.test.ts` exercise both real interfaces, paths with spaces, JSON, escaped field pointers, denial, malformed/damaged/cross-run references, semantic judgment content, inline compatibility, concurrent submissions and lost-response retries.
Import parser errors suppress content snippets; malformed AXI `--evidence` bindings and read receipts fail as `VALIDATION_ERROR` before the run opens; both package builds, 765 runtime tests, 357 AXI tests and documentation/prose gates pass locally.
`docs/evidence-registry.md`, `apps/axi/README.md`, `.agents/references/repository-map.md`, CLI command help and `PERFORMANCE-STANDARDS.md` describe the transport contract and budgets.

The runtime SDK evidence registry is implemented: `evidence-store.ts` defines the selected-run storage port and atomic local adapter, and `evidence-resolver.ts` limits materialization to manifest-declared fields.
`event-store.ts` bundles immutable evidence with run exports; `fsm-engine.ts`, `projection-engine.ts`, `types.ts`, `runtime-capabilities.ts`, and `index.ts` connect verification, replay and SDK discovery.
`evidence-registry.test.ts` exercises inline/reference parity, replay/snapshots, projection, bundle restore, tamper/missing content, scope, registration races, interrupted publication and concurrent registrars without changing existing guarantee assertions.
`docs/evidence-registry.md` documents the SDK contract, limits and retention rules; `PERFORMANCE-STANDARDS.md` budgets the new O(evidence bytes) storage operations.
The repository map lists both evidence modules.
Signal declarations validate referenced media before context-update projection, so expanding an update cannot bypass its field contract.
Run exports with declarations bundle only committed references (without them, every registration is bundled and any damage fails) and report damaged unreferenced registrations (e.g. behind a refused signal) instead of aborting; the local store resolves its artifacts directory against the real workspace path, so symlinked workspaces work.
Local validation after the MCP state-response integration passed both package builds, 699 runtime tests, 310 AXI tests, and documentation/prose gates.

| Slice | Archetype | Status |
| :--- | :--- | :--- |
| Exact offline transport-cost fixture (`packages/runtime/scripts/transport-benchmark/`, pinned public TDD files, historical and current deterministic byte baselines, real MCP/SDK/cold AXI trace, ledger/visit/input/artifact accounting, persisted post-transition totals, strict recovery-context equality); regression coverage including canonical predicate refusal in `packages/runtime/tests/transport-benchmark.test.ts` and `packages/runtime/tests/transport-benchmark-axi-failures.test.ts`, budgets in `PERFORMANCE-STANDARDS.md`; no runtime capability or default changes | Quality | ✅ Done |
| Accepted-context replay (`packages/runtime/src/core/fsm-engine.ts`): initialization and transition patches record ordered lifecycle and accepted signal assignments, with records-only replay for older ledgers, whose hook-assigned context depends on their snapshot; strict bypass preserves its state-only behavior; `packages/runtime/tests/fsm-replay-equivalence.test.ts` covers full/snapshot/delta recovery, snapshot interruption, changed manifests, refusals and all 21 pinned public catalog manifests in `tests/fixtures/public-catalog.json`; benchmark exception removed in `scripts/transport-benchmark/sdk.ts` and `tests/transport-benchmark.test.ts`, with README and baseline finding updated; budgets in `PERFORMANCE-STANDARDS.md` | Runtime / Recovery | ✅ Verified: 837 runtime tests, 310 AXI tests, both builds, docs and prose gates; canonical and legacy catalog recovery checks |
| Decoupled Judgment Engine & Snap-On Adapters (`JudgmentPort`, `CircuitBreaker`) | Core | ✅ Done |
| Opt-in nested `payload_paths`, explicit required context, declarative payload preconditions, content-free input inspection/audit and approval identity (`judgment-input.ts`, `judgment-engine.ts`, `guard-evaluator.ts`, `fsm-engine.ts`, `types.ts`, `runtime-capabilities.ts`, runtime exports; AXI `inspect.ts`, `judgment-input-inspection.ts`, `judgment-contracts.ts` and `cli/commands.ts`); `judgment-payload-selection.test.ts`, `judgment-input-persistence.test.ts`, `inspect-judgment-input.test.ts`, `validate-judgment-input.test.ts`, `docs/specs/judgment-input-selection.md`, runtime/AXI READMEs, `.agents/references/repository-map.md` and `PERFORMANCE-STANDARDS.md` | Runtime / AXI | 🧪 Implemented; 707 runtime assertions and 314 AXI assertions passed, both builds/docs/prose passed; repeated timing-sensitive baseline failures block a final combined runtime gate |
| Opt-in whole-cascade judgment deadline, explicit same-adapter retry permission, cancellation, aggregate/refusal and per-attempt latency, SDK client reuse, and `judgment.total_deadline` capability (`judgment-engine.ts`, `judgment-execution.ts`, `guard-evaluator.ts`, `types.ts`, `runtime-capabilities.ts`); `judgment-deadline.test.ts`, `judgment-client-lifecycle.test.ts`, `judgment-deadline-persistence.test.ts`, `docs/specs/0023-judgment-deadlines.md`, `.agents/references/repository-map.md` and `PERFORMANCE-STANDARDS.md` | Core | ✅ Done |
| Semantic Model Capability Tiers (`StateModelDefinition`, `<model_contract>`) | Core | ✅ Done |
| Judgment probability thresholds (`min_probability`, `escalate`, `judgment.probability_thresholds`, guard contract drift checks in `validate`) | Core | ✅ Done |
| Scoped Jev judgment context (`context_paths`, `include_payload`, `judgment.context_paths`, `contextSent` in `GUARD_EVALUATED`, path checks in `validate`; `docs/specs/0021-judgment-context-paths.md`, #24) | Core | ✅ Done |
| TSDoc `@Tier / @Complexity / @CRAPScore` annotations on hot-path methods | Quality | ⏳ Queued |
| Automated CC/CRAP gate in CI (`check:complexity` script) | Quality | ⏳ Queued |
| Context doc synchronization (architecture, progress tracker, project overview) | Docs | ✅ Done |
| Skill identifiers: `jobs` and `reset` resolve a skill path, directory name, or manifest name to the manifest-keyed run store; `reset --job` fails for an unknown run; approve and bypass-recovery hints name a resolvable skill (#45, #65 item 1) | AXI | ✅ Done |
| Static skill vetting: `reactive-skills-axi vet <skill\|dir>` and a shared rule set in the runtime (`@reactive-skills/runtime/vet`) for risky APIs, prompt injection, hidden content, encoded blobs, and download-and-execute steps, with `--fail-on`, a reviewed allowlist, and `docs/vetting.md` (#33, Reactive-Skills/skills#20) | Core / AXI | ✅ Done |
| Mixed legacy/runs store: legacy snapshot, projection and watermark rows follow the run that owns the legacy events (no more `FOREIGN KEY constraint failed`), `invoke` opens the ledger before registering a job and a store that cannot be opened fails with its path and a recovery command, `jobs` lists each job once (#43) | Core | ✅ Done |
| `invoke --payload` rejects a `{"contextUpdates":{...}}` wrapper with a message naming the flat initial-context shape and creates no job; invoke and emit usage text and the CLI docs state each command's payload shape (#44) | AXI | ✅ Done |
| Incremental JSONL mirror on append: rows newer than the skill-wide certified `ledger_seq` only, with bounded partial-chunk hashing; full reconcile retained for uncertain opens and explicit repair; `transition_total_ms` (persisted transition, snapshot save and projections) persisted in a `TRANSITION_COMPLETED` event and used by the `PERF_DEGRADATION` alarm; `transition_duration_ms` kept as the pre-persistence portion | Core | ✅ Done |
| Verified JSONL open checkpoint: generation/schema/global boundary, ordered segment inventory, lengths and SHA-256 chunk digests; clean opens verify every byte without full historical object reconciliation; canonical tail catch-up, repair fallback, rotation and lifecycle invalidation (`core/event-store.ts`, `core/jsonl-checkpoint.ts`, `ledger-open-checkpoint.test.ts`, `PERFORMANCE-STANDARDS.md`, `context/architecture.md`, `.agents/references/repository-map.md`) | Core | ✅ Verified: 658 runtime tests, 310 AXI tests, both builds, docs and prose gates |

---

## 🌐 Site

The mods gallery now uses three reproducible 2× PNGs for the bq-vitals status line, live `/flow` map and `/flow-plan` trace.
`apps/site/src/features/mods/images/capture.mjs`, `capture-host.mjs`, `capture-input.json`, `capture.css`, the bundled font/license and the adjacent README record the public catalog source and regeneration procedure.
The capture invokes actual mod hooks over real guarded `release-notes` runtime transitions with explicitly labeled example clock and usage data.
`apps/site/src/app/mods/page.js` supplies descriptive alt text, intrinsic dimensions and full-size links; `apps/site/tests/modsScreenshots.test.js` reproduced the original low-resolution/missing assets before replacement and enforces the resolution/size budget.
`PERFORMANCE-STANDARDS.md` records the offline authoring and static rendering budgets.
The capture now draws seam-free duration rectangles and arranges the live-map state list beside its plan to remove the unused right-hand area; all three images are regenerated for visual review before the next validation round.

| Slice | Archetype | Status |
| :--- | :--- | :--- |
| Adoption homepage, measured registry stats, registry and blog layout, telemetry nav, guide merge (`docs/specs/0013-site-adoption-ux.md`) | Site | ✅ Done |
| Quickstart opens with a published skill (#61), Node engine floor raised to >=22.13.0 for `node:sqlite`, quickstart expected outputs matched to the CLI | Site | ✅ Done |
| Hero command tabs keyboard support (arrow keys, Home/End, roving tab stop) and a long-form blog prose variant (#55, #63) | Site | ✅ Done |
| Quickstart install step carries a skill trust note pointing to `SECURITY.md` (guard code runs with full process privileges; #34, #33) | Site | ✅ Done |
| Site production type-check excludes `apps/site/tests` (TS6059 from #72 had failed every deploy since 2026-10-05); CI now builds the site; authoring docs state guard module formats (#10) | Site | ✅ Done |
| `validate` checks guardFunction module format without importing the guard; runtime load failures name the file and the fix (#10) | Runtime, AXI | ✅ Done |
| Umami page-view analytics (tracker only, no recorder, Do Not Track honored) with a `/privacy` disclosure and footer link (`docs/analytics.md`) | Site | ✅ Done |
| Site leads skill creation with the `skill-manager` agent prompt (landing "Create a skill" row and `/docs/authoring`), with `axi init` as the terminal alternative | Site | ✅ Done |
| Run-history redesign: dark and light Flight Recorder palettes, mono display face, full-width hero with a scroll-driven run tape of real `tdd-refactor` states, sortable registry log replacing card rows, splitting SKILL.md tape; card rows, eyebrows and section numbers removed; tokens keep `--phino-*` names (`lib/landing/flightRecorder.js`) | Site | ✅ Done |

---

## 🗺️ Backlog Release Roadmap (`docs/scope/backlog-release-roadmap.md`)

> `setup` now registers `@reactive-skills/axi@<installed version>` (or the global install's absolute script) and rewrites bare-alias, unpinned, and stale entries.

| Train | Version | Scope | Status |
| :--- | :--- | :--- | :--- |
| R1 | v0.17.0 | Probability thresholds, guard contract lint, security policy (#23, #25) | ✅ Published |
| R1b | skill releases | ameliorate and resume-manager migrate to `min_probability` | 🟡 ameliorate 2.2.0 done; resume-manager in progress separately |
| R2 | v0.17.1 | #28, #22 part 1, #15 (`docs/specs/0015-gate-integrity.md`, ADR 0011) | ✅ Published |
| R2b | v0.17.2 | Rejected-credential refusal message, test guard hint | ✅ Published |
| R2c | v0.17.3 | Agent-facing credentials reason (stop and ask the user, never unset the key) | ✅ Published |
| R3a | v0.18.0 | #22 part 2 human approval and self-report grant (ADR 0012, `docs/specs/0019-human-approval.md`), #47, #32 | ✅ Published |
| R3b | v0.19.0 | #10, #42, #44, #45, #24, #43, `vet` (#33 part), site fixes; #29, #39, #65 items 2-3 still open | 🧪 Candidate prepared (`docs/specs/0022-v0.19.0-release-preparation.md`) |
| R4 | Unassigned | #14, #26 | ⏳ Queued; v0.20.0 instead carries the runtime/transport candidate |
| R5 | v0.21.0 | #31 | ⏳ Queued |
| R6 | v0.22.0 | #34 phase 1, #33 trust record, #40 | ⏳ Queued |
| R7 | v0.23.0 | #34 sandbox default, #33 strict mode | ⏳ Queued |
| Triage | n/a | #12 Synthesis report scoping (likely skill or template side) | ⏳ Needs triage |

---

## 🛡️ Milestone: v1.0.0 — Public Stable Release

| Slice | Archetype | Status |
| :--- | :--- | :--- |
| Remote distributed multi-node message broker | Future | 🗓️ Planned |
| GUI visual statechart editor (desktop app) | Future | 🗓️ Planned |
| Plugin registry for community skills | Future | 🗓️ Planned |

## Negotiated compact complete state delivery

- Added `core/state-view.ts` and public SDK exports for one complete recovery-safe view and compact JSON/development XML rendering.
- Added `state.compact_v1` capability selection to MCP state/context preparation and AXI invoke/state/emit; retained legacy defaults and existing MCP full-context opt-in behavior.
- Added AXI `state-view-output.ts` parsing/rendering and development CLI output selection.
- Preserved rendered prompts, declared and inherited context scopes, ordered ancestor contracts and same-signal fall-through; included conditional gates, model hints, strict status and signal receipt refusals.
- Corrected non-strict orphan strict XML and portable tool-enforcement wording in `fsm-engine.ts`.
- Updated shared `bootloader.ts`, README, architecture, code standards, integration modes, repository map and performance standards for compaction refetch and actual adapter boundaries.
- Added interface meaning, scoped sentinel recovery, refusal and restoration regression tests without changing existing guarantee assertions.
- Restored the most recent signal refusal (guard or evidence verification) from existing replay data and cached it for complete views across compaction, so cached and freshly reopened engines report the same refusal; no new event types or payload changes.
- Documented negotiated output flags in AXI command help and development CLI help.
- Added `FSMEngine.recordStateDelivery()` for MCP state, context preparation and development CLI state: up to `max_view_refetches` (default 2, per state next to `max_idle_turns`) repeat fetches of the same view append `STATE_VIEW_REFETCHED` instead of counting; later repeats count again, so idle polling still reaches `BYPASS_DETECTED` (restored real `reactive_state` bypass assertions). `PERF_DEGRADATION`/`PROJECTION_FAILED` telemetry does not change the view, and compact `seq` is the view-changing event sequence within the bounded trailing window; when no view-changing event remains in that window, the anchor falls back to the latest event sequence and can advance in non-strict runs. That `seq` is informational and does not affect guards or strict counting. Compaction refetch guidance names MCP `job_id: <run_id>` so terminal runs are not rotated. Performance standards and inline budgets name the bounded O(w) trailing-event read used for refetch accounting and the view sequence anchor.

## MCP complete continuation responses

- Added opt-in `return_view: "compact-v1"` and `state.continuation_v1` capability for MCP emit and human-response tools in `mcp/server.ts` and `core/runtime-capabilities.ts`.
- Added `mcp/continuation-response.ts` for per-run MCP serialization, receipt/current-view separation, keyed durable metadata and shared `recordStateDelivery()` accounting; ignored receipt bookkeeping in `core/fsm-engine.ts` bounded refetch scanning.
- Added `mcp/human-response.ts` to finish the existing human signal batch before delivering a view, preserving default approval precedence, self-report warnings across the full batch and the CLI-only judgment approval boundary.
- Added protocol regression coverage in `tests/mcp-continuation.test.ts`, including pinned public TDD, exact event/turn counts, refusals/self-loops, lifecycle/child/terminal paths, replay/snapshot recovery, keyed retries and competing clients.
- Keyed continuation deliveries use a per-submission idempotency key in `recordStateDelivery()`, so a duplicate keyed emit racing from another server process counts the reached state once.
- Updated shared `core/bootloader.ts`, root/runtime READMEs, runtime changelog, `docs/mcp-continuation.md`, `context/architecture.md`, repository map and `PERFORMANCE-STANDARDS.md` for the negotiated response and delivery/retry budgets.
- Verified locally: both package builds, 950 runtime tests, 377 AXI tests with one existing skip, documentation invariants and public prose gates.
- The new continuation and human-response modules have 100% statement/branch coverage in the focused offline protocol run; the bounded delivery scan also has full branch coverage.
- Complexity measurements keep P0 helpers at CC <= 8 and human orchestration at CC 12; existing guarantee tests remain unchanged.
- Interrupted keyed emit/human retries without a saved receipt now return `result_unavailable` instead of a refusal built from idempotent replays, and append no delivery event; recovery now records a local per-view credit outside the run version so its strict turn is counted once at both interruption points.
- A keyed signal whose append deduplicates to another process's committed submission now returns that submission's replay instead of evaluating guards and transitioning a second time; a regression test injects the competing commit between lookup and append.
- Replayed `handleSignal` results now carry `replayed: true`; MCP emit and human response report them as `result_unavailable`. Recovered and replayed continuations append no delivery or receipt (removing `FSMEngine.hasStateDelivery()`), so a duplicate arriving while the original keyed guard is pending no longer bumps the run version and aborts that guard; a regression test parks a real asynchronous guard function in the winner.
- The JSONL projection lock no longer steals a lock file that is not yet readable as an owner record (a holder between open and pid write); stealing it let two processes extend the mirror from one checkpoint and duplicate a tail line under concurrent rotation. A regression test holds an empty lock across an append.

## AXI continuation and bounded causation reads

- Replaced full-history response/causation lookups in AXI `commands/state.ts`, `commands/invoke.ts` and `commands/emit.ts` with the existing run-scoped public `EventStore.getLatestEvent()`; retained explicit event IDs, history and replay behavior.
- Updated shared `core/bootloader.ts`, AXI `suggestions.ts` and `apps/axi/README.md` to consume compact invoke/emit views, refetch after resume/compaction/recovery, and use inspect/help on demand; AXI strict-turn behavior and output shapes/defaults are unchanged.
- Added `apps/axi/tests/commands/continuation-reads.test.ts` for bounded access after snapshot/replay, run aliases and skill paths with competing-run events, explicit causation, scoped refusal context, and the pinned public TDD continuation/terminal-resume path; updated state/emit test doubles for bounded store access without changing their guarantee assertions.
- Updated `PERFORMANCE-STANDARDS.md` with indexed lookup complexity and isolated measured timings; cold replay and open verification remain separate costs.
- Verified both package builds, 958 runtime tests, 385 AXI tests with one existing skip, documentation invariants and public prose gates; exact transport-byte assertions remain unchanged, with five expected legacy output sizes increased by 22 bytes for the revised recovery hint.

## v0.20.0 release preparation

The release preparation command advanced the root, runtime, AXI and site package manifests to `0.20.0`; individual skill versions remain unchanged.
`docs/releases/v0.20.0.md` records default MCP state changes, opt-in compact/continuation and inspection shapes, strict-fetch accounting, SDK keyed replay results and legacy snapshot recovery requirements.
The runtime and AXI changelogs carry the same release entry; `scripts/sync-changelog.js` synchronizes the root changelog and generated site release history.
The root, AXI and runtime README release banners describe the breaking 0.x minor release and link its migration notes.
The candidate requires both package builds, runtime and AXI suites (including documentation/prose checks), site tests, final runtime archive inspection and `RELEASE_TAG=v0.20.0 node scripts/verify-release-tag.js` before submission.
Publication remains a separate tag push after the release pull request is merged.

Release packaging inspection confirmed AXI is documented and consumed as a CLI/MCP package, with no root library source or package API imports in repository code/tests/docs.
Removed its dangling `main` / `types` declarations, documented the CLI-only boundary in the AXI README and release notes, and retained both CLI binary declarations.
`packages/runtime/tests/package-entrypoints.test.ts` packs each public package into a temporary directory and checks all declared main/types/typings/module/exports/bin files against actual packed contents after the normal builds.
The table-driven regression first failed for AXI's missing `dist/index.js` before the metadata correction; runtime entrypoint validation already passed.

Final candidate verification passed on Node 22.23.3: both package builds, 994 runtime tests, 386 AXI tests (one existing skip), 61 site tests, documentation/prose gates and the production site build.
Both final package archives include the current README/changelog and every declared entry file; the AXI archive resolves its runtime dependency to `0.20.0`.
`RELEASE_TAG=v0.20.0 node scripts/verify-release-tag.js` passes; no release tag was created or pushed during preparation.

`docs/scope/backlog-release-roadmap.md` keeps the queued workspace-binding work unassigned rather than attributing that unimplemented scope to the v0.20.0 candidate.

## Recovered MCP continuation delivery accounting

- Added additive SQLite delivery credits keyed by immutable run and current view sequence, with indexed signal/transition boundaries and atomic absorption of only the original delivery's matching view; recovery writes neither execution events nor run versions.
- Included credits in strict counters, XML status, refetch allowance and bypass checks; preserved saved receipts and response shapes.
- Suppressed prompt-slice telemetry writes during recovered/replayed continuation rendering; a forced slow-render regression first reproduced a run-version bump while a real guard was pending.
- Expanded protocol regressions for both interruption points on emit/human response, duplicate recovery, pending guards, original-response promotion, snapshot/replay reopen, later views and idle enforcement; added storage isolation, legacy read-only and cleanup checks.
- Updated continuation docs, root/runtime READMEs, architecture and performance budgets to replace the uncounted recovery limitation.
- Verified both package builds, 1003 runtime tests, 386 AXI tests (one existing skip), documentation invariants and public prose gates; the focused continuation/storage/strict suite passes 67 tests, including partial human batches, slow rendering and per-view credit absorption.

Changed files: `packages/runtime/src/core/event-store.ts`, `packages/runtime/src/core/fsm-engine.ts`, `packages/runtime/src/mcp/continuation-response.ts`, `packages/runtime/tests/mcp-continuation.test.ts`, `packages/runtime/tests/recovered-deliveries.test.ts`, `docs/mcp-continuation.md`, root/runtime READMEs, `context/architecture.md`, this tracker and `PERFORMANCE-STANDARDS.md`.

## Public context-claim corrections

Replaced unsupported token-saving claims in `README.md`, `context/project-overview.md`, `PERFORMANCE-STANDARDS.md`, the introductory site blog post (`apps/site/src/infrastructure/content/blog/posts/introducing-reactive-skills.js`) and the site AXI guide (`apps/site/src/infrastructure/content/docs/axi.js`).
The wording distinguishes unvisited source instructions from delivered context, includes protocol and retained-transcript costs, and makes no general reduction claim.
Performance budgets, including P0 <5 ms, remain explicitly labeled engineering targets.
Local validation passed both package builds, the full runtime and AXI suites, site tests, documentation invariants, the public prose gate and a targeted scan for the removed percentage claims.

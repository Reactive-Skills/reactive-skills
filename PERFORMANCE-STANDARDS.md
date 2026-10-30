# Reactive Skills Architecture (RSA) Performance Engineering Standards

## Philosophy

Track local transition, guard and prompt-delivery costs against explicit budgets, and report measured context overhead by interface and declared workload.

Reactive Skills Architecture (RSA) enforces declared workflow transitions and records execution events.
Token consumption and repeated state delivery depend on the workload, transport and host.

---

## Performance Tiers

The latency budgets below, including the P0 <5 ms budget, are engineering targets, not measured results or runtime guarantees.

| Tier | Latency Target | Use Case | RSA Examples |
|------|----------------|----------|--------------|
| **P0 - Interactive Hot Path** | < 5ms | In-turn execution, blocks agent reasoning loop | `generatePromptSlice()`, `handleSignal()`, `GuardEvaluator.evaluate()`, `auditToolExecution()` |
| **P1 - Responsive Storage** | < 25ms | State mutation, event ledger persistence, read models | `EventStore.append()` (SQLite WAL + JSONL), `ProjectionEngine.render()`, `EventStore.getLatestSnapshot()`, CLI `axi state`/`axi emit` |
| **P2 - Lifecycle & Streaming** | < 100ms | Session bootstrap, event replay, telemetry streaming | `FSMEngine.rehydrate()`, `TelemetryServer` SSE broadcast, `FSMEngine.invokeSkill()`, CLI `axi inspect`/`axi events` |
| **P3 - Batch & Migration** | < 2000ms | Offline jobs, retroactive migration, log rebuilding | `MigrationEngine.migrateProject()`, `rebuild-sqlite`, workspace registry synchronization |

### Scaling Targets Across Run Sizes

| Tier | Small (< 50 events) | Medium (50–500 events) | Large (500–5,000 events) | XL (> 5,000 events) |
|------|---------------------|------------------------|--------------------------|---------------------|
| **P0** | < 0.5ms | < 1ms | < 2ms | < 5ms (capped via in-memory state cache) |
| **P1** | < 2ms | < 5ms | < 15ms | < 25ms (indexed SQLite B-Trees) |
| **P2** | < 10ms | < 30ms | < 60ms | < 100ms (snapshot-based delta rehydration) |
| **P3** | < 100ms | < 500ms | < 1500ms | < 2000ms |

> **Key Invariant**: P0 and P1 targets are strictly capped. They must resolve through in-memory indices and pre-compiled templates rather than scaling with total event history or skill manifest size.

---

## Complexity Budget

### Release packaging verification

The release entrypoint regression is a P3 offline check after the normal package builds.
It packs both public packages into temporary directories and validates declared entry files against the package manager's actual archive file list.
Metadata validation costs O(f * e + d * b) in packed files f, entry count e, declaration depth d and declaration bytes b, with a <2000ms local validation target excluding package-manager startup and archive creation.
No packaging work runs in the runtime or CLI request paths.

### Payload Contracts and Guard Inspection

Authored `payload_contract` validation and rendering are P0 (<5ms for bounded declarations), with O(f + b) work for f declared fields and b selected value or expression bytes.
Structural checks run on the existing verified evidence before the unchanged guard evaluator and use existing guard/refusal events; no new append, projection or full-history read is added.
Contract consistency checks recognize only a complete single strict equality against a JSON primitive and never infer a complete schema from guard text.
Pure helpers target CC <=8, branch coverage >=90% and CRAP <=10.
Focused V8 coverage measures 100% branches for `payload-contract.ts` and `payload-guard.ts`; ESLint measures helper CC 3–8, with state/module inspection CC 11/5 under P2 limits.

Targeted guard inspection is P2 (<100ms local), O(m + d + b) in manifest bytes m, owning-state depth d and source bytes b.
SDK inspection of an already validated manifest omits m; MCP and AXI parse the manifest on disk without opening a run or executing lifecycle or guard code.
Module source reads validate realpath containment, cost O(b), and do not resolve or execute imported modules.
Inspection helpers target CC <=15, branch coverage >=70% and CRAP <=25.
Existing whole-skill inspection and guard/judgment costs remain additional and unchanged.

The offline `packages/runtime/scripts/benchmark-payload-contracts.ts` probe uses the pinned public TDD GREEN_CODE state on Node v22.23.3/Linux with warm filesystem caches, 100 samples after ten warmups.
Authored declaration validation measured 0.011541ms p50 / 0.015329ms p95, structural checking 0.000640/0.001037ms, compact payload rendering 0.000370/0.001010ms, module inspection 0.030866/0.046988ms and complete compact view assembly 0.181072/0.270909ms.
Original guarded evaluation with contract checks measured 0.365471/0.499987ms; complete refused-signal handling with existing persistence measured 5.848791/6.991587ms, within the P1 storage budget rather than the pure P0 check budget.
The TDD initial request plus MCP response text is 1,552B with the short exact guard or 1,549B with this authored contract, rendered one short line per field; including inspection yields 1,719B/1,883B respectively.
The saving is bounded by the 37B guard it replaces, so this view stays far above the 820B design estimate.
Byte counts include JSON request arguments and actual MCP response text, exclude JSON-RPC framing, tool definitions, process startup and model work, and are not token counts.
This metadata supplies typed payload guidance; it makes no universal byte or end-to-end latency savings claim.

### Judgment Waiting and Bookkeeping

Judgment orchestration is P0 bookkeeping: timer setup, adapter selection bookkeeping, result classification and telemetry must stay below 5ms of local work, excluding external adapter waiting and request serialization.
Timer and accounting primitives use P0 risk ceilings; configuration/classification helpers and cascade orchestration use P1/P2 risk ceilings with the same local-work target, excluding external waiting.
Whole-cascade accounting is O(a), where a <= 2 primary/fallback slots, independent of ledger history.
Request serialization and scoped-context processing are O(b + p), where b is selected input bytes and p is selected paths.
Telemetry uses the existing `GUARD_EVALUATED` append, with no additional storage operation.

`judgment.total_timeout_ms` optionally bounds all asynchronous selection, configuration and evaluation waiting in one cascade.
Every adapter receives the smaller of the remaining budget and an explicit per-attempt `timeout_ms` when supplied, plus cooperative cancellation.
Timer scheduling and synchronous event-loop blocking can delay timeout delivery; late results are refused when control returns.
Custom adapters must observe cancellation to stop their external work.
Without the total deadline, legacy retry and timeout behavior remains in effect; Jev retains its existing 3000ms adapter default and zero SDK retries.
Configured SDK clients are cached per adapter instance and invalidated when authentication, endpoint, model or log configuration changes.
Client reuse has no measured latency or network connection reuse claim.

`JudgmentResult.latencyMs` includes the entire cascade even when unevaluable, while `attempts[].elapsedMs` measures each invocation and records skips, timeout/cancellation cause and circuit outcome.
`attemptCount` excludes skips.
Fake-clock tests verify exact deadline and refusal accounting; they do not measure typical external model latency.
External waiting must be reported separately from P0 local budgets and never as zero on refusal.
See [the deadline contract](docs/specs/0023-judgment-deadlines.md) for opt-in semantics and compatibility.

Opt-in judgment input preparation and its content-free inspection view are P1 operations (< 25ms local target).
They cost O(p²*d*i + b + e) for p selected/checked paths, path depth d, largest selected array index i, selected JSON bytes b and non-empty checked string bytes/object keys e; parent/child overlap and contiguous-index checks account for the path term.
Payload numeric segments are limited to 10000 to bound the contiguous-index check on payload arrays.
Pure declarative payload preconditions and required-evidence validation run before adapter selection and refuse without a model request.
Explicit `precondition.non_empty` context/payload checks use the same preparation and refusal path, with shallow value checks and no additional I/O, model call or ledger append.
Presence-only declarations retain their existing semantics; non-empty checks examine only listed values, with constant work for nulls, booleans, numbers and array lengths and O(e) work for string trimming or own enumerable object keys.
No semantic result cache, cross-run reuse, new ledger append or full-history scan is added by input preparation.
The existing `GUARD_EVALUATED` record carries content-free `inputInspection` metadata on successes and failures.
`byteCount` counts candidate state JSON bytes, excluding SDK framing and questions; it is not a measurement of total remote request bytes or tokens.
Opt-in approval identity hashing is O(b + p²*d*i + e) and includes selected evidence, the judgment declaration and built-in adapter base URL and model, not credentials or log level.
Existing approval-event queries retain their P2 O(n) behavior; input selection does not add a history query.
Preparation/hash helpers target CC <= 12, branch coverage >= 80%, CRAP <= 15; pure path/type helpers target CC <= 8, branch coverage >= 90%, CRAP <= 10.
The AXI inspection view is P2 (< 100ms local target), with O(s + p²*d*i + b + e) work in manifest states s and input size, and opens no run.
Legacy judgments retain their existing input and evaluation order.
See [judgment input selection](docs/specs/judgment-input-selection.md) for the capability and inspection contract.

### Local evidence operations

Evidence is opt-in through manifest field declarations and the SDK `EvidenceStore` port.
Inline-only guard, replay, snapshot and projection paths do not open a registry.

| Operation | Tier and target | Complexity and bound |
|-----------|-----------------|----------------------|
| `LocalEvidenceStore.importFile` / `registerJson` | P1, <25ms target for a warm local file up to 1 MiB | O(bytes + source path depth), plus O(k log k) for sorting JSON object keys; default 1 MiB and configurable hard ceiling 16 MiB per blob |
| `EvidenceStore.read` / declared field resolution | P1, <25ms target for up to 1 MiB per selected field | O(selected bytes + pointer depth); verify registration, SHA-256, length, media type and encoding on each read |
| AXI/MCP evidence import, explicit read and `submitEvidenceSignal` | P2 cold bootstrap <100ms; P1 <25ms local evidence work per <=1 MiB field, excluding guards/judgments | O(cold replay delta + selected evidence bytes + pointer traversal/copies); at most 32 bindings, fixed 1 MiB import limit per file in the default transport store |
| Replay / snapshot evidence verification | P2, <100ms target for bounded local evidence | O(replayed events + selected evidence bytes); no mutable source reads or model calls |
| `exportRun` / `exportBundle` / `restoreBundle` | P3, <2000ms target for bounded bundles | O(events + all registered bytes); with declarations, bundles registrations referenced by committed events/snapshots and verifies unreferenced ones only to report damage in `skipped`; without declarations, bundles and verifies every registration |

Transport binding metadata stays outside task JSON and does not require additional event-ledger scans.
A folded import-and-emit uses one interface call; standalone registration then emit uses two, while explicit content read adds another call only when requested.
End-to-end latency must include bootstrap, registration, hashing, persistence, projections and transport overhead for the chosen flow; the per-field budget does not cap a multi-field submission's total time.
Keyed retries consult the existing indexed signal record before reopening an import source, then retain core idempotency semantics.

These targets are budgets, not measured end-to-end model savings or guaranteed filesystem latency.
Hashing, parsing, copying, directory checks, atomic publication and file/directory synchronization add real storage cost to a reference submission.
Each reference occurrence is verified; there is no unverified cross-turn content cache.
Large evidence or repeated references can exceed the ordinary signal/projection latency target; measure evidence IO separately from P0 guard bookkeeping.
Registration uses a bounded descriptor read, a synced temporary copy and non-overwriting publication; abandoned temporary files are ignored and no retained blobs are garbage-collected.
Export scoping and failure rules are owned by [docs/evidence-registry.md](docs/evidence-registry.md).

### Accepted context recovery

Initialization and accepted transitions record their effective `contextUpdates` patch in the existing ledger event, including declarative lifecycle assignments in execution order.
Patch construction is P1 bookkeeping (<25ms target), O(d² + a + k + b), where d is hierarchy depth, a is the affected hook count, k is declared signal context keys and b is copied assignment bytes.
It adds no ledger rows or history queries; the serialized patch adds its actual bytes to the existing append.
Rehydration remains P2 (<100ms target), O(delta events + context patch bytes + selected evidence bytes), and applies committed patches without executing hooks, guards, signals or projections.
Events predating recorded patches replay only their accepted signal updates; the installed manifest cannot supply authoritative historical hook assignments.
Ledgers written before recorded patches therefore rely on their snapshot for hook-assigned context, and a no-snapshot replay of such a ledger does not reconstruct it.

### 1. Algorithmic Complexity (Big-O)

#### Allowed Patterns

| Pattern | Complexity | When to Use |
|---------|------------|-------------|
| Active State Path Lookup | $O(d)$ where $d \le 5$ (nesting depth) | Retrieving active `StateDefinition` hierarchy |
| Guard Expression Evaluation | $O(1)$ | Evaluating sandboxed predicate expressions |
| Event Append & SQLite WAL Write | $O(1)$ insert + $O(k + b + C + c)$ JSONL mirror, $k$ = new rows, $b$ = new bytes, $C$ = 64 KiB, $c$ = certificate chunk metadata | Append only rows after the skill-wide checkpoint; hash the old partial chunk and new bytes, retaining completed chunk digests |
| JSONL Mirror Checkpoint Verification | $O(B + c)$ time, $O(C + c)$ memory, $B$ = bytes across every current and rotated segment | P2 store open verifies the complete ordered inventory, byte lengths, SHA-256 chunk digests, ledger generation, schema and global boundary before skipping object reconciliation; a newer canonical tail uses a bounded indexed query |
| JSONL Mirror Full Reconcile | $O(N + B)$ where $N$ = events across all runs | Missing, stale or uncertain checkpoints, any segment mismatch, explicit repair (`syncJsonlFromSqlite()`), and interrupted mirror writes delegate to the unchanged full reconciler: it appends missing canonical rows, rewrites only for a gap below the mirrored maximum, keeps malformed and JSONL-only rows, then certifies the resulting bytes |
| Snapshot Point-in-Time Lookup | $O(1)$ | Querying `snapshots` table by max sequence |
| Handlebars Prompt Slicing | $O(t)$ where $t$ = template size | Generating turn prompt from cached template delegate |
| HSM Event Bubbling | $O(h)$ where $h$ = ancestry depth | Propagating unhandled signals from leaf to root |

Clean certified opens decode only the bounded recent-event cache and replay after the latest snapshot.
They still read every JSONL byte: detecting arbitrary external edits requires O(B) verification under the usual cryptographic collision assumption.
Constant-time stat, active-file-only and tail-only checks do not preserve the repair guarantee.
Older stores receive a full reconcile before their first certificate is published.
The certificate is skill-wide, covers every run, and records a captured global ledger boundary under the projection lock.
It is published by atomic rename only after synchronous mirror writes succeed; the existing mirror contract does not promise power-loss fsync durability.
Failed mirror or certificate writes leave SQLite canonical, and open verifies the surviving certificate before extending a tail or repairing uncertainty.
Clear, rebuild, migration and database replacement change the ledger generation or rebuild certification; rotation retains completed chunk digests under the renamed segment.
Certificate parsing and atomic publication cost O(c) metadata per append, separately from the bounded incremental hashing work.

#### Forbidden Anti-Patterns

| Anti-Pattern | Why Forbidden | Remediation |
|--------------|---------------|-------------|
| Full Event Stream Scan on Turn | Scales $O(N)$ with total history | Use indexed sequence queries or in-memory current state |
| Re-reading & Re-compiling Templates | Redundant disk I/O and AST parsing | Cache compiled Handlebars delegates in `Map<string, TemplateDelegate>` |
| Unbounded JSONL In-Memory Buffering | Memory leaks on long-running sessions | Stream JSONL or query SQLite driver directly |
| Re-rendering All Projections on Every Signal | Unnecessary disk I/O on every tick | Enforce `trigger_on` signal filters in `DeliverableProjection` |
| Synchronous Child Process Spawning in Guards | Adds 50–200ms process overhead | Execute guards within sandboxed V8 functions |

---

### 2. Code Complexity & Change Risk (The CRAP Method)

The Change Risk Anti-Patterns (CRAP) score quantifies the defect risk of functions based on Cyclomatic Complexity ($comp$) and branch test coverage ($cov \in [0, 1]$):

$$\text{CRAP}(m) = \text{comp}(m)^2 \times (1 - \text{cov}(m))^3 + \text{comp}(m)$$

#### CRAP Ceilings by Tier

| Tier | Latency Target | Max Cyclomatic Complexity (CC) | Min Branch Coverage | Max CRAP Threshold | Invariant |
|------|----------------|--------------------------------|---------------------|--------------------|-----------|
| **P0 - Interactive Hot Path** | < 5ms | CC <= 8 | >= 90% | **CRAP <= 10.0** | Zero untested branching in state loop |
| **P1 - Responsive Storage** | < 25ms | CC <= 12 | >= 80% | **CRAP <= 15.0** | Core persistence fully verified |
| **P2 - Lifecycle & Streaming** | < 100ms | CC <= 15 | >= 70% | **CRAP <= 25.0** | Rehydration & error recovery tested |
| **P3 - Batch & Migration** | < 2000ms | CC <= 20 | >= 60% | **CRAP <= 30.0** | Migration safe-guards verified |

> **Hard Ceiling**: Any function with $comp > 30$ fails the CRAP gate automatically regardless of test coverage ($30^2 \times 0 + 30 = 30$). High complexity cannot be tested away; it must be decomposed.

---

## Token Economy & Metrics Framework

### Exact transport-cost fixture (P3)

`packages/runtime/scripts/transport-benchmark/cli.ts` measures real MCP SDK calls, SDK views and fresh-process AXI commands using pinned public fixtures.
Run it after building runtime and AXI; [fixture instructions](packages/runtime/scripts/transport-benchmark/README.md) define each byte/timing field and the historical/current baselines.
Accounting is O(b) in serialized bytes, with O(b*r) normalization for a bounded number of scratch roots; offline ledger inspection is O(e+b) in fixture events and stored bytes.
These scans occur outside timed runtime operations and never append measurement events.
The fixture reads post-persistence `transition_total_ms` from existing `TRANSITION_COMPLETED` records and SDK results, alongside the separate pre-persistence `STATE_TRANSITION` metrics.
The operation is P3, with the existing per-operation target below 2,000ms, CC target <= 20, branch coverage target >= 60% and CRAP target <= 30; aggregate trace duration has no fixed latency assertion.
Each function's inline budget records measured values: CC from ESLint's core `complexity` rule summed over the function's span including nested callbacks, branch coverage from `@vitest/coverage-v8` branches within the function's span over `tests/transport-benchmark.test.ts` and `tests/transport-benchmark-axi-failures.test.ts` with runtime and AXI built, and CRAP = CC² × (1 − coverage)³ + CC.
Every measured function meets the 60% branch-coverage target; the network fence runs only in child processes, so its coverage is not measured.
Cold AXI process time and persistent MCP handler/in-memory round-trip time are distinct observations.
MCP text, result-object and full stdio-envelope bytes are distinct from input payload, authored Markdown, rendered prompt and artifact-read bytes.
Byte counts are never token counts; native token heuristics are labeled and normalized independently.
Actual model calls/output are zero in the default offline trace; scripted input is reported separately as a proxy.
The fixture retains per-run ledger/visit counts and every JSONL segment's size, with no claim that unvisited source branches were delivered to a model.
Snapshot restore and full replay must match live accepted context; any mismatch fails the fixture (see [Accepted context recovery](#accepted-context-recovery)).
No public runtime capability is added by this developer-only operation.

### 1. Workflow Execution and Context Accounting

Reactive Skills executes declared workflows as state machines with guards and an event log.
It exposes state-specific instructions as the workflow advances, so instructions for unvisited branches can remain unread.
Context use depends on the path, payloads, interface and host transcript behavior; no general percentage reduction is claimed.

1. **Delivered Context Measurement**:
   - Measure complete delivered instructions, tool arguments, results and carried transcript prefixes on both sides; source slices alone do not establish a token reduction.
   - Record which state instructions and references were read, including revisits and recovery fetches.
   - Include tool schemas as delivered by the host; an `allowed_tools` list alone does not establish that schemas were removed from the model prompt.
   - Account for projection output and artifact reads when comparing workflows that generate summaries through read models.

2. **Agent Convergence Velocity (Behavioral Reduction)**:
   - **Loop Elimination**: Deterministic transition guards (`exit_code == 0`, schema validators) prevent premature completion or aimless loops.
   - **Bypass Detection**: `max_idle_turns` immediately halts ungrounded turns; up to `max_view_refetches` (default 2) repeat fetches of the same view are uncounted for compaction recovery, using a bounded trailing-event scan plus an indexed local recovery-credit lookup (P1).
   - **Regression Bubbling**: Failing tests instantly bubble back to exact remediation states (`GREEN_CODE` or `RED_SPEC`) rather than allowing the model to wander.

---

### 2. Runtime Instrumentation Architecture

To characterize context delivery and detect latency degradation:

1. **Nanosecond Timers**: Utilize `performance.now()` (V8 monotonic timer, ~15ns overhead) across boundaries.
2. **Telemetry Envelope in Existing Events**: Embed execution durations and token estimates into standard event payloads (`STATE_TRANSITION`, `GUARD_EVALUATED`) without adding supplementary I/O operations:

```typescript
export interface ExecutionTelemetryMetadata {
  /** Duration in milliseconds for prompt slice generation */
  slice_duration_ms: number;
  /** Estimated tokens at four UTF-8 bytes per token; see delivery scope below */
  slice_tokens_est: number;
  /** Pre-persistence portion: signal receipt through guard evaluation and target resolution; stamped before the transition is persisted and carried in `STATE_TRANSITION` */
  transition_duration_ms: number;
  /** Duration in milliseconds from signal receipt through the persisted transition, snapshot save and projections; persisted in the `TRANSITION_COMPLETED` event appended after projections and returned by handleSignal(); excludes queued lifecycle signals */
  transition_total_ms: number;
  /** Count of tools allowed in active substate */
  allowed_tools_count: number;
}
```

The `slice_tokens_est` metric is a byte heuristic, not a measurement from a model tokenizer.
Core prompt slicing initially estimates `ceil(Buffer.byteLength(formattedXml, 'utf8') / 4)`.
MCP `reactive_state`, active-state `reactive_context_prepare` and opted-in continuation responses instead expose a delivery estimate in their state `metrics`: `ceil(UTF-8 bytes of the complete compact JSON response text / 4)`.
This includes escaped prompt text, scoped context, routing metadata where present, and the estimate field itself.
Serialization stabilizes the estimate before returning the response, including when its decimal digit count changes.
It updates the live engine's latest slice metrics so the next transition records the delivered estimate.
These in-memory metrics are not restored across process restarts; re-fetch state to establish a fresh delivery estimate.
The delivery estimate excludes SDK JSON-RPC framing, tool definitions, and other harness context.
AXI renders its own output from the core slice; core XML estimates must not be presented as AXI transport measurements.

MCP state assembly and serialization are P0 operations with O(b) work in response bytes.
In strict mode each MCP/CLI delivery adds one bounded O(w) trailing-event read for same-view refetch accounting, where w = 4 × (`max_view_refetches` + `max_idle_turns` + 2) events (24 by default).
Legacy responses contain one XML prompt and scoped context; `include_full_context: true` on `reactive_state` adds the full recorded context.
That response grows with recorded context and is included in its delivery estimate.
The serializer targets CC <= 8, branch coverage >= 90%, and CRAP <= 10.

Negotiated `state.compact_v1` delivery builds one shared complete view and serializes compact JSON (or development `xml-v1`).
The view contains one raw rendered prompt and one scoped context object; full-context opt-in replaces that object rather than duplicating it.
State view building and rendering target P0 (< 5ms for bounded state content), CC <= 8 per helper, branch coverage >= 90%, and CRAP <= 10.
Building costs O(h² + b + a + w): hierarchy depth h, view/contract bytes b, existing approval-request/decision query results a, and the bounded trailing-event window w.
Rendering is O(b), preserves required values without truncation, and adds no events or projections.
The sequence anchor is the last view-changing event, found by one latest-sequence lookup plus a bounded O(w) trailing-event read that skips delivery bookkeeping and telemetry; when the window holds no view-changing event it falls back to the latest event sequence, so repeated telemetry can advance it in non-strict runs. The anchor is informational and does not affect guards or strict counting.
The most recent refusal is restored from the already loaded replay delta (O(r) worst case) and cached for O(1) retrieval in state views.
A subsequent emitted signal clears it; a new refusal replaces it without adding events.
Pending judgment approvals use the existing approval read path; its history cost is not claimed to be constant.
Existing prompt slicing and cold-open replay costs are additional and unchanged.
MCP compact delivery updates the existing live byte estimate but omits telemetry from the model-facing view.
AXI output bytes and XML bytes are distinct from MCP response bytes; no transport savings percentage is claimed by this change.

MCP `state.continuation_v1` operations deliver the same complete compact view after signal/human response work settles.
`mcp/continuation-response.ts` queues same-process MCP mutation operations per immutable run with O(1) map bookkeeping and refreshes the engine before work; waiting for earlier operations and external judgments is outside local P0/P1 budgets.
View assembly/serialization remains P0 with O(b + h² + a + w) work in view bytes b, ancestry h, existing approval-query results a and bounded delivery window w.
The serialized-byte heuristic covers the entire continuation envelope, including its receipt, original anchor and current view, without exposing another metrics block.
Keyed operations add one P1 (<25ms target) `MCP_CONTINUATION_RECORDED` append containing only receipt metadata and an original view anchor; unkeyed operations add no receipt event.
Duplicate lookup uses the existing indexed idempotency key and an indexed O(k) causation query for that submission's child events, without a full-run scan.
Receipt events are ignored by the bounded delivery scan so they do not reset compaction refetch allowance or create an idle turn.
Original submissions call `recordStateDelivery()` once; saved-receipt retries add no delivery/refetch or other execution events.
Interrupted emit/human-response recovery records a credit in the additive `recovered_deliveries` SQLite table keyed by `(run_id, view_seq)`, independently of execution sequence, run version, snapshots and JSONL.
Recording a credit and reading one view's credit are P1 (<25ms target), using primary-key and run-sequence indexes; writes cost O(log D + log N + w) for D credits, N indexed events and the bounded view window w.
Strict view/refetch scanning remains bounded O(w), plus O(log D) to include an unabsorbed recovery credit.
Strict counter/bypass reads are P1 with O(log N + log D + d) work over d candidate credits since the latest signal/transition; indexed `(run_id, type, seq)` lookups find that boundary, and the query stops after `max_idle_turns + 1` unabsorbed credits.
An original keyed ledger append atomically marks only its matching view's credit as absorbed, so another recovered view from that same submission keeps its own turn.
The view anchor is storage metadata and adds no event-payload or response field.
Non-SQLite SDK stores retain credits only in memory: view lookup is O(1) and counter reads cost O(n + D) for n retained events; MCP uses SQLite.
Delivery metadata helpers target CC <=8, branch coverage >=80% and CRAP <=15.
No full-history event materialization, JSONL mirror write or run-version increment is added to recovery.
Recovered and saved-receipt continuation rendering disables prompt-slice telemetry appends; in-memory metrics remain available without invalidating a pending guard.
The additive run/type/sequence index costs O(N log N) on its first installation during store open; subsequent opens reuse it.
Local delivery metadata is omitted from event exports and cleared by an explicit SQLite rebuild or run deletion.
`mcp/human-response.ts` dispatches at most two existing human signals before one view delivery, retaining their current precedence and CLI-only judgment approval boundary.
Queue/receipt/render helpers target CC <= 8, branch coverage >= 90%, CRAP <= 10; human orchestration targets CC <= 12, branch coverage >= 80%, CRAP <= 15.
Cold replay and existing guard, evidence, child, projection and approval costs remain additional.
Tests verify event/turn counts and the pinned public TDD continuation path; this change makes no end-to-end latency or model-token savings claim.

MCP `state.delta_v1` views reuse the complete view assembly and add one indexed read of the events after the anchor sequence.
`core/context-ledger.ts` folds the committed context patches in that window with the replay rules: P1 (<25ms target), O(e + p) for e events and their patch keys, CC <= 12, branch coverage >= 90%, CRAP <= 15.
Delta assembly is P1 with O(h² + b + a + w + e + s) work, adding supplied-value bytes s for the accepted-key comparison; it targets CC <= 8, branch coverage >= 90% and CRAP <= 10.
The per-session anchor map in the MCP server is O(1) per delivery and holds one sequence per delivered run.
An unfoldable window falls back to the complete view instead of a partial one.

Automatic evidence references (`inlineEvidenceBindings` in `core/evidence-submission.ts`) are P1 (<25ms target per <=1MiB registered value) with O(declared fields × pointer depth + converted bytes) work, CC <= 8, branch coverage >= 90%, CRAP <= 10.
They run only for signals with declared evidence fields and string values at or above `AUTO_EVIDENCE_MIN_BYTES` (300 UTF-8 bytes by default), reuse content-addressed registration, and skip keyed retries.
The default threshold is the smallest size in a matched pilot sweep at which conversion delivered no more bytes than inline text, with and without one resume; it is a measured default, not a size guarantee for other workloads.

AXI `state`, `invoke`, and implicit-causation `emit` obtain their response/event anchors through the existing public `EventStore.getLatestEvent()`.
SQLite uses the `(run_id, seq)` index with descending order and `LIMIT 1`: O(log N + b) for N indexed events and b bytes in the one returned event; the in-memory fallback uses the last retained entry in O(1).
No full-history query is permitted solely to obtain a latest event; cold replay without a snapshot may still read the selected history.
The latest-event query is P1 (<25ms target) and retains the selected immutable run, including when another run appends to the shared ledger.
An offline warm-cache probe on Node v22.23.3/Linux measured 100 latest-event reads after 10 warmups at 100/1,000/10,000/50,000 events: p50 0.018/0.026/0.035/0.032ms, p95 0.024/0.039/0.045/0.069ms.
The former full-history read at 50,000 events measured p50 245.871ms/p95 284.645ms over 30 reads after 10 warmups with 240-byte payload text.
These are isolated store-read measurements, excluding process startup, ledger verification, replay, prompt construction and model work; they are not an end-to-end savings claim.
AXI guidance consumes negotiated compact invoke/emit views and reserves state reads for resume, compaction, stale state or response recovery; output defaults and existing strict-turn behavior are unchanged.

3. **Degradation Detection Thresholds**:
   - `slice_duration_ms > 10ms` $\rightarrow$ Warning: Template cache miss or heavy filesystem access.
   - `transition_total_ms > 25ms` $\rightarrow$ Warning (`PERF_DEGRADATION`, after `TRANSITION_COMPLETED`): Slow guard evaluation, SQLite contention, snapshot save or projections.
   - `idle_turns >= max_idle_turns` $\rightarrow$ Alert: Agent looping without emitting signals.

---

### 3. How to View and Query Metrics

#### A. JSONL Event Log Inspection
Every `STATE_TRANSITION` event record contains embedded telemetry metadata:
```json
{
  "seq": 4,
  "type": "STATE_TRANSITION",
  "state": "GREEN_CODE",
  "payload": {
    "from": "RED_SPEC",
    "to": "GREEN_CODE",
    "signal": "TEST_RAN",
    "metrics": {
      "transition_duration_ms": 1.151,
      "slice_duration_ms": 0.922,
      "slice_tokens_est": 282
    }
  }
}
```

Tail latest transition metrics via shell:
```bash
# PowerShell
Get-Content .reactive/skills/<skill>/events.jsonl | ConvertFrom-Json | Where-Object { $_.type -eq "STATE_TRANSITION" } | Select-Object -ExpandProperty payload | Select-Object from, to, metrics

# jq
cat .reactive/skills/<skill>/events.jsonl | jq 'select(.type == "STATE_TRANSITION") | {from: .payload.from, to: .payload.to, metrics: .payload.metrics}'
```

#### B. Direct SQLite SQL Queries (`events.db`)
Execute SQL queries against `.reactive/skills/<skill>/events.db`:
```sql
SELECT 
  seq, 
  timestamp, 
  json_extract(payload, '$.from') as from_state,
  json_extract(payload, '$.to') as to_state,
  json_extract(payload, '$.metrics.transition_duration_ms') as transition_ms,
  json_extract(payload, '$.metrics.slice_tokens_est') as prompt_tokens
FROM events 
WHERE type = 'STATE_TRANSITION';
```

#### C. Programmatic SDK Access
Access live metrics directly from `FSMEngine`:
```typescript
import { FSMEngine } from '@reactive-skills/runtime';

const engine = new FSMEngine({ skillDir: './skills/my-skill' });

// 1. In-turn prompt slice metrics:
const slice = engine.generatePromptSlice();
console.log(slice.metrics);
// => { slice_duration_ms: 0.23, slice_tokens_est: 282, allowed_tools_count: 4 }

// 2. State transition metrics:
const res = await engine.handleSignal('TEST_RAN', { exit_code: 0 });
console.log(res.metrics);
// => { transition_duration_ms: 1.05, slice_duration_ms: 0.23, slice_tokens_est: 282, transition_total_ms: 3.4 }
```

#### D. Inspecting Performance Degradation Alarms
Filter for alarm events when an operation exceeds configured latency budgets:
```bash
# PowerShell
Get-Content .reactive/skills/<skill>/events.jsonl | ConvertFrom-Json | Where-Object { $_.type -eq "PERF_DEGRADATION" }
```

---

## Caching Standards

### Cache Tiers

| Tier | Strategy | TTL / Invalidation | Use Case |
|------|----------|--------------------|----------|
| **L1 - In-Process Template Cache** | `Map<string, HandlebarsTemplateDelegate>` | Invalidate on file modification | Compiled prompt templates |
| **L2 - In-Process State Path Cache** | Key-value dictionary | Immutable per loaded manifest | Pre-resolved substate paths |
| **L3 - SQLite Page Cache & WAL** | `PRAGMA cache_size = -2000` (2MB) | Process lifetime | Fast ACID reads/writes for events |
| **L4 - Event Store Snapshots** | Point-in-time state records | Appended every 50 events | Fast rehydration without full event replay |

### Invalidation Rules

- **Templates**: Cache compiled Handlebars delegates by file mtime or path; reload only when disk contents change.
- **State Manifest**: Parsed YAML and validated Zod schemas are immutable once loaded into `FSMEngine`.
- **Projections**: Never re-render on every signal; execute only when matching `trigger_on` signal specifications or explicit transition boundaries.

---

## Common Patterns: Good vs Bad

### 1. Template Compilation

#### ❌ Bad: Reading and compiling templates on every agent turn
```typescript
// Anti-pattern: Synchronous disk read and template compile on every turn (P0 violation)
public generatePromptSlice(): PromptSlice {
  const content = fs.readFileSync(this.templatePath, 'utf8'); // Disk I/O: 1-3ms
  const compiled = Handlebars.compile(content);                // AST compilation: 2-5ms
  const rawPrompt = compiled(this.context);
  return { rawPrompt, ... };
}
```

#### ✅ Good: Pre-compiling or memoizing compiled delegates
```typescript
// Pattern: Compile once, execute from memory in < 0.2ms
private templateCache = new Map<string, HandlebarsTemplateDelegate>();

public generatePromptSlice(): PromptSlice {
  let compiled = this.templateCache.get(this.templatePath);
  if (!compiled) {
    const content = fs.readFileSync(this.templatePath, 'utf8');
    compiled = Handlebars.compile(content);
    this.templateCache.set(this.templatePath, compiled);
  }
  const rawPrompt = compiled(this.context);
  return { rawPrompt, ... };
}
```

---

### 2. Event Store Queries

#### ❌ Bad: Scanning all events in memory to find the latest state
```typescript
// Anti-pattern: O(N) memory scan across entire historical event log
public getCurrentState(): string {
  const allEvents = this.eventStore.getAll(); // Parses entire JSONL/SQLite log
  const transitions = allEvents.filter(e => e.type === 'STATE_TRANSITION');
  return transitions[transitions.length - 1]?.payload.to || this.manifest.initial_state;
}
```

#### ✅ Good: Maintaining active state in memory with snapshot support
```typescript
// Pattern: O(1) state resolution from memory pointer
public getCurrentState(): string {
  return this.activeStatePath.join('.');
}

// And on cold start, query indexed SQLite snapshots:
const snapshot = this.eventStore.getLatestSnapshot(); // O(1) indexed lookup
const deltas = this.eventStore.getSince(snapshot ? snapshot.seq : 0); // O(k) delta replay
```

---

### 3. Guard Evaluation

#### ❌ Bad: Spawning child processes or using full vm2 sandboxes for simple checks
```typescript
// Anti-pattern: Child process execution takes 50-100ms
import { execSync } from 'node:child_process';
function checkGuard(expr: string, payload: any): boolean {
  return execSync(`node -e "process.exit(${expr} ? 0 : 1)"`).status === 0;
}
```

#### ✅ Good: Fast in-process sandboxed function evaluator
```typescript
// Pattern: Evaluates in < 0.05ms with safe argument passing
export class GuardEvaluator {
  public static evaluate(guardExpr: string, event: SignalEvent, context: Record<string, any>): boolean {
    try {
      const fn = new Function('event', 'context', 'payload', `"use strict"; return Boolean(${guardExpr});`);
      return Boolean(fn(event, context, event.payload));
    } catch {
      return false;
    }
  }
}
```

---

## Pre-Implementation Checklist

Before committing changes to `@reactive-skills/runtime` or `@reactive-skills/axi`:

```
Tier & Latency Targets
[ ] What tier does this operation belong to? (P0/P1/P2/P3)
[ ] Is P0 latency guaranteed under 5ms?
[ ] Is P1 storage overhead guaranteed under 25ms?

Algorithmic Budget
[ ] What is the Big-O complexity?
[ ] Is there any O(N) scan that could scale with session event count?
[ ] Are lookups performed via hash keys, pre-resolved arrays, or indexed SQLite columns?

Change Risk (CRAP) Planning
[ ] Is Cyclomatic Complexity under CC <= 8 for P0 or CC <= 12 for P1?
[ ] Are branch test cases planned for every guard and transition path?
[ ] Is expected CRAP score <= 10.0 for hot paths?

Data Access & Storage
[ ] Does this operation write to EventStore? Is it using WAL mode?
[ ] Are projections triggered conditionally via trigger_on rather than on every signal?
[ ] Is disk I/O eliminated from the prompt slice path via in-memory caching?
```

---

## Post-Implementation Checklist

After code changes are written:

```
Verify Performance
[ ] Benchmarked with micro-timers (performance.now() verification)?
[ ] Verified prompt slice generation remains < 1ms?
[ ] Verified handleSignal() with SQLite persistence remains < 5ms?
[ ] Verified zero memory leaks in event listeners or template caches?

Verify Change Risk (CRAP)
[ ] Measured Cyclomatic Complexity (CC) of all modified methods?
[ ] Ran test suite: `pnpm test` and `pnpm test:axi` passing at 100%?
[ ] Branch coverage meets or exceeds tier thresholds (>= 90% for P0, >= 80% for P1)?
[ ] Zero functions with CC > 30?

Documentation
[ ] Inline TSDoc annotations added to functions specifying Tier, Big-O, and CRAP budget?
[ ] Updated context/progress-tracker.md if architectural boundaries changed?
```

---

## Performance Annotations

### Offline mods image capture

`apps/site/src/features/mods/images/capture.mjs` is a P3 authoring operation, outside the site request path.
Local fixture recording, mod formatting and HTML preparation target <2000ms per operation, with O(e + m + b) work in the bounded demo events, pinned manifest and output bytes.
Duration-bar substitution and live-pane column layout remain O(b) in bounded terminal bytes; bars use one CSS rectangle per original bar and the state list sits beside the plan.
Browser navigation, font readiness and capture are external waits with a 60-second timeout per command; this is a timeout, not a measured latency claim.
The three PNGs are rendered at 2× (1680 pixels wide), optimized with the existing Sharp dependency and each capped at 250 kB by the site tests.
The bundled font, host adapter and capture dependencies are authoring inputs; the site imports only the PNGs and adds no client capture code.
The static mods page remains P3 with O(m + f + i) rendering in mods, features and images.
Capture helpers target CC <=20, branch coverage >=60% and CRAP <=30; these are targets, not measured coverage claims.

Document performance and change risk inline in TypeScript source:

```typescript
/**
 * Generates the prompt slice for the active state hierarchy.
 *
 * # Performance & Risk Budget
 * - Tier: P0 (< 5ms)
 * - Complexity: O(d) where d = state hierarchy depth (d <= 5)
 * - Cyclomatic Complexity (CC): 6
 * - Branch Coverage: 95%
 * - CRAP Score: 6.0 (Threshold <= 10.0)
 * - Caching: L1 Handlebars compiled template delegate cache
 */
public generatePromptSlice(): PromptSlice { ... }
```

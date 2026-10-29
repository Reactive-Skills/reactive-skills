# Reactive Skills Architecture (RSA) Performance Engineering Standards

## Philosophy

> "The reactive state machine must never be the latency bottleneck in an agent reasoning loop: state transitions, guard evaluations, and prompt slicing must execute in sub-millisecond to single-digit millisecond time, while slashing prompt token overhead by 80% to 95%."

Reactive Skills Architecture (RSA) introduces deterministic structure to autonomous agent execution. While LLM inference spans 1,000ms to 15,000ms per turn, the RSA runtime tax must remain strictly under 0.1% of turn latency. Conversely, by slicing prompts down to active substates and scoping tool definitions, RSA achieves significant reductions in token consumption and eliminates agent loop thrashing.

---

## Performance Tiers

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
Replay's known entry-hook context discrepancy is reported as a named expected baseline failure, not suppressed or repaired here.
No public runtime capability is added by this developer-only operation.

### 1. The Value Dimension: What Do We Save?

Reactive Skills provides two compounding categories of savings:

1. **Prompt Context Economy (Direct Token Reduction)**:
   - **Monolithic Skill Prompt**: Traditional skills inject their entire markdown body (often 1,500–6,000 tokens) on *every single turn*.
   - **Reactive Sliced Prompt**: In RSA, only the active leaf state's instructions (typically 150–400 tokens) and filtered `allowed_tools` are injected.
   - **Tool Schema Scoping**: Restricting available tools from 20+ down to 2–4 tools removes 3,000+ tokens of JSON Schema definitions from the model's system payload.
   - **Read-Model Offloading**: Summary documents are generated by Handlebars projections rather than requesting the model to repeatedly re-author status summaries.

$$\text{Tokens Saved} = \sum_{t=1}^{\text{Turns}} \left( \text{Tokens}_{\text{Monolithic}} - \text{Tokens}_{\text{Slice}(t)} \right)$$

   *Typical Gain*: An 8-turn task with a 3,500-token skill prompt consumes 28,000 prompt tokens in traditional mode vs ~2,800 prompt tokens in RSA (a ~90% token reduction).

2. **Agent Convergence Velocity (Behavioral Reduction)**:
   - **Loop Elimination**: Deterministic transition guards (`exit_code == 0`, schema validators) prevent premature completion or aimless loops.
   - **Bypass Detection**: `max_idle_turns` immediately halts ungrounded turns; up to `max_view_refetches` (default 2) repeat fetches of the same view are uncounted for compaction recovery, using a bounded trailing-event scan (P0).
   - **Regression Bubbling**: Failing tests instantly bubble back to exact remediation states (`GREEN_CODE` or `RED_SPEC`) rather than allowing the model to wander.

---

### 2. Zero-Overhead Instrumentation Architecture

To measure token savings and detect latency degradation without introducing runtime penalties:

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
MCP `reactive_state` and active-state `reactive_context_prepare` responses instead expose a delivery estimate in their state `metrics`: `ceil(UTF-8 bytes of the complete compact JSON response text / 4)`.
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

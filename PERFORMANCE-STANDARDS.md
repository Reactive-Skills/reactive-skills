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

### 1. Algorithmic Complexity (Big-O)

#### Allowed Patterns

| Pattern | Complexity | When to Use |
|---------|------------|-------------|
| Active State Path Lookup | $O(d)$ where $d \le 5$ (nesting depth) | Retrieving active `StateDefinition` hierarchy |
| Guard Expression Evaluation | $O(1)$ | Evaluating sandboxed predicate expressions |
| Event Append & SQLite WAL Write | $O(1)$ | Appending signal events to immutable ledger |
| Snapshot Point-in-Time Lookup | $O(1)$ | Querying `snapshots` table by max sequence |
| Handlebars Prompt Slicing | $O(t)$ where $t$ = template size | Generating turn prompt from cached template delegate |
| HSM Event Bubbling | $O(h)$ where $h$ = ancestry depth | Propagating unhandled signals from leaf to root |

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
   - **Bypass Detection**: `max_idle_turns` immediately halts ungrounded turns.
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
  /** Estimated tokens in active prompt slice */
  slice_tokens_est: number;
  /** Duration in milliseconds for signal handling and guard evaluation */
  transition_duration_ms: number;
  /** Count of tools allowed in active substate */
  allowed_tools_count: number;
}
```

3. **Degradation Detection Thresholds**:
   - `slice_duration_ms > 10ms` $\rightarrow$ Warning: Template cache miss or heavy filesystem access.
   - `transition_duration_ms > 25ms` $\rightarrow$ Warning: Slow guard evaluation or SQLite contention.
   - `idle_turns >= max_idle_turns` $\rightarrow$ Alert: Agent looping without emitting signals.

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

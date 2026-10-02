# Specification: Runtime Performance Hardening

Status: Proposed.

Target: `@reactive-skills/runtime`, runtime performance tests, and `PERFORMANCE-STANDARDS.md`.

Related specifications: `docs/specs/0007-skill-scoped-event-ledger.md` and `PERFORMANCE-STANDARDS.md`.

## 1. Problem Statement

SQLite event appends currently reconcile the complete JSONL projection after each event.

Projection rendering retains and recopies event history and rebuilds transition arrays on matching signals.

Guard evaluation repeats JSON cloning, VM context creation, and script compilation.

Prompt slicing performs synchronous filesystem probes after the engine has loaded its state definitions.

Context candidate discovery rescans and reparses metadata on every request.

The performance test thresholds are relaxed on CI and Windows and do not cover the documented large-run sizes.

The performance standard contains conflicting latency targets, a snapshot cadence mismatch, and an unsafe `new Function` guard example.

## 2. Scope

Remove history-proportional work from steady-state SQLite appends while keeping SQLite canonical and JSONL export recoverable and ordered by `ledger_seq`.

Make projection updates incremental and avoid copying or rescanning unchanged events.

Reduce repeated guard, prompt-slice, and context-discovery work without changing guard isolation or public prompt results.

Align snapshot policy and performance gates with the confirmed standard.

Correct the guard example and contradictory performance guidance without manually editing generated changelogs.

## 3. Recommended Design

Use a SQLite-backed JSONL export cursor and indexed `ledger_seq` reads for steady-state projection progress.

Keep full reconciliation for startup recovery and explicit repair, and keep projection failures from invalidating committed SQLite events.

Preserve JSONL ordering, rotation, idempotency, concurrent-writer behavior, and recovery after interruption.

Update projection event and transition read models from new events without spreading or filtering the complete cached history on every projection run.

Preserve the current template context unless the user approves a bounded-history contract change.

Cache compiled `vm.Script` instances by guard expression while creating a fresh sanitized VM context and preserving the current timeout for each evaluation.

Never use `new Function` to evaluate untrusted guard expressions.

Resolve active state definitions and template paths when the engine loads or transitions, so steady-state prompt slicing does not probe the filesystem.

Document that loaded skill templates are immutable for an engine lifetime unless an explicit reload path is added.

Cache discovered candidate metadata and invalidate it when the source metadata changes.

Use the performance tier table as the proposed normative target and treat stricter checklist values as stretch goals unless the user chooses otherwise.

Use the documented 50-event snapshot interval unless the user chooses to retain per-transition snapshots.

## 4. Open Decisions

### 4.1 Projection Template History

Option A preserves the current full-history `events` and `transitions` template contract and optimizes its incremental maintenance.

Option B bounds `events` by default and requires explicit opt-in for full history, reducing memory but changing existing template output.

Recommended: Option A for compatibility, with full-history projections measured and documented as output-size dependent.

### 4.2 Normative Latency Targets

Option A uses the tier table targets of P0 under 5 ms and P1 under 25 ms, while treating the 1 ms and 5 ms checklist values as stretch goals.

Option B enforces the stricter checklist values of P0 under 1 ms and P1 under 5 ms as release gates.

Recommended: Option A to align CI gates with the named tier budgets and avoid flaky timing gates.

## 5. Acceptance Criteria

1. A steady-state SQLite append does not scan or parse full event history.

2. JSONL projection progress is tracked in SQLite and advances in `ledger_seq` order.

3. Concurrent append, idempotency, rotation, mirror failure, and reopen-repair behavior remain correct.

4. Projection output remains byte-for-byte compatible for existing templates unless the user approves Option B.

5. Projection updates do not copy or rescan unchanged history on each matching signal.

6. Guard scripts compile once per expression while every evaluation retains a fresh sanitized VM context and timeout.

7. Existing guard results and timeout failures remain unchanged, and untrusted guard code cannot use string code generation.

8. Warm prompt slicing performs no synchronous path-existence probes and produces the same prompt fields and text.

9. Repeated context discovery avoids rereading and reparsing unchanged skill metadata and refreshes when metadata changes.

10. Performance checks exercise small, medium, large, and extra-large histories and enforce the confirmed P0 and P1 targets without platform-specific relaxations that mask regressions.

11. Snapshot frequency matches the confirmed policy and rehydration remains correct from the latest snapshot plus subsequent events.

12. Runtime tests, AXI tests, and package builds pass before release.

## 6. Non-Requirements

Do not weaken Node VM isolation to meet latency targets.

Do not change public template history behavior without explicit approval.

Do not change HSM transition semantics or event payload schemas.

Do not add an external database or message broker.

Do not manually modify generated changelog files.

## 7. Ordered Build Plan

1. Add deterministic regressions for event export complexity and recovery before changing the mirror path.

2. Implement indexed incremental JSONL export progress and retain full startup and explicit reconciliation.

3. Add projection regressions, then update event and transition caches incrementally.

4. Add guard, prompt-slice, and context-discovery regressions, then implement safe caches.

5. Align snapshot cadence, performance budgets, and standards examples with the confirmed decisions.

6. Run runtime tests, AXI tests, package builds, focused performance checks, and fresh diff review.

7. Follow the repository release ceremony and publish only if all quality checks pass.

## 8. Value Sources

The latency and complexity targets come from `PERFORMANCE-STANDARDS.md`.

The SQLite, JSONL, ordering, and recovery contract comes from `docs/specs/0007-skill-scoped-event-ledger.md` and `docs/adr/0007-skill-scoped-event-ledger.md`.

The affected runtime paths are `packages/runtime/src/core/event-store.ts`, `packages/runtime/src/core/projection-engine.ts`, `packages/runtime/src/core/guard-evaluator.ts`, `packages/runtime/src/core/fsm-engine.ts`, and `packages/runtime/src/core/context-candidate-discovery.ts`.

The existing regression surfaces are under `packages/runtime/tests/`.

---
title: "Guarding the State Machine: Hexagonal Judgment and Sub-Second Micro-Decisions with TypeSafe Jev"
subtitle: "How Reactive Skills Combines Ports-and-Adapters with TypeSafe’s System One Decision Engine for Fast, Resilient Semantic Guarding"
slug: "guarding-the-state-machine-jev"
publishedAt: "2026-03-22"
readTime: "8 min read"
category: "Deep Dive"
tags:
  - Judgment Engine
  - TypeSafe Jev
  - Ports and Adapters
  - Circuit Breakers
  - Semantic Guards
featured: false
summary: "Deterministic boolean checks verify exit codes, but state transitions often require semantic nuance. Learn how Reactive Skills integrates a decoupled Hexagonal Judgment Engine with TypeSafe Jev for ~400ms micro-decisions and production circuit breaking."
author:
  name: "Reactive Skills Core Team"
  role: "Runtime Architecture"
  handle: "@reactiveskills"
  avatar: "⚡"
series:
  id: "reactive-agentic-runtime"
  title: "The Reactive Agentic Runtime"
  part: 2
  total: 2
  prevSlug: "introducing-reactive-skills"
---

## The Semantic Guard Problem

In Part 1 of this series, we explored how Hierarchical State Machines and deterministic guards (`exit_code === 0`, schema checks) eliminate the vibe-based progression that plagues monolithic agent prompts.

However, software engineering frequently confronts questions that cannot be collapsed into a binary regex or exit code check:

- "Did the security scan identify zero critical CVEs and zero unredacted secrets?"
- "Does this refactoring proposal satisfy architectural invariants without introducing circular dependencies?"
- "Is this pull request description accurate with respect to the staged git diff?"

The naive solution is to invoke a flagship frontier model (Claude Opus, GPT-4o) at every transition. But doing so introduces severe friction: 3 to 6 seconds of latency per check, costly API token billing, non-deterministic outputs, and hard vendor coupling.

## Hexagonal Architecture: Ports & Adapters for Judgment

To solve this without sacrificing runtime neutrality, Reactive Skills implements a decoupled **Ports-and-Adapters Judgment Engine** (`packages/runtime/src/core/judgment-engine.ts`). The core runtime takes zero hard dependencies on external AI SDKs.

Transitions define high-level semantic contracts across three standardized judgment types:

- predicate: A binary query evaluating to true or false with a calibrated confidence score (p_yes).
- categorical: Structured classification that routes execution to one of several discrete declared transition paths.
- evaluation: Rubric-based numerical scoring for multi-criteria quality gates.

> **The JudgmentAdapter Interface**
> Any evaluation mechanism can implement the JudgmentAdapter port: from local V8 sandbox scripts, to internal fine-tuned classifiers, to external decision APIs.

## TypeSafe Jev: Sub-Second System One Intelligence

For semantic evaluation, RSA includes the built-in **`JevJudgmentAdapter`**, which connects to **TypeSafe AI’s System One decision model** (Jev).

Unlike general-purpose conversational LLMs that spend seconds generating chain-of-thought tokens, Jev is trained specifically for calibrated, structured micro-decisions. It returns typed judgments and probabilities in ~300–500ms.

The integration is completely snap-on: `JevJudgmentAdapter` automatically detects ambient credentials in your environment—checking for `TYPESAFE_API_KEY` or local CLI configurations (`~/.config/jev-axi/config.json`)—with zero package installation required.

## Production Resilience: Circuit Breakers & Cascades

In production agent swarms, relying on external APIs for transition guards can risk cascading timeouts if the network drops or third-party rate limits hit. RSA builds an industrial safety net directly into the Judgment Engine:

1. Circuit Breaker Isolation: Each adapter is wrapped in a stateful CircuitBreaker (CLOSED -> OPEN -> HALF_OPEN). If an external decision provider records consecutive failures, the breaker trips to OPEN, immediately bypassing subsequent calls without blocking the agent.
2. Calibrated Confidence Gates: Transitions specify a `min_confidence` threshold (e.g. 0.85). If Jev returns a verdict with confidence below the threshold, the runtime treats it as unverified.
3. Dynamic Fallback Cascade: If the primary adapter trips, times out, or fails the confidence threshold, the engine cascades to a fallback adapter (such as ScriptJudgmentAdapter) or safely diverts the FSM directly to a declared `fallback_target` (e.g. MANUAL_REVIEW or BLOCKED).
4. Immutable Audit Logging: Every fallback or breaker trip automatically appends a GUARD_FALLBACK_TRIGGERED event into the append-only SQLite ledger, guaranteeing 100% post-incident forensic replayability.

## Guarded Transition in Action

Here is what a complete guarded transition looks like in `skill.yaml`:

```yaml
# skill.yaml transition contract
transitions:
  SECURITY_CLEAN:
    target: "SPEC_ALIGNMENT"
    judgment:
      type: "predicate"
      criterion: "Did the security audit confirm zero leaked API keys and no high-severity vulnerabilities?"
      min_confidence: 0.85
      adapter_hint: "jev"
      fallback_adapter: "script"
      fallback_target: "SECURITY_BLOCKED"
      timeout_ms: 2500
```

## Conclusion: Building Predictable Agent Swarms

Autonomous coding agents cannot scale if their execution boundaries are based on conversational vibes or sluggish, monolithic prompts. By pairing **Hierarchical State Machines** with a **Hexagonal Judgment Engine**, Reactive Skills delivers the best of both worlds:

- Deterministic, zero-overhead execution for programmatic tools and exit codes.
- Sub-second, calibrated semantic guard gates via TypeSafe Jev for high-level quality criteria.
- Production-grade circuit breaking, fallback cascades, and append-only event sourcing.

---
title: "Guarding the State Machine: Hexagonal Judgment and Sub-Second Micro-Decisions with TypeSafe Jev"
subtitle: "Decoupled Ports-and-Adapters Architecture and TypeSafe Jev for Fast, Resilient Transition Guards"
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
summary: "Deterministic boolean checks verify tool exit codes, but state transitions often require semantic evaluation. Reactive Skills integrates a decoupled Ports-and-Adapters Judgment Engine with TypeSafe Jev to evaluate semantic criteria in ~400ms with circuit breaker fallbacks."
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

## The Limits of Boolean Guarding

Deterministic guard expressions (such as `exit_code === 0` or schema validation) guarantee that programmatic operations succeed before a state machine advances.

However, state boundaries often involve semantic questions:

- "Did the security audit surface zero unredacted secrets or credentials?"
- "Does this proposed refactoring preserve public module boundaries without introducing circular dependencies?"
- "Does the generated pull request summary match the staged git diff?"

Routing these evaluations to frontier conversational models introduces 3 to 6 seconds of latency per transition, high per-turn token costs, variable formatting, and hard API dependencies in the runtime core.

## Decoupled Ports and Adapters

Reactive Skills Architecture uses a Ports-and-Adapters design for semantic evaluation (`packages/runtime/src/core/judgment-engine.ts`). The core runtime contains no direct AI vendor SDKs.

Transitions declare high-level semantic contracts across three standardized judgment types:

- predicate: A binary query evaluating to true or false with a calibrated confidence score (`p_yes`).
- categorical: Structured classification that routes execution to one of several declared transition targets.
- evaluation: Rubric-based numerical scoring for multi-criteria quality gates.

The `JudgmentAdapter` interface abstracts the underlying evaluator, supporting local V8 sandboxes, custom internal classifiers, or specialized external micro-decision services.

## Sub-Second Evaluation with TypeSafe Jev

For semantic evaluation, the runtime provides the built-in `JevJudgmentAdapter`, which connects to TypeSafe AI's System One decision model (Jev).

Instead of generating freeform chain-of-thought tokens, TypeSafe Jev evaluates structured decision contracts directly. Calls through `JevJudgmentAdapter` resolve in ~300–500ms with calibrated probabilities.

The adapter discovers credentials from ambient environment variables (`TYPESAFE_API_KEY`) or local user configuration (`~/.config/jev-axi/config.json`). If no credentials exist, the adapter reports unavailable without failing engine initialization.

## Circuit Breakers and Fallback Cascades

In production workflows, relying on external network services for transition gates introduces latency and outage risk. RSA implements a protective cascade directly in the Judgment Engine:

1. Circuit breaker isolation: Each adapter maintains a state machine (`CLOSED` -> `OPEN` -> `HALF_OPEN`). If consecutive evaluation failures reach the configured threshold (default: 2), the breaker trips to `OPEN`, bypassing subsequent calls to protect agent turnaround time.
2. Calibrated confidence gates: Transitions specify a `min_confidence` threshold (such as 0.85). If an evaluation returns a verdict below this threshold, the transition is rejected.
3. Fallback cascade: When a primary adapter times out or trips, the engine delegates to a declared fallback adapter (such as `ScriptJudgmentAdapter`) or routes directly to an explicit `fallback_target` state (such as `MANUAL_REVIEW` or `SECURITY_BLOCKED`).
4. Audit logging: Every breaker trip or fallback invocation appends a `GUARD_FALLBACK_TRIGGERED` event into the append-only SQLite store.

## Transition Contract Specification

Here is a complete guarded transition contract in `skill.yaml`:

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

## Operational Invariants

Because transition guards sit on the critical execution path of each turn, primary evaluation timeouts should remain under 2.5 seconds. Configuring a circuit breaker with a two-failure threshold and a 60-second recovery timeout ensures that downstream API degradation diverts to deterministic local fallbacks without hanging the agent.

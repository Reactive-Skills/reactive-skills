---
title: "Introducing Reactive Skills: The Death of the Monolithic Prompt"
subtitle: "Why Agent Skills Must Become Hierarchical State Machines with Scoped Prompt Slices and Deterministic Guards"
slug: "introducing-reactive-skills"
publishedAt: "2026-03-20"
readTime: "6 min read"
category: "Architecture"
tags:
  - Runtime
  - Architecture
  - HSM
  - State Machines
  - Event Sourcing
featured: true
summary: "Conventional agent skills dump thousands of lines of instructions into an LLM context and pray for adherence. Reactive Skills transforms passive markdown into event-driven Hierarchical State Machines with append-only event sourcing and deterministic guards."
author:
  name: "Reactive Skills Core Team"
  role: "Runtime Architecture"
  handle: "@reactiveskills"
  avatar: "⚡"
series:
  id: "reactive-agentic-runtime"
  title: "The Reactive Agentic Runtime"
  part: 1
  total: 2
  nextSlug: "guarding-the-state-machine-jev"
---

## The Passive Skill Trap

Over the past two years, the AI engineering ecosystem standardized on markdown instruction files (`SKILL.md`) to guide autonomous agents. You write down the objectives, list the tools, enumerate edge cases, and hand the file to an LLM.

For single-turn queries or brief scripts, this works well enough. But as agent tasks grow into multi-phase engineering workflows—scaffolding features, migrating database schemas, executing surgical refactors, running integration test suites—the monolithic prompt model breaks down catastrophically.

> **The Failure Modes of Monolithic Prompts**
> Attention drift from bloated context windows, token consumption wasted on dormant phases, and hallucinated completion claims where the model claims tests passed without ever verifying execution.

- Context Window Bloat: Dumping instructions for Explore, Plan, Execute, and Verify simultaneously burns 70%+ of the token budget on phases that are completely irrelevant to the current turn.
- Attention Drift: As conversation turns accumulate, instructions in the middle of a 1,500-line markdown file get suppressed or forgotten.
- Vibe-Based Progression: Without a runtime boundary, the agent decides when a task is "done" based purely on its own generated prose ("Everything looks great, all tests pass!") rather than verified system state.

## The Reactive Shift: From Documents to Statecharts

Reactive Skills Architecture (RSA) fundamentally inverts this paradigm. Instead of treating a skill as a passive document for the agent to memorize, RSA treats the skill as a formal **Hierarchical State Machine (HSM)** executed by a strict TypeScript runtime.

At any point in time, the agent is in exactly one state (e.g. `PLAN`, `EXECUTE`, or `VERIFY`). Rather than receiving the entire repository handbook, the agent is presented with a **Just-In-Time Prompt Slice** containing only:

- The prompt slice for the active state (`states/<state>.md`).
- The explicit tool whitelist enabled for that state.
- The current context variables bound to that state (`context_keys`).
- The declared transitions and acceptable runtime signals.

```bash
npx -y @reactive-skills/axi state refactor-workflow
```

## Hierarchical State Machines & Ancestor Bubbling

Real-world workflows are rarely flat sequences. A refactoring session might comprise substates like `ANALYZE_AST` → `TRANSFORM_CODE` → `VALIDATE_TYPES`. If every substate had to implement handlers for global timeouts, security aborts, or human interventions, skills would drown in boilerplate.

RSA implements formal **Hierarchical State Machine (HSM) Ancestor Bubbling**. When an incoming signal has no matching transition in a leaf substate, the event bubbles up the ancestor tree until an ancestor handles it.

> **Cross-Cutting Resilience**
> Global recovery policies—such as EMERGENCY_ABORT, TIMEOUT, or ROLLBACK—are declared once on composite parent states, protecting all nested substates automatically.

## Deterministic Guard Gates: No More Vibe Checks

In Reactive Skills, an agent cannot simply declare that a phase is complete. Transitions are defended by **deterministic guard expressions** evaluated in a sandboxed runtime environment.

A guard inspects concrete context facts: exit codes, payload properties, schema validations, or file existence. If a guard evaluates to `false`, the state machine refuses to transition, forcing the agent to remediate the underlying issue.

```yaml
# skill.yaml transition specification
transitions:
  TESTS_PASSED:
    target: "DELIVER"
    guard: "event.payload.exit_code === 0 && context.coverage >= 85"
```

## Append-Only Event Sourcing & Live Deliverables

Every signal received, guard evaluated, and state entered is appended to an immutable event ledger (`events.jsonl` + SQLite `events.db`). The active state and system deliverables are never stored as mutable blobs—they are **read-model projections** folded from the event stream.

Whenever an event occurs, RSA automatically re-evaluates projection templates (using Handlebars), generating live PR summaries, verification reports, and architecture decision records directly into the workspace.

## What's Next: Bridging into Semantic Judgment

Deterministic guards (`exit_code === 0`, schema checks) cover most programmatic operations. But modern software engineering also demands **semantic judgment**: *"Did the security scan report zero critical vulnerabilities?", "Is the PR description aligned with the original specification?"*

How do we evaluate nuanced semantic criteria at transition boundaries without introducing 5-second frontier LLM latency or hard SDK dependencies? In **Part 2 of this series**, we examine the **Decoupled Hexagonal Judgment Engine** and its zero-dependency snap-on integration with **TypeSafe Jev**.

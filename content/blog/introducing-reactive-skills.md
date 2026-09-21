---
title: "Introducing Reactive Skills: Why Agent Skills Need Formal Statecharts"
subtitle: "Replacing Flat Prompts with Hierarchical State Machines and Scoped Context Slices"
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
summary: "Flat prompt files force agents to manage complex engineering tasks in an unstructured context loop. Reactive Skills introduces a statechart runtime with scoped prompt slices, ancestor event bubbling, and deterministic guards."
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

## Context as an Execution Bottleneck

Most agent frameworks package procedures as flat markdown documents (`SKILL.md`). When an agent starts a task, the harness injects the entire file into prompt context, leaving the model to navigate multi-step execution on its own.

On short queries, this works. On multi-turn engineering tasks—refactoring a module, running database migrations, reconciling APIs—it degrades quickly:

- Inactive procedures compete for attention. Instructions for post-implementation verification or rollback occupy valuable prompt tokens while the agent is still analyzing files.
- Context decay weakens constraint adherence. As turn history grows, instructions in the middle of a 2,000-line prompt lose influence over model decisions.
- Verification collapses into self-reporting. Without an external runtime enforcing phase completion, agents declare work finished based on generated text rather than machine evidence.

## Statecharts Over Flat Documents

Reactive Skills Architecture (RSA) structures workflows as formal Hierarchical State Machines (HSMs).

The agent occupies one state at a time. Entering `PLAN` loads only the prompt slice for planning, restricting the active tool whitelist to read-only discovery tools. Instructions for `EXECUTE` and `VERIFY` remain out of context until the machine advances.

```bash
npx -y @reactive-skills/axi state refactor-workflow
```

This inspection command returns the active state, its bound context variables, and permitted signals:

```yaml
state:
  skill_id: refactor-workflow
  current_state: PLAN
prompt:
  raw_prompt: "# State: PLAN\nAnalyze target files and generate an implementation plan..."
  allowed_tools: "view_file,grep_search"
transitions:
  - signal: PLAN_APPROVED -> EXECUTE
  - signal: ABORT -> CANCELLED
```

## Nesting and Ancestor Event Bubbling

Flat state machines fail on non-trivial workflows because error handling duplicates across every step. If an execution phase contains separate steps for AST parsing, code modification, and typecheck passes, wiring timeout or cancellation handlers into each individual state creates unnecessary surface area.

RSA handles this through hierarchical state nesting. When a signal arrives without a transition match in a leaf state, the runtime bubbles the event up the ancestor tree. Global aborts, recovery routines, and execution timeouts live on composite parent states and handle unhandled events from any child.

## Mechanically Enforced Progress

Transitioning between states requires more than an agent asserting that work is done. Transitions are protected by deterministic guard expressions evaluated against context facts.

A guard tests machine properties: process exit codes, schema checks, payload flags, or file system paths. If the condition evaluates to `false`, the runtime rejects the transition and keeps the agent in its current state.

```yaml
transitions:
  TESTS_PASSED:
    target: "DELIVER"
    guard: "event.payload.exit_code === 0 && context.coverage >= 85"
```

## Immutable Ledgers and Projected Deliverables

State changes, signals, and guard evaluations write to an append-only event store (`events.jsonl` and an SQLite database). 

Workspace artifacts—pull request summaries, verification tables, delivery logs—are not regenerated from conversation memory. Instead, the runtime computes them as read-model projections folded directly from the event log using Handlebars templates. If a run aborts or needs replay, the event ledger reproduces the exact sequence of state changes.

## Where Deterministic Checks Fall Short

Process exit codes and schema checks handle binary invariants cleanly. However, many production boundaries depend on semantic evaluation: confirming an audit identified zero unredacted keys, or checking that generated documentation aligns with actual code changes.

Running these checks through general-purpose conversational LLMs adds multi-second latency and uncalibrated variance. In Part 2, we look at the runtime's decoupled Hexagonal Judgment Engine and its integration with TypeSafe Jev for sub-second micro-decisions.

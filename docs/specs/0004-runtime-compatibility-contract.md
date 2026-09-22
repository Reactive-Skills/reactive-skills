# Specification: Runtime Compatibility Contract

Status: Proposed.

Target: `@reactive-skills/runtime` and `@reactive-skills/axi`.

Related work: `docs/specs/0002-desktop-skill-judgment-adapters.md`.

## 1. Problem Statement

Skills can declare judgment behavior that an older AXI or runtime silently ignores.

The current runtime does not expose a machine-readable capability contract for skills or consumers.

Operators cannot reliably determine whether the installed runtime can execute a skill's required features.

Judgment events must make adapter selection and fallback behavior independently auditable.

## 2. Scope

This slice adds an optional `runtime_requirements` block to `skill.yaml`.

The block declares `min_runtime_version` and `required_capabilities`.

The updated runtime validates requirements during `FSMEngine` construction before state execution.

The AXI CLI exposes runtime capabilities and skill preflight results.

Judgment evidence records the selected adapter and fallback status in execution events.

The slice adds focused runtime and AXI coverage plus consumer documentation.

## 3. Design Decision

Keep compatibility requirements in `skill.yaml` so one skill artifact carries its execution contract.

Use the existing Zod manifest validation path and preserve compatibility for skills without `runtime_requirements`.

Represent the version floor with semver and capabilities with stable string identifiers.

Run compatibility checks during runtime load and expose the same checker through `axi preflight <skill>`.

Expose the installed runtime version and capability registry through `axi capabilities`.

Treat Jev availability as an observed adapter capability rather than a mandatory requirement for skills that provide Script fallback.

Record judgment adapter evidence in the existing guard evaluation and fallback event payloads.

An older runtime cannot be retrofitted to enforce metadata it does not understand, so consumer documentation must require a compatible AXI/runtime version and recommend version pinning.

## 4. Runtime Requirement Contract

The manifest shape is:

```yaml
runtime_requirements:
  min_runtime_version: "0.8.1"
  required_capabilities:
    - runtime.preflight
    - judgment.adapter_evidence
```

`min_runtime_version` is compared with the runtime package version from `packages/runtime/package.json`.

`required_capabilities` must contain unique non-empty identifiers.

The initial capability registry includes `runtime.preflight`, `judgment`, `judgment.script`, and `judgment.adapter_evidence`.

The registry reports `judgment.jev` only when Jev is available in the ambient environment.

Missing or incompatible requirements produce a typed compatibility error before the FSM can execute a state transition.

## 5. AXI Contract

`reactive-skills-axi capabilities` reports the runtime version, static capabilities, observed adapter availability, and CLI version when available.

`reactive-skills-axi preflight <skill>` reports required requirements, provided capabilities, version status, adapter status, and an overall pass or fail result.

The preflight command is read-only and does not create a job or change the active job pointer.

`invoke`, `state`, and `emit` inherit runtime compatibility enforcement through `FSMEngine`.

## 6. Judgment Evidence Contract

Judgment-bearing guard events include the judgment type, criterion, selected adapter, confidence, pass result, and fallback status when applicable.

Jev availability selects Jev as the default primary adapter when no explicit adapter hint is present.

Unavailable Jev selects Script as the primary adapter.

A failed primary adapter invokes the declared fallback adapter and records the fallback transition.

## 7. Acceptance Criteria

1. A manifest without `runtime_requirements` remains valid and executable.

2. A manifest with valid runtime requirements parses and exposes typed requirements.

3. A runtime below `min_runtime_version` is rejected before state execution.

4. A runtime missing a required capability is rejected before state execution.

5. `axi capabilities` reports runtime version and capability state.

6. `axi preflight <skill>` reports a passing compatible skill and a failing incompatible skill without mutating job state.

7. Judgment events identify Jev primary selection when Jev is available.

8. Judgment events identify Script primary selection when Jev is unavailable.

9. Judgment events identify primary failure and Script fallback when Jev fails.

10. Existing judgment fallback routing remains compatible.

11. Runtime and AXI tests cover the compatibility and adapter matrix.

12. Consumer documentation explains version pinning, capability checks, and the old-runtime boundary.

## 8. Non-Requirements

This slice does not make Jev mandatory for all judgment-bearing skills.

This slice does not modify installed consumer satellites.

This slice does not edit generated changelog files.

This slice does not claim that a new manifest can force an unmodified old runtime to reject unknown metadata.

## 9. Ordered Build Plan

1. Add typed runtime requirement and capability schemas.

2. Implement a shared compatibility checker and runtime capability registry.

3. Enforce the checker during FSM loading and expose runtime preflight through AXI.

4. Add `capabilities` and `preflight` CLI commands.

5. Extend judgment event evidence without changing adapter selection semantics.

6. Add runtime and AXI tests for compatibility and adapter selection.

7. Update consumer documentation and run the full verification gates.

## 10. Value Sources

The runtime version source is `packages/runtime/package.json`.

The manifest source is `packages/runtime/src/core/types.ts`.

The execution boundary source is `packages/runtime/src/core/fsm-engine.ts`.

The judgment behavior source is `packages/runtime/src/core/judgment-engine.ts` and `packages/runtime/src/core/guard-evaluator.ts`.

The CLI command source is `apps/axi/src/cli/index.ts` and `apps/axi/src/commands/`.

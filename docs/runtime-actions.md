# Runtime-executed states (experimental)

> Disclosure level: public. Status: experimental prototype; the manifest shape may change before it is stable.

A state that only runs a command, checks that a file exists, validates a recorded value or computes a value from recorded context does not need a model turn.
A manifest can mark such a state with `runtime_action`.
The runtime then runs the declared action itself, records the result in the ledger as evidence, and follows the declared success or failure transition.
The state is never delivered to the model; the model receives the next model-visible state, with the recorded result in context.

## Opting in

The feature is off unless the manifest requires the `state.runtime_actions` capability.
A manifest that declares `runtime_action` without it fails validation.
The bootloader asks the agent to check `runtime_requirements` against the runtime's capabilities, but an older runtime's engine does not enforce them: it would deliver a runtime state to the model as an ordinary state without instructions.

```yaml
runtime_requirements:
  required_capabilities:
    - state.runtime_actions
context_keys:
  - red_result
states:
  RED_SPEC:
    prompt_template: states/red_spec.md
    transitions:
      TEST_WRITTEN: RED_RUN
  RED_RUN:
    description: The runtime runs the test suite and requires it to fail
    runtime_action:
      kind: command
      command: node
      args: [tests/auth.test.mjs]
      timeout_ms: 30000
      expect_exit: nonzero
      record_as: red_result
      on_success: RED_CONFIRMED
      on_failure: RED_NOT_FAILING
    transitions:
      RED_CONFIRMED: GREEN_CODE
      RED_NOT_FAILING: RED_SPEC
```

## Action kinds

Only these four kinds exist; any other `kind` fails validation.

| Kind | Fields | Success when |
|---|---|---|
| `command` | `command`, optional `args`, required `timeout_ms` (at most 600,000), optional `cwd`, optional `expect_exit` (`zero` by default, or `nonzero`) | The process exits with the expected status before the timeout |
| `path_exists` | `path`, optional `type` (`file`, `directory`, `any`) | The workspace-relative path exists with that type |
| `json_schema` | `value` (a dot-separated context path), `schema` | The recorded value satisfies the schema |
| `expression` | `expression` | The expression over `context` evaluates to `true` |

Every kind also declares `on_success`, `on_failure` and, optionally, `record_as`.

`json_schema` supports this subset: `type` (including `integer`), `enum`, `const`, `required`, `properties`, `additionalProperties: false`, `items`, `minItems`, `maxItems`, `minimum`, `maximum`, `minLength` and `maxLength`.
Any other keyword fails validation, so no declared rule is silently ignored.

## Safety rules

- **No interpolation.** `command`, `args`, `cwd` and `path` are literal manifest strings. Values containing `{{` are rejected, and nothing from context or a signal payload reaches a command.
- **No shell.** Commands start with `shell: false`; `command` must be an executable name looked up on `PATH`, or a workspace-relative path. `node` runs the runtime's own Node executable. This prevents interpolation, not authorship: a manifest can still declare a shell or interpreter as its command, which is why vetting reports every declared command.
- **Contained paths.** `cwd`, `path` and relative executables must stay inside the workspace, including through symbolic links; absolute paths and `..` segments are rejected.
- **Bounded execution.** A command is killed at `timeout_ms`, together with its process group on Linux and macOS (on Windows only the direct process). Only the last 2,048 bytes of stdout and of stderr are kept.
- **Pure expressions.** `expression` and `json_schema` read a copy of recorded context in the same `node:vm` sandbox shape as inline guards, without code generation and with a 100 ms limit.
- **Declared routing.** `on_success` and `on_failure` must be transitions declared on the state itself, with a declared target and without a guard, judgment, payload contract or child invocation: the action decides them. A timeout, a command that cannot start, a contained-path violation or an executor fault is a failure and follows `on_failure`.
- **Shape rules.** A runtime state is a leaf, has no `human_gate` or `prompt_template`, cannot be the initial state, and runtime states cannot form a cycle without a model-visible state. `record_as` must be one of `context_keys`.
- **Runtime-owned signals.** The outcome signals cannot be submitted from outside while their state is active.
- **Vetting.** `reactive-skills-axi vet` reports every declared command as `guard/runtime-command` (medium), so a reviewer sees what a skill runs without a model turn.

## Ledger evidence

Each execution appends `RUNTIME_ACTION_STARTED` (state, kind, attempt) before it runs, and `RUNTIME_ACTION_COMPLETED` (outcome and the whole observation: exit code, signal, timeout flag, duration and output tails) after it.
The runtime then dispatches the outcome signal through ordinary signal handling with `source: runtime_action`, caused by the completed event.
Guard, transition, snapshot, projection and lifecycle behavior is unchanged.

The signal payload carries `runtime_result`, a compact record without output tails: kind, outcome, attempt, the completed event's sequence as `evidence_seq`, and the exit code, existence, validity or value.
With `record_as`, the same record is committed to that context key, so the next view shows it.
The full output stays in the ledger and is available through `reactive_query_events`.

## Recovery and strict mode

Pending work is resumed from the ledger before any view is delivered (MCP `reactive_state` and `reactive_context_prepare`, AXI `state` and `invoke`) and before an incoming signal is handled.
The window is the events since the snapshot written when the state was entered.

| Interrupted | On resume |
|---|---|
| After entering the state, before `RUNTIME_ACTION_STARTED` | Runs the action (attempt 1) |
| After `RUNTIME_ACTION_STARTED`, before `RUNTIME_ACTION_COMPLETED` | Runs the action again (attempt 2): commands run **at least once**, so declare idempotent commands |
| After `RUNTIME_ACTION_COMPLETED`, before the outcome signal | Reuses the recorded result; the action does not run again |
| After the outcome signal, before its transition | Reuses the recorded result and dispatches the outcome again; the uncommitted signal stays uncommitted |

Replay applies only committed transition patches, so a fresh engine rebuilt from the ledger, with or without a snapshot, reaches the same state and context.
In strict mode a runtime state is never delivered, so it records no `AGENT_TURN_STARTED` and does not count toward idle turns.

## Interfaces

`FSMEngine.handleSignal` returns the first model-visible state as `newState`, with a `runtimeActions` summary of the states it ran.
`FSMEngine.resumeRuntimeActions()` finishes pending work; it returns immediately when the active state is model-visible.
Hosts can inject a `RuntimeActionExecutor` through `FSMEngineOptions.runtimeActionExecutor`; `LocalRuntimeActionExecutor` is the default.
The MCP receipt shape is unchanged; the view shows the recorded result through `record_as`.
AXI emit output shows the new state's prompt, not recorded context.

## Measured prototype

Two catalog skills (catalog commit `80d1c72`) were converted into test fixtures under `packages/runtime/tests/fixtures/runtime-actions/`; the catalog itself is unchanged.
The measurement used the harness and definitions of the 0.20.0 context measurement report on each skill's declared canonical path: delivered context is the declared common sources and references plus every tool argument and result, divided by the catalog skill's flat fixture.
Receipt projection paths are workspace-relative on both runtimes, so workspace location does not affect the byte counts.
Token counts are offline `o200k_base` estimates; they move by about ±0.05 between runs with no byte change.

| Skill | Transport | Main runtime, catalog skill (bytes / tokens over flat) | This runtime, runtime-action variant | States delivered to the model: flat / main / variant |
|---|---|---|---|---|
| tdd-refactor | MCP default | 3.178 / 3.592 | 2.903 / 3.303 | 7 / 7 / 6 |
| tdd-refactor | MCP continuation | 3.211 / 3.649 | 2.932 / 3.312 | 7 / 7 / 6 |
| tdd-refactor | AXI default | 2.884 / 3.436 | 2.616 / 3.095 | 7 / 7 / 6 |
| test-coverage-gate | MCP default | 2.205 / 2.579 | 1.652 / 1.855 | 7 / 7 / 4 |
| test-coverage-gate | MCP continuation | 2.224 / 2.599 | 1.662 / 1.872 | 7 / 7 / 4 |
| test-coverage-gate | AXI default | 2.010 / 2.457 | 1.517 / 1.785 | 7 / 7 / 4 |

Neither variant delivers less than flat on either skill.
The variants deliver less than the main runtime running the catalog skill on every transport.
Flat model turns are counted as one per canonical position, an assumption rather than an observation.
The variant of test-coverage-gate declares its commands for one fixture project instead of taking them from the model, which the catalog skill allows.

Runtime-executed portion, 20 repetitions over MCP default, p50 / nearest-rank p95 in milliseconds: the action alone, and from `RUNTIME_ACTION_STARTED` to the outcome's `TRANSITION_COMPLETED` (ledger timestamps, millisecond resolution).

| Skill | State | Action | Runtime portion |
|---|---|---|---|
| tdd-refactor | RED_RUN | 52.1 / 61.6 | 79 / 93 |
| tdd-refactor | GREEN_RUN | 50.1 / 63.4 | 87 / 103 |
| tdd-refactor | AUDIT_VERIFY | 49.3 / 60.2 | 81 / 95 |
| test-coverage-gate | CONFIGURE | 0.07 / 0.20 | 20 / 25 |
| test-coverage-gate | BASELINE | 130.0 / 149.9 | 152 / 180 |
| test-coverage-gate | MEASURE | 170.8 / 186.9 | 198 / 215 |
| test-coverage-gate | MEASURE_REPORT | 0.11 / 0.20 | 23 / 30 |

Model generation time for the turns that were removed was not measured.

# Scope: v0.18.0 Human Approval (Train R3a)

Parent roadmap: `docs/scope/backlog-release-roadmap.md`.

## Intent

A gate that no adapter can judge waits for a person instead of trusting the agent's own report.
The approval comes through a channel the agent cannot use on its own: an interactive terminal where the user types back a one-time code.
Self-reported decisions happen only when an operator turns them on through that same channel, and every one of them is visibly flagged.
Refusals say what went wrong and what the agent should do next.

## Owner decisions (2026-10-04)

- Approval: `reactive-skills-axi approve` in the user's own interactive terminal, with a typed one-time code; MCP and non-interactive shells cannot approve.
- Self-report opt-in: granted through the same approve channel, recorded, and warned on every self-reported decision; not an environment variable.
- Residual risk accepted and documented: within one OS account, an agent that emulates a terminal or calls the runtime library directly can still bypass the channel.
- R3 is split: R3a (v0.18.0) ships #22 part 2, #47, and #32; R3b (v0.19.0) ships #29, #10, #39, #42, and #44.

## Milestones

1. #22 part 2: pending approvals, the `approve` command, human-decided judgments, and the self-report opt-in.
2. #47: Jev authoring errors are reported as authoring errors, not outages, and do not trip the circuit breaker.
3. #32: refusal reasons from guard functions (`{ passed, reason }`), inline `guard_message`, and the guard expression or file path when no message is declared.
4. v0.18.0 release candidate.

## Acceptance seeds

### #22 part 2

- S1: A judgment that no adapter can judge (model outage or no model, without the opt-in) refuses the signal, records a pending approval, and tells the agent to stop and ask the user to run `reactive-skills-axi approve` in their own terminal.
- S2: `approve` lists the pending gate with its criterion and the agent's evidence, asks for a one-time code, and on a correct code continues the original signal with the judgment decided by a human.
- S3: `approve` refuses to run without an interactive terminal, and MCP exposes no tool that approves a pending gate.
- S4: A human rejection routes to `fallback_target` when declared and otherwise leaves the run in its state.
- S5: An approval applies once, to the pending gate it names.
- S6: The self-report opt-in is granted through `approve` with a typed code, is recorded, and applies only when no model is configured; every self-reported emit carries a warning.
- S7: The ledger records who decided each judgment: model, expression, human, or self-report.

### #47

- S8: A judgment authoring error (for example a one-item rubric) refuses with a reason that names the authoring problem and does not suggest retrying, and it does not count against the circuit breaker.

### #32

- S9: A guard function can return `{ passed: false, reason }` and the reason reaches AXI, MCP, and `GUARD_EVALUATED`.
- S10: An inline guard can declare `guard_message`, which is returned on refusal.
- S11: A refused guard with no message returns its expression or file path.

### Release

- S12: The v0.18.0 release-prep pull request is merged with green CI, and nothing is tagged or published.

## Approach

Test-driven development per milestone; one feature pull request with one commit per issue, then the release pull request.
Standard workflow tier with an ADR (0012) for the approval channel and the opt-in, because it changes default behavior for users without a model.

## Out of scope

- Diagnostics in R3b: #29, #10, #39, #42, #44.
- Hardening against a determined same-user agent (signed approvals, separate OS users); recorded as a follow-up option.

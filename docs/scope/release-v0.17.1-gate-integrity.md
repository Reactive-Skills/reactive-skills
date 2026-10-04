# Scope: v0.17.1 Gate Integrity (Train R2)

Parent roadmap: `docs/scope/backlog-release-roadmap.md`.

## Intent

Semantic gates must not pass on an agent's own success report while Jev is down.
Agents must see why a gate refused, and when a decision came from the agent's own report.
Exact predicates must be provably independent of Jev.
Test runs must not leave projection output in the repository.

## Milestones

1. #28: test runs create no `.docs/` or `.reactive/` output in the repository.
2. #22 part 1: Jev outage refusal, self-reported labels, and a visible refusal reason.
3. #15: `adapter_hint: script` regression tests, authoring docs, and a `validate` warning.
4. v0.17.1 release candidate.

Each milestone ships as its own pull request; the release candidate follows the last one.

## Acceptance seeds

### #28

- S1: After `pnpm test` and `pnpm test:axi`, no new entries exist under `.docs/` or `.reactive/` at the repository root, in `packages/runtime`, or in `apps/axi`.
- S2: A check fails the test run when a suite writes either directory into one of those locations.

### #22 part 1

- S3: With a Jev adapter that is available but throws, a predicate with a natural-language criterion and payload `{ exit_code: 0 }` is refused: the state does not change and no fallback transition happens.
- S4: The same refusal happens when the Jev circuit breaker is open.
- S5: Categorical (`payload.choice`) and evaluation (`payload.score`) judgments refuse the same way.
- S6: The refusal reason says Jev is unavailable and to retry, and it appears in the AXI emit output, the MCP emit result, and `GUARD_EVALUATED`.
- S7: A criterion that compiles as JavaScript still evaluates through the script fallback during a Jev outage.
- S8: With no Jev configured, a natural-language predicate with payload `{ exit_code: 0 }` still passes, and the emit output and `GUARD_EVALUATED` label the decision as self-reported.

### #15

- S9: With Jev available, `adapter_hint: script` evaluates through the script adapter and never calls Jev; a satisfying exact predicate transitions.
- S10: When the hinted primary adapter errors, the fallback adapter still runs.
- S11: `validate` warns on a predicate whose criterion compiles as JavaScript but has no `adapter_hint: script`.
- S12: Authoring docs state that `fallback_adapter: script` runs only when the primary adapter fails, not on a low-confidence answer, and describe the policy without Jev.

### Release

- S13: The v0.17.1 release-prep pull request is merged with green CI, and nothing is tagged or published.

## Approach

Test-driven development per milestone, with the failing test written first against the real engine and CLI.
Standard workflow tier: the change touches gate behavior shared by every skill, so each milestone gets an independent review.

## Out of scope

- `guard_message` and `{ passed, reason }` guard results (#32, R3).
- Human approval for gates no adapter can judge (#22 part 2, R3).
- Skill-side migrations.

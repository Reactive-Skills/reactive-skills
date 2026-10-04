# Specification: Judgment Probability Thresholds

Status: Implemented.

Target: `@reactive-skills/runtime` and `@reactive-skills/axi`.

Related decision: `docs/adr/0010-judgment-probability-thresholds.md`.

Related scope: `docs/scope/judgment-probability-thresholds.md`.

Issues: Reactive-Skills/reactive-skills#25 and #23.

## 1. Problem Statement

Predicate `min_confidence: m` requires P(yes) `>= 0.5 + m / 2`, which authors misread as a probability.

Categorical `min_confidence` compares a different score, Jev's own confidence.

`guards/*.yaml` accept, escalate, and reject bands are never enforced, and they drift from the `skill.yaml` judgments that are enforced.

Predicates have no escalate band.

## 2. Judgment Contract

`min_probability` is an optional number from `0` to `1` on `predicate` and `categorical` judgments.

A predicate accepts when P(yes) `>= min_probability`.

A categorical judgment accepts when the picked label is one of `options` and its probability `>= min_probability`.

A predicate `min_probability` below `0.5` is invalid, because it would accept a result whose verdict is no.

`min_probability` on an `evaluation` judgment is invalid.

A judgment that sets both `min_probability` and `min_confidence` is invalid.

`min_confidence`, its formula, and its default of `0.75` stay unchanged.

`escalate` is an optional object with `min_probability` and `target`.

`escalate` is valid only when the judgment sets `min_probability`, and `escalate.min_probability` must be lower than `min_probability`.

When the accept check fails and the result's probability is at or above `escalate.min_probability`, the judgment routes to `escalate.target`.

For a categorical judgment, escalation also requires the picked label to be one of `options`.

Every other failed result routes to `fallback_target`, or refuses the transition when `fallback_target` is absent.

A judgment that uses `min_probability` fails closed when the adapter returns no probability.

## 3. Result and Event Evidence

`JudgmentResult.probability` is P(yes) for predicates and the picked label's probability for categorical judgments.

The Script adapter reports `1` for a true predicate, `0` for a false predicate, and `1` for its categorical choice.

The Jev adapter reports the bounded `noul` value for predicates and `probabilities[choice]` for categorical judgments.

The engine result adds `threshold: { field, value }` and `band`, where `band` is `accept`, `escalate`, or `reject`.

`GUARD_EVALUATED` records the judgment result with these fields.

`GUARD_FALLBACK_TRIGGERED` records `band`.

## 4. Runtime Capability

The runtime advertises `judgment.probability_thresholds`.

Skills that use `min_probability` or `escalate` should list it in `runtime_requirements.required_capabilities`, because older runtimes drop unknown judgment fields.

## 5. Validation

`reactive-skills-axi validate` warns when a predicate or categorical judgment without `adapter_hint: script` has no `min_probability`.

The predicate warning states the equivalent value, `0.5 + min_confidence / 2`, using `0.75` when `min_confidence` is absent.

`validate` warns when a manifest uses `min_probability` or `escalate` without requiring `judgment.probability_thresholds`.

`validate` reads `guards/*.yaml` and `guards/*.yml` contracts that declare `snap_on.judgment` or `thresholds`.

A contract is linked to every `skill.yaml` transition judgment whose `criterion` equals its `snap_on.judgment.criterion`.

`validate` errors when `escalate.target` is not a defined state.

`validate` errors when a linked pair disagrees on `type`, on the resolved threshold field and value, or on `escalate`.

An omitted `min_confidence` resolves to the `0.75` default before comparison.

`validate` errors when a parseable accept band disagrees with the linked judgment's effective accept probability.

An accept band of the form `< x` or `<= x` is compared as `1 - x` and also produces a polarity warning.

`validate` warns when a contract links to no judgment, when its numeric escalate band has no linked `escalate` block, and when its thresholds or failure behavior contain `TODO`.

Categorical judgments without `min_probability` are excluded from accept band comparison, because their scale is not a probability.

## 6. Acceptance Criteria

1. The schema accepts `min_probability` on predicate and categorical judgments.
2. The schema rejects both threshold fields together, `min_probability` on evaluation judgments, and a predicate `min_probability` below `0.5`.
3. The schema accepts `escalate` only with `min_probability` and a lower `escalate.min_probability`.
4. A Jev predicate with `min_probability: 0.85` passes at P(yes) `0.85` and rejects at `0.84`.
5. A Jev predicate with `min_confidence: 0.70` passes at P(yes) `0.85` and rejects at `0.84`.
6. A judgment with no threshold keeps the `0.75` confidence default.
7. A Jev categorical judgment with `min_probability: 0.8` passes when the picked label's probability is `0.8` and rejects at `0.79`, regardless of Jev's confidence.
8. A categorical judgment with `min_probability` fails closed when the picked label has no probability.
9. A predicate with `min_probability: 0.85` and `escalate: { min_probability: 0.3, target: HUMAN_REVIEW }` moves to the target at `0.9`, to `HUMAN_REVIEW` at `0.5`, and to `fallback_target` at `0.2`.
10. Script adapter exact checks pass and fail as before when they use `min_probability`.
11. `GUARD_EVALUATED` records `probability`, `threshold`, and `band`, and `GUARD_FALLBACK_TRIGGERED` records `band`.
12. The runtime capability list includes `judgment.probability_thresholds`.
13. `validate` warns on a semantic predicate without `min_probability` and names the equivalent value.
14. `validate` warns on a semantic categorical judgment without `min_probability`.
15. `validate` does not warn on judgments with `adapter_hint: script`.
16. `validate` warns when the new fields are used without the capability requirement.
17. `validate` errors on guard contract threshold, type, escalate, or accept band disagreement.
18. `validate` warns on unlinked contracts, inverted accept polarity, unenforced escalate bands, and `TODO` thresholds.
19. Authoring documentation states the confidence formula, `min_probability`, `escalate`, the capability requirement, and the migration mapping.
20. Runtime and AXI builds pass, and `npm test` passes.

## 7. Non-Requirements

Do not change `min_confidence` semantics or its default.

Do not load `guards/*.yaml` at runtime.

Do not add categorical accept subsets or per-label routing.

Do not add probability thresholds to `evaluation` judgments.

Do not edit skills in other repositories in this change.

Do not bump versions or edit `CHANGELOG.md`.

## 8. Ordered Build Plan

1. Add a pure threshold module in the runtime with schema refinements, threshold resolution, and band classification.
2. Report probabilities from the Script and Jev adapters.
3. Apply the threshold module in `JudgmentEngine` for primary and fallback results.
4. Carry `band` through the guard evaluator and FSM fallback event.
5. Advertise the runtime capability.
6. Add the AXI judgment and guard contract checks.
7. Add runtime and AXI tests.
8. Update authoring docs.
9. Run builds, tests, and the skill inventory through `validate`.

# Judgment Probability Thresholds

## Intent

Let skill authors express judgment thresholds as plain probabilities with one meaning across judgment types.

Keep every existing `min_confidence` gate behaving exactly as it does in v0.16.2.

Stop guard contracts and enforced `skill.yaml` judgments from drifting silently.

Source: Reactive-Skills/reactive-skills#25, which includes #23.

## Acceptance Seeds

- A predicate judgment with `min_probability: 0.85` passes at P(yes) `0.85` and rejects at `0.84`.
- A predicate judgment with `min_confidence: 0.70` still passes at P(yes) `0.85` and rejects at `0.84`.
- A categorical judgment has a documented, probability-based threshold that does not reuse the predicate confidence scale.
- A judgment result in the grey zone between reject and accept can route to a declared escalation target instead of only pass or fallback.
- `reactive-skills-axi validate` warns when a semantic predicate relies only on `min_confidence`.
- `reactive-skills-axi validate` reports drift between a skill's guard contracts and its enforced `skill.yaml` judgments.
- `GUARD_EVALUATED` events record the probability and the threshold that decided the transition.
- Authoring docs state the confidence formula, the probability fields, and the migration mapping.

## Ordered Work

1. Decide the threshold contract, escalation band, and guard contract policy.
2. Extend the judgment schema and result contract.
3. Enforce probability thresholds and escalation routing in the judgment engine and FSM.
4. Add validation warnings and guard contract drift checks to AXI.
5. Add focused runtime and AXI tests.
6. Update authoring documentation and the migration list for existing skills.
7. Run build, tests, and a fresh diff review.

## Constraints

- Do not change what `min_confidence` means.
- Preserve behavior for every existing skill manifest.
- Use existing runtime, AXI, event, and Zod patterns.
- Do not manually author `.docs` projections.
- Do not edit `CHANGELOG.md`.
- Edit skills only in registered authoring sources, and only with approval.

## Delivery

- Delivery approach: Vertical Slice.
- Workflow tier: GA.

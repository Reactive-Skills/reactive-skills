# ADR 0010: Judgment Probability Thresholds

Status: Accepted.

Date: 2026-10-03.

## Context

Predicate judgments score Jev's P(yes) as `confidence = |P - 0.5| * 2`.

`min_confidence: m` therefore requires `P >= 0.5 + m / 2`, so authors who read `0.7` as "70% sure" get an 85% gate.

Categorical judgments compare `min_confidence` against Jev's own confidence score, so the same field has a second scale.

Skills ship `guards/*.yaml` contracts with accept, escalate, and reject bands, but the runtime enforces only the `skill.yaml` transition `judgment` block.

The two drift silently, and predicates have no escalate band, only pass or fallback.

Synthesis 2.1.1 and jsm-workflow encode `P >= 0.85` as `min_confidence: 0.70`, so reinterpreting `min_confidence` would silently loosen their gates.

Runtimes before this change strip unknown judgment fields during schema parsing, so a new field would also silently fall back to the default threshold on an old runtime.

## Decision

Add `min_probability` to predicate and categorical judgments.

For predicates it is compared directly with P(yes).

For categorical judgments it is compared with the probability Jev assigns to the picked label.

Keep `min_confidence` and its formula unchanged, and reject judgments that set both fields.

Add an optional `escalate: { min_probability, target }` band.

A result at or above `escalate.min_probability` and below `min_probability` routes to `escalate.target` instead of `fallback_target`.

Keep `skill.yaml` as the only runtime judgment contract.

Treat `guards/*.yaml` as design contracts and make `reactive-skills-axi validate` report drift between them and the enforced judgments.

Advertise the runtime capability `judgment.probability_thresholds` so migrating skills can require it.

Record the probability, threshold field, threshold value, and decision band on judgment events.

## Alternatives Considered

Reinterpreting `min_confidence` as a probability would be simpler to read, but it would silently loosen every migrated gate with no error.

Documenting the mapping only would leave the trap in place and keep two scales under one field name.

Loading `guards/*.yaml` thresholds at runtime would make the guard file authoritative, but its threshold strings are free text such as `confidence >= 0.8 AND picked in [...]` and `TODO`, so the runtime would need a new grammar and would have two sources of truth.

A lint-only fix would surface drift but leave predicates without an escalate band.

## Consequences

Authors can write the probability they mean, and the event ledger shows which threshold decided each transition.

Existing manifests evaluate exactly as before.

Grey-zone results can reach a human gate when a skill declares an escalate band.

Skills that adopt the new fields must declare `runtime_requirements.required_capabilities: [judgment.probability_thresholds]` so older runtimes refuse them instead of silently dropping the fields.

Existing skill gates need an explicit follow-up migration after this runtime is released.

Guard contract drift becomes a validation finding, but polarity between a guard question and an enforced criterion can be detected only from the guard's accept band direction.

## Value Sources

The field names and band semantics come from issues #23 and #25 and the user's choices in this run.

The confidence formula comes from `packages/runtime/src/core/judgment-engine.ts` in v0.16.2.

The per-label probabilities come from the `@typesafe-ai/sdk` 0.6.0 choice answer type.

The guard contract shape comes from the jevify contract format used by resume-manager and ameliorate.

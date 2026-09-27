# ADR 0008: Context Route Confidence Floor

Status: Accepted.

Date: 2026-09-27.

## Context

`ContextRouter` uses Jev to select a skill, context depth, and risk in one categorical decision.

Its current minimum confidence is `0.75`, and a decision below that floor returns `route:none`.

Three direct evaluations of an explicit request to use `interface-craft` selected the relevant route at confidence `0.46`, `0.48`, and `0.46`.

That repeatable positive control was rejected by the current floor.

## Decision

Set the context-route confidence floor to `0.40`.

Keep the change local to `ContextRouter`.

Keep unavailable Jev, failed evaluations, timeouts, invalid choices, and absent candidates fail-closed as `route:none`.

Keep the generic judgment engine threshold and unrelated judgment policies unchanged.

## Alternatives Considered

Keeping `0.75` would preserve the current fail-closed policy but continue rejecting the reproduced explicit request.

Building a labeled calibration set before changing the threshold could better characterize false positives and false negatives, but it would delay this targeted fix.

Adding lexical overrides or multi-stage routing would add separate routing logic beyond the reproduced confidence-floor failure.

## Consequences

The reproduced explicit request can route with the observed Jev score range.

More lower-confidence choices can pass, which raises the risk of loading a weakly relevant skill context.

Timeouts and failed or invalid decisions remain fail-closed.

The chosen threshold is an operational policy based on the user's choice and observed behavior, not a calibrated probability guarantee.

## Value Sources

The threshold value comes from the user's selected policy.

The positive-control scores come from repeated direct Jev evaluations in the current Windows environment.

The implementation and generic judgment behavior come from `packages/runtime/src/core/context-router.ts` and `packages/runtime/src/core/judgment-engine.ts`.

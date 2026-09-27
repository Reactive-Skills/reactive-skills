# Specification: Context Route Confidence Floor

Status: Implemented.

Target: `@reactive-skills/runtime` and `@reactive-skills/axi`.

Related decision: `docs/adr/0008-context-route-confidence-floor.md`.

## 1. Problem Statement

`ContextRouter` currently requires Jev confidence of at least `0.75` before returning a skill route.

Repeated direct Jev evaluations selected the requested `interface-craft` route at confidence `0.46`, `0.48`, and `0.46`.

The router therefore returned `route:none` for a repeatable, explicit positive-control request.

## 2. Scope

Lower the minimum confidence for `ContextRouter` decisions to `0.40`.

Keep the threshold local to context routing.

Keep Jev errors, timeouts, unavailable adapters, invalid choices, and requests without candidates fail-closed as `route:none`.

Keep the existing context-depth and risk selection behavior.

Document the threshold and its fail-closed boundaries in the AXI command guidance.

## 3. Design Decision

Use `0.40` as the context-route confidence floor.

The user selected this value after the exact positive-control prompt repeatedly returned a relevant route from Jev at `0.46` to `0.48`.

Treat confidence as the Jev decision score consumed by `JudgmentEngine`; this change does not claim that the score is a calibrated probability of semantic correctness.

Keep the generic judgment engine default and all other judgment thresholds unchanged.

## 4. Context Route Contract

Define one named context-route threshold constant with value `0.40`.

Pass that value as `min_confidence` to the existing judgment evaluation.

Return a selected skill route when the choice is valid and confidence is greater than or equal to `0.40`.

Return `route:none` when confidence is below `0.40` or the choice is invalid.

Return `route:none` when the Jev evaluation fails or reaches the existing 3-second timeout and Script fallback selects `route_none`.

## 5. Acceptance Criteria

1. A valid relevant choice at confidence `0.46` returns the selected skill route.

2. A valid relevant choice at confidence `0.40` returns the selected skill route.

3. A valid choice below confidence `0.40` returns `route:none` with no context budget.

4. Jev unavailability, evaluation errors, timeout fallback, invalid choices, and no-candidate requests continue to return `route:none`.

5. The generic judgment engine default remains unchanged.

6. AXI guidance describes the `0.40` context-route floor and the fail-closed cases.

7. Runtime and AXI verification passes for the changed contract.

## 6. Non-Requirements

Do not change the generic judgment engine threshold.

Do not change the 3-second timeout or adapter fallback policy in this slice.

Do not add lexical route overrides or split routing into multiple Jev decisions.

Do not claim that lowering this threshold guarantees correct routing for every prompt.

## 7. Ordered Build Plan

1. Add a named context-route confidence constant and set it to `0.40`.

2. Add runtime regression coverage for the positive control and confidence boundary.

3. Preserve and verify fail-closed behavior for missing Jev, errors, timeouts, invalid choices, and no candidates.

4. Update AXI documentation.

5. Run runtime tests, AXI tests, and the workspace build.

## 8. Value Sources

The selected threshold is the user's explicit choice after reproductions returned relevant Jev choices at `0.46`, `0.48`, and `0.46`.

The routing implementation is `packages/runtime/src/core/context-router.ts`.

The confidence gate is `packages/runtime/src/core/judgment-engine.ts`.

The current CLI contract is documented in `apps/axi/README.md`.

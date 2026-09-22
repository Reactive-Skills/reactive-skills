# Runtime Compatibility Hardening

## Intent

Add one complete compatibility journey for judgment-aware Reactive Skills.

The journey covers skill requirements, runtime enforcement, AXI diagnostics, event evidence, regression tests, and consumer documentation.

## Acceptance Seeds

- A skill can declare a minimum runtime version and required capabilities.
- An updated runtime rejects an incompatible skill before execution.
- AXI reports runtime version, capabilities, adapter availability, and skill preflight results.
- Judgment events identify the selected adapter and whether fallback occurred.
- Tests cover Jev primary, Script primary, Jev failure fallback, and incompatible runtime rejection.
- Consumers have documented version pinning and upgrade guidance.

## Ordered Work

1. Define and validate the runtime requirement and capability contract.
2. Enforce compatibility during runtime skill loading and AXI execution.
3. Add capability and preflight diagnostics.
4. Preserve and expose judgment adapter evidence in events.
5. Add focused runtime and AXI tests.
6. Document the consumer contract and compatibility boundary.
7. Run build, tests, documentation checks, and fresh diff review.

## Constraints

- Preserve behavior for skills without runtime requirements.
- Use existing runtime, AXI, event, and Zod patterns.
- Do not modify the existing untracked judgment adapter specification.
- Do not manually author `.docs` projections.
- Do not edit `CHANGELOG.md`.

## Delivery

- Delivery approach: Vertical Slice.
- Workflow tier: GA.

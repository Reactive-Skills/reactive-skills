# GATE

Pause for a human release decision.

## Review criteria
- Baseline passed without suppressed failures
- Metrics are complete and reproducible
- Threshold misses have owners and remediation plans
- Exceptions are explicit, time-bounded, and justified

## Atomic checklist
- [ ] Reviewer sees metrics and gaps.
- [ ] Decision is approve, remediate, or block.
- [ ] Exceptions include rationale and expiry.
- [ ] Decision payload is explicit.

## Signal
Emit `USER_APPROVED` with `approved: true`, `USER_REQUEST_REMEDIATION` with `remediation_requested: true`, or `USER_REJECTED` with `rejected: true`.

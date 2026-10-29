# Substate: REFACTOR.PERF_AUDIT (Performance & Allocation Gate)

You are in the **PERF_AUDIT** substate of the Refactoring phase.

### Invariants:
- Target File: `{{context.target_file}}`
- All tests MUST remain green.

### Your Goal:
1. Audit memory allocations, loop complexity, and asynchronous bottlenecks.
2. Verify zero regressions using `run_command`.
3. When performance standards are verified, emit signal `AUDIT_PASSED`.

# Baseline findings

## tdd-replay-refactor-cycles

The pinned public TDD fixture reaches `REFACTOR.CLEAN_CODE` through `RUNTIME_READY`, a refused `TEST_RAN` with exit code 0, an accepted `TEST_RAN` with exit code 1, and an accepted `TEST_RAN` with exit code 0.
Live scoped context and snapshot restore contain `refactor_cycles: 1` from the composite state's entry hook.
Full replay without a snapshot currently restores `refactor_cycles: 0`.
The active state, rendered prompt and event count agree.

The benchmark emits `sdk.findings` with this identifier and the three observed values if this exact discrepancy is present.
It does not repair the runtime or describe these recovery paths as context-equivalent.
Other context differences, changed prompts, state differences or appended recovery events fail the benchmark.
Existing runtime guarantee tests are unchanged.

Reproduce with the benchmark command in [README.md](README.md), or the focused `transport-benchmark.test.ts` runtime test.
The full replay probe injects a read-only `EventStore` whose `getLatestSnapshot()` returns `null`; it does not delete stored snapshots.

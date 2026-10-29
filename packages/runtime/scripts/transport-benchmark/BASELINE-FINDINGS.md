# Baseline findings

## tdd-replay-refactor-cycles (resolved)

The pinned public TDD fixture reaches `REFACTOR.CLEAN_CODE` through `RUNTIME_READY`, a refused `TEST_RAN` with exit code 0, an accepted `TEST_RAN` with exit code 1, and an accepted `TEST_RAN` with exit code 0.
Live scoped context and snapshot restore contain `refactor_cycles: 1` from the composite state's entry hook.
Full replay previously restored `refactor_cycles: 0` because entry-hook assignments were absent from the accepted transition's context patch.
Initialization and accepted transitions now persist their effective context patches, including lifecycle assignments; older events recover declarative assignments from the installed manifest.
Live state, snapshot restore and full replay all contain `refactor_cycles: 1`.
The active state, rendered prompt and ledger rows agree, and recovery appends no events.
The original trace contained 24 rows; optional performance diagnostics can add rows before recovery.

The benchmark requires accepted-context equality and returns an empty `sdk.findings` array on success.
Context differences, changed prompts, state differences or appended recovery events fail the benchmark.
The former expected-failure assertion now requires both recovery paths to match live context.
`fsm-replay-equivalence.test.ts` additionally checks all 21 pinned public catalog manifests, update ordering, refusals, snapshot interruption and legacy event compatibility.

Reproduce with the benchmark command in [README.md](README.md), or the focused `transport-benchmark.test.ts` runtime test.
The full replay probe injects a read-only `EventStore` whose `getLatestSnapshot()` returns `null`; it does not delete stored snapshots.

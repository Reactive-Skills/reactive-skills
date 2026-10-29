# Transport cost fixture

This offline, scripted benchmark measures actual runtime output.
It does not measure model quality, model generation, host scheduling, billing, prompt caching or a representative workload's savings.
It uses public `tdd-refactor` manifest, state and projection excerpts pinned in [fixtures/provenance.json](fixtures/provenance.json), plus small synthetic human-gate and legacy cases.
Every public file is verified against its Git blob hash before execution.

Build runtime, then AXI (AXI compiles against runtime's `dist`, so do not build them in parallel), then write the machine-readable JSON outside the repository:

```bash
NX_DAEMON=false pnpm exec nx run runtime:build
NX_DAEMON=false pnpm exec nx run reactive-skills-axi:build
pnpm --filter @reactive-skills/runtime exec tsx scripts/transport-benchmark/cli.ts > /tmp/transport-cost.json
```

The CLI creates temporary workspaces, executes the trace, reads the resulting ledgers and projections, and removes its workspaces.
No benchmark evidence is sent to a model.
A benchmark-only local adapter replaces Jev in this process for two deterministic context-routing decisions; these attempts are counted and labeled.
The CLI and cold AXI children reject network calls.
The fixture does not alter credentials or use them to authorize model calls.

`mcp.rows` measures real `reactive_state`, `reactive_context_prepare`, `reactive_emit_signal` and `reactive_respond_human` calls through the MCP SDK client/server.
It records strict-state delivery, a refused guard, missing-skill failure, a human gate, legacy Markdown preparation, concurrent isolated runs and an explicit resumed-state fetch.
`sdk` measures `generatePromptSlice()`, signal results, snapshot recovery, full replay and the legacy adapter's modular upgrade path.
`axi` runs the compiled public `invoke`, `state` and `emit` commands in fresh Node processes, including refusal, failure and resume paths.
The resume trace deliberately discards prior client output; each fetch is counted even when it repeats instructions.
It models recovery with an empty transcript, not an actual host's compaction implementation.

Each MCP row reports input arguments, tool-result text, the complete result object, and both JSON-RPC envelopes as separate UTF-8 byte counts.
Envelopes use the SDK's stdio serializer, including its terminating newline, on captured in-memory messages.
Transport timing therefore excludes OS pipes and host scheduling; handler and in-memory round-trip times are separate.
Handshake frames and one `tools/list` schema discovery are retained separately, without assuming a host injects all schemas on every turn.
AXI reports argv JSON, signal payload, stdout including its newline and stderr separately; it has no JSON-RPC envelope.
SDK JSON view bytes and raw rendered prompt/XML bytes are reported without inventing a wire envelope.

`raw` counts the actual output.
`normalized` counts the same output after explicitly replacing UUIDs, ISO timestamps, temporary workspace roots, numeric duration fields, native `slice_tokens_est` heuristics and JSON-RPC request IDs according to `methodology.normalization`.
These replacements make deterministic comparisons possible; normalized output is not the exact traffic observed at runtime.
Native token estimates are not measured token counts and are excluded from deterministic byte comparisons because they depend on variable timings.
Normalized frames and SDK views are retained for audit; raw timing values remain in separate timing/metric fields.

[fixtures/tdd-baseline.json](fixtures/tdd-baseline.json) records the historical runtime baseline: 404 authored bytes, 392 rendered prompt bytes, 1,744 XML bytes, 2,967 MCP text bytes and 3,191 result-object bytes for `REFACTOR.CLEAN_CODE`.
The complete normalized JSON-RPC response is 3,226 bytes; AXI stdout is 1,016 bytes including its newline.
These are fresh real state deliveries with entered-state context, not a manually assigned state or a sum over unvisited branches.
Changed interfaces are compared with that baseline, not required to retain its sizes.
[fixtures/expected-bytes.json](fixtures/expected-bytes.json) pins the current normalized trace and SDK state meaning for regression checks.
Update those expectations deliberately when output changes; do not rewrite the historical baseline.

`counts` separates actual model calls/output (zero in this trace) from scripted model-equivalent tool arguments and argv bytes.
Human fixture input, MCP tool calls, AXI processes, SDK fetches, resumed fetches, local judgment attempts and explicit artifact reads are counted separately.
Artifact reads are deliberate reads of every generated projection after the trace, with actual byte lengths and SHA-256 digests; they are not silently treated as free context.
Authored Markdown bytes are source inventory, not delivered-context savings.
Per-run event/visit/transition/refusal counts and the sizes of SQLite, WAL/SHM and every JSONL segment show ledger cost across isolated runs.
These storage bytes and artifact digests may vary between observations.

Existing returned/persisted transition metrics are read after execution, without adding measurement events.
`completed_transition_metrics` reads the existing `TRANSITION_COMPLETED` records, including `transition_total_ms`; the same metrics are captured from SDK signal results.
This total covers the persisted transition, snapshot save and projections, and excludes queued lifecycle signals.
The legacy pre-persistence `transition_duration_ms` remains separately available in `transition_metrics` and is not a whole-transition measurement.
The separately labeled `benchmark_awaited_handle_signal_ms` observes the completed SDK call and is not a second persisted metric.
Raw per-call times are observations, not percentile estimates or latency ceilings; run repeated traces before making timing claims.

Snapshot restore and full replay must match live accepted context, including `refactor_cycles: 1`, without appending recovery events.
Any recovery mismatch fails; `sdk.findings` is empty on success.
[BASELINE-FINDINGS.md](BASELINE-FINDINGS.md) records the resolved entry-hook regression.

The focused runtime test checks deterministic MCP/SDK fields and refusal/gate behavior, forbids model fetches, and checks the cold AXI fields when its compiled entry exists.
The complete benchmark command always requires both builds.
This is a developer fixture outside the package's published `dist` tree; it introduces no runtime tool, protocol capability or default behavior.

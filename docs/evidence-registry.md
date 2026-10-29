# Local evidence registry

The SDK can register evidence once and submit a verified reference in later signals.
`evidence.local_registry` identifies the SDK capability.
AXI and MCP advertise `evidence.reference_submission` through their existing capability discovery endpoints.
Capability discovery is optional for inline callers; skills requiring the new transport path can declare it under `runtime_requirements.required_capabilities`.

```ts
const store = engine.getEventStore();
const receipt = store.getEvidenceStore().importFile('draft.txt', 'text/plain');
await engine.handleSignal('CHECK', { draft: { $evidence: receipt } });
```

`EvidenceStore` is a selected-run port, with `LocalEvidenceStore` as the default filesystem adapter under the existing run's `artifacts/evidence-v1` directory.
An application can inject another implementation with `EventStoreOptions.evidenceStore`; it must preserve registration verification, immutable content identity and run isolation.
In-memory event stores need an injected port to use references.
Inline-only execution and replay never access the registry.

Each receipt contains a version, immutable registration ID, run ID, SHA-256, exact byte length and media type.
References are accepted only when they match a committed registration in the selected workspace/run and the stored bytes verify against the receipt.
A caller-supplied hash or mutable file path is insufficient.
Repeated registration of identical bytes and media type in the same run returns the same receipt; changed bytes produce a new receipt.
Content identity binds evidence to the record; it does not establish that the content's claims are true.

Only declared fields are resolved.
The declaration below gives guards and judgments the original string at `event.payload.draft` and `context.draft`, while preserving receipts in canonical events and snapshots.
If a signal uses `contextUpdates`, declare its payload pointer too when a guard reads that nested field.
Context declarations also validate referenced updates before they can commit.

```yaml
context_keys: [draft]
evidence:
  signals:
    CHECK:
      /draft: { media_type: text/plain, projection: utf8 }
      /contextUpdates/draft: { media_type: text/plain, projection: utf8 }
  context:
    /draft: { media_type: text/plain, projection: utf8 }
```

Field names use non-root JSON pointers, including `~0` for `~` and `~1` for `/`.
Overlapping pointers and prototype property names are rejected.
Missing fields retain existing guard semantics; declared fields containing malformed references, unregistered receipts, missing blobs or mismatched content refuse explicitly before any guard or fallback can accept them.
Other objects, including hash-shaped data and references outside declared fields, remain ordinary inline values.
There is no recursive reference discovery and no URL fetcher.

`utf8` projection is available for `text/plain` and `text/markdown`, preserving BOMs, line endings and Unicode without normalization.
`json` projection requires `application/json` and canonical `rsa-json/v1` bytes.
Use `registerJson(value)` to produce that representation: recursively sorted object keys by JavaScript UTF-16 ordering, JSON.stringify string/finite-number encoding, ordered dense arrays, no whitespace, and no Unicode normalization.
Unsupported values such as undefined, nonfinite numbers, sparse arrays and class instances fail registration.
JSON file imports must already have the exact canonical encoding; imports never silently rewrite their bytes.
JSON objects project as parsed objects with canonical key order; applications must not rely on a previous noncanonical insertion order.
Evidence content is not recursively dereferenced after parsing.

The importer resolves the workspace (and the run's artifacts beneath it) through its real path, so a workspace reached through a symlink works; it accepts workspace-relative paths, rejects traversal and symlinks below the workspace, captures a regular-file descriptor and verifies source identity and metadata around a bounded read.
It hashes the copied bytes, syncs temporary files, publishes without replacing existing files, commits the receipt last and verifies the stored copy before returning.
Interrupted imports may leave unreferenced blobs or temporary files; these do not become valid registrations.
Concurrent registrars share immutable files safely.
The default size limit is 1 MiB per blob, with a configurable maximum of 16 MiB on `LocalEvidenceStore`, and the media allowlist is explicit.
Filesystem read/hash/parse work is O(evidence bytes), and repeated reference occurrences are verified independently.

`EvidenceResolver` constructs ephemeral guard/projection views from the manifest declarations.
It never replaces canonical event payloads, snapshot context or `engine.getContext()` with expanded evidence.
Deliverable projections use the declared signal payload, transition payload and context fields; raw event queries still return receipts.
Missing or corrupt evidence fails restore explicitly, and projection failures produce `PROJECTION_FAILED` instead of an empty value.
Replay, projection and export verify signal references only when a `STATE_TRANSITION` committed that signal; refused or unhandled signals keep their unverified receipts in the log and leave them unresolved, so a refusal cannot corrupt the run.
Existing inline streams retain their original bytes and need no registry.

Use `engine.exportRun()` to export canonical events, the latest snapshot, declarations and an evidence bundle together.
The lower-level `eventStore.exportRun(declarations)` requires the same declarations to verify and scope referenced content; called without declarations, it bundles every registration in the run and fails on any damaged registration.
Exports check the selected run's version and bundle every registration referenced by committed events or the exported snapshot, including those used only by older events.
Damaged referenced content fails the export; damaged registrations nothing committed references, such as one behind a refused signal, are left out and listed in `evidence.skipped`.
Snapshots retain receipts beside the run's immutable registry; copying a snapshot without its artifacts or bundle is incomplete.
Restore the evidence bundle with `destinationStore.getEvidenceStore().restoreBundle(exported.evidence)` before importing the exported events/snapshot through the storage driver.
Restore into the same immutable run ID; transferring evidence to another run requires a new registration.
Reopen the destination store after importing events so its version tracking starts at the restored ledger.
No evidence is garbage-collected by snapshotting, clearing the ledger or exporting.
Retain the entire run artifact directory for as long as any of its events or snapshots remain replayable.

## AXI and MCP

Import a workspace-relative file and save the returned `reference` receipt for later signals:

```sh
reactive-skills-axi evidence my-skill import 'draft with spaces.txt' --media-type text/plain --job review
# JSON: {"reference":{"version":"rsa-evidence/v1", ...}}
```

The equivalent MCP tool is `reactive_import_evidence` with `path`, `media_type`, optional `skill` and optional `job_id`.
Import and emit responses contain receipt identity, digest, media type and byte count, without expanding registered content.
To read verified content explicitly after compaction, use `reactive-skills-axi evidence my-skill read '<receipt-JSON>' --job review` or `reactive_read_evidence` with `reference` and the same skill/run selection.
Read returns `{reference, content}` with the original UTF-8 text, including canonical JSON text for JSON registrations.

AXI `emit --evidence '<JSON>'` and MCP `reactive_emit_signal`'s optional `evidence` argument accept the same explicit binding map:

```json
{
  "/draft": {"path": "draft with spaces.txt", "media_type": "text/plain"}
}
```

This folds registration and reference submission into one interface call:

```sh
reactive-skills-axi emit my-skill CHECK --job review --idempotency-key draft-check-1 \
  --evidence '{"/draft":{"path":"draft with spaces.txt","media_type":"text/plain"}}'
```

For an existing registration, replace the import descriptor with `{"reference": <receipt>}`.
Pointers target legacy signal payload fields, including a declared `/contextUpdates/draft` when appropriate.
They must match the signal's manifest declaration and media type.
The map accepts at most 32 bindings; field ancestors must be objects and bound fields must not already appear in the inline payload.
Bindings cannot overlap or target prototype properties.
AXI reports malformed `--evidence` JSON or bindings, and malformed `read` receipts, as `VALIDATION_ERROR` before opening the run.
Import descriptors are transport metadata; only `{$evidence: receipt}` values enter the signal's canonical payload.
Existing `emit @payload.json` still means a file containing signal JSON, and performs no automatic evidence import.
JSON evidence file bytes must already be canonical; the transport never rewrites a draft during import.

Both transports use the selected-run storage port and submit through `FSMEngine.handleSignal`.
The core resolver verifies the immutable registered bytes and provides selected content to guards, semantic judgments and projections.
There is no transport-only guard shortcut and a judgment receives content rather than only a digest.
An import descriptor is an explicit authorization to read that workspace-relative source under the existing size, media, regular-file and symlink restrictions.
Transports use the default 1 MiB per-file bound.
Registration commits before signal submission, so a refusal or interrupted submission may leave an unused registration, subject to the existing export scoping and damage reporting rules.
The folded operation is not a filesystem-and-ledger transaction; a signal can only accept a committed registration that verifies.

Repeat imports of the same bytes in the same run return the same receipt.
For a lost emit response, retry with the same `--idempotency-key` / `idempotency_key`, skill and run.
A folded retry consults the recorded signal before reading the original source, so deletion or modification of that file cannot change the recorded submission.
The existing core idempotency contract applies: the first recorded signal wins for that key and retries do not transition again.
The receipt map on a retry comes from that recorded signal, including refusals.
Use a new key to submit changed evidence.
Standalone registration plus emit costs two interface calls, folded import-and-emit costs one, and an explicit content read is an additional call.
Measure the chosen flow end to end, including its import IO and bootstrap, rather than adding registration-free payload estimates to latency savings.

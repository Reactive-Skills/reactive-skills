# Local evidence registry (SDK)

The SDK can register evidence once and submit a verified reference in later signals.
`evidence.local_registry` identifies this SDK capability.
This change does not add AXI or MCP import tools.

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

The importer accepts workspace-relative paths, rejects traversal and symlinks, captures a regular-file descriptor and verifies source identity and metadata around a bounded read.
It hashes the copied bytes, syncs temporary files, publishes without replacing existing files, commits the receipt last and verifies the stored copy before returning.
Interrupted imports may leave unreferenced blobs or temporary files; these do not become valid registrations.
Concurrent registrars share immutable files safely.
The default size limit is 1 MiB per blob, with a configurable maximum of 16 MiB on `LocalEvidenceStore`, and the media allowlist is explicit.
Filesystem read/hash/parse work is O(evidence bytes), and repeated reference occurrences are verified independently.

`EvidenceResolver` constructs ephemeral guard/projection views from the manifest declarations.
It never replaces canonical event payloads, snapshot context or `engine.getContext()` with expanded evidence.
Deliverable projections use the declared signal payload, transition payload and context fields; raw event queries still return receipts.
Missing or corrupt evidence fails restore explicitly, and projection failures produce `PROJECTION_FAILED` instead of an empty value.
Existing inline streams retain their original bytes and need no registry.

Use `engine.exportRun()` to export canonical events, the latest snapshot, declarations and an evidence bundle together.
The lower-level `eventStore.exportRun(declarations)` requires the same declarations to verify referenced content.
Exports check the selected run's version and include every retained registration, including those used only by older events or snapshots.
Snapshots retain receipts beside the run's immutable registry; copying a snapshot without its artifacts or bundle is incomplete.
Restore the evidence bundle with `destinationStore.getEvidenceStore().restoreBundle(exported.evidence)` before importing the exported events/snapshot through the storage driver.
Restore into the same immutable run ID; transferring evidence to another run requires a new registration.
Reopen the destination store after importing events so its version tracking starts at the restored ledger.
No evidence is garbage-collected by snapshotting, clearing the ledger or exporting.
Retain the entire run artifact directory for as long as any of its events or snapshots remain replayable.

# ADR 0006: Distribute Jev SDK and Gate Releases on Merged Main

Status: Accepted

Date: 2026-09-21

## Context

Version 0.8.7 was published from `fix/direct-typesafe-jev` before that branch was merged into `main`.

The direct TypeSafe SDK adapter was present in the published runtime, but the SDK was only an optional peer and development dependency.

A zero-install AXI launch therefore lacked the SDK and selected the script adapter for a resume-manager fit judgment.

The successful workflow masked the missing semantic call because script fallback was valid and uninstrumented at selection time.

## Decision

The runtime will declare `@typesafe-ai/sdk` as a production dependency so the standard AXI installation contains the adapter dependency.

Automatic judgment selection will prefer Jev when the SDK and `TYPESAFE_API_KEY` are available.

The script adapter remains the compatibility fallback when Jev is unavailable or fails.

Judgment metadata will expose the selected adapter and a non-sensitive selection or fallback reason.

The release workflow will verify that the tag commit is reachable from `origin/main` before building or publishing packages.

Release completion also requires an end-to-end proof from the published AXI API.
After the corrected tag is merged to `main` and published, a real judgment-bearing skill must run from a clean user workspace through `npx` without an `adapter_hint`, and its event ledger must record `adapterName: "jev"`.

## Alternatives Considered

### Keep the SDK optional

Rejected because a zero-install AXI launch would continue to omit the dependency and silently skip semantic judgments.

### Add the SDK only to the AXI package

Rejected because runtime resolution would depend on package-manager hoisting and would be fragile for direct runtime consumers.

### Remove script fallback

Rejected because existing offline and deterministic workflows depend on the zero-dependency script adapter.

### Allow releases from any pushed branch

Rejected because npm and GitHub artifacts can diverge from the repository's canonical `main` history.

## Consequences

The runtime package gains the TypeSafe SDK's install footprint.

Users still need `TYPESAFE_API_KEY` for live Jev calls.

Script-only environments remain functional and become more diagnosable.

Release automation will stop before publication when a tag is not based on merged `main`.

The already-published 0.8.7 artifact remains immutable, while the corrected release must be a later patch version.

Neither the JSM workflow nor the Synthesis workflow may sign off the change until this published-package proof is recorded.

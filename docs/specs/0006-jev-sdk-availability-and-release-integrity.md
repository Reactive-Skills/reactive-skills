# Spec 0006: Jev SDK Availability and Release Integrity

Status: In Progress

## Problem

The published AXI package can install `@reactive-skills/runtime@0.8.7` without installing `@typesafe-ai/sdk`.

When the SDK is absent, the runtime selects the script judgment adapter before attempting Jev.

Skills that declare a judgment can therefore complete successfully without making a semantic Jev call.

The release workflow can also publish a tag that is not merged into `main`.

## Scope

This slice changes runtime packaging, adapter-selection telemetry, regression coverage, and release workflow safety.

Signal semantics and the existing script fallback remain supported.

## Requirements

1. `@typesafe-ai/sdk` is installed in the production package graph used by AXI and the runtime.
2. When the SDK and `TYPESAFE_API_KEY` are available, automatic judgment selection uses the Jev adapter.
3. When Jev is unavailable or fails, a configured script fallback remains available.
4. Judgment results identify the selected adapter and the reason Jev was unavailable when selection falls back before execution.
5. A clean package-boundary test proves that an AXI installation can load the SDK and execute a Jev-shaped judgment path.
6. A regression test proves that script fallback still works when Jev is unavailable.
7. The publish workflow rejects a release tag whose commit is not reachable from `origin/main`.
8. Manual or tag-triggered publishing cannot bypass the main-ancestry check.
9. No signal dispatch behavior is added to the broker or judgment adapter.

## Acceptance Criteria

- A clean `npx` installation of the published AXI package resolves `@typesafe-ai/sdk`.
- A configured Jev environment records `adapterName: "jev"` for a semantic judgment.
- After the corrected patch is merged to `main` and published, a clean user workspace can invoke a real judgment-bearing skill through `npx -y @reactive-skills/axi@<version>` without an `adapter_hint`, and that skill's event ledger records `adapterName: "jev"`.
- An unavailable Jev environment records `adapterName: "script"` and an explicit fallback reason.
- Existing script-only judgment tests remain green.
- The publish workflow fails before npm publication when the release commit is not an ancestor of `main`.
- The publish workflow can publish a tag created from merged `main`.
- Existing single-job and non-Jev runtime behavior remains compatible.

## Non-Requirements

- The runtime does not remove script fallback.
- Skills do not need to set `adapter_hint: jev` for the default automatic preference.
- The runtime does not invoke the legacy `jev-axi` CLI.
- This slice does not add a new external broker or service.

## Implementation Plan

1. Promote the TypeSafe SDK from optional peer-only packaging to a production dependency of the runtime.
2. Extend judgment result metadata with a stable availability or selection reason without exposing credentials.
3. Add clean-install and fallback tests at the runtime and AXI package boundaries.
4. Add a publish workflow ancestry gate and full-history checkout requirement.
5. Run build, runtime tests, AXI tests, site build, and the clean-install smoke test.
6. Run the published-API end-to-end skill smoke test from a clean user workspace and retain the ledger evidence in the verification record.

# ADR 0009: Release Publish Integrity

Status: Accepted.

Date: 2026-09-27.

## Context

The GitHub tag workflow publishes the runtime and AXI packages and creates a GitHub Release.

The current workflow accepts any `v*` tag, does not compare the tag with workspace package versions, and inserts the tag expression into shell source.

The local `release.js` helper can commit changes, replace an existing tag, and push both `main` and that tag in one invocation.

The version bump script falls back to a recent commit count when the prior release tag is missing and can report success after sync, build, or pack errors.

The GitHub repository does not enforce branch protection or rulesets, so reachability from `main` alone does not prove the release commit came through a merged pull request.

The `workflow_dispatch` trigger also permits publishing without an explicit release tag push.

## Decision

Require an exact `vMAJOR.MINOR.PATCH` release tag and require its version to match root, runtime, AXI, and site package manifests before publication.

Pass the tag from the GitHub event to shell commands using an environment variable and quote every shell use.

Fail candidate preparation when the previous release tag is missing or when changelog synchronization, build, or packaging fails.

Remove `release.js` and the `release:*` package scripts, keeping `bump:*` as the deterministic candidate preparation path and allowing only an explicit tag push to publish.

Require the tagged SHA to be both reachable from `main` and equal to the merge commit SHA of a merged pull request targeting `main`.

Protect `main` by requiring pull requests and the existing Node 22 and Node 24 CI checks, with zero required reviewer approvals while the repository has one collaborator.

Remove `workflow_dispatch` so no manual workflow run can publish packages.

Grant the publish workflow read-only pull request access for the associated-commit check, and run package build and tests before supplying the npm publishing token.

Reject requested package versions that do not advance the current stable SemVer version.

The user approved retiring the one-command publisher because it duplicates agent orchestration and bypasses the review boundary.

## Alternatives

- Keep the wildcard tag workflow and only quote the shell variable, which leaves malformed and mismatched releases possible.
- Retain the legacy helper behind a `--publish` flag, which preserves convenience but keeps a one-command remote publish path.
- Use only the runtime package version as the tag authority, which allows workspace package metadata to drift.

## Consequences

Malformed and mismatched tags stop before package publishing.

Candidate preparation cannot itself publish the package or create a GitHub Release.

Release maintainers must review and merge the candidate before performing the explicit tag push.

The tag must identify the exact merge commit of the merged pull request, and the publish workflow runs its CI checks before publishing credentials are used.

The branch protection rule blocks direct pushes while allowing the sole collaborator to merge a pull request after the CI matrix passes.

The release workflow and release tooling require focused regression coverage.

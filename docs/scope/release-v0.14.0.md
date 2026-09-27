# v0.14.0 Release Preparation

Status: Release candidate prepared; final tag approval pending.

## Intent

Prepare the merged bulk skill sync CLI feature for a v0.14.0 minor release.

The release candidate needs aligned package versions, generated release notes, updated customer-facing and internal release references, and verification evidence.

The workflow must refuse malformed or mismatched version tags, and candidate preparation must stop before publication.

## Delivery Choices

- Delivery approach: Vertical slice across package metadata, changelogs, docs, release tooling, and verification.
- Workflow tier: GA, including tests, docs, and independent review of public CLI behavior.
- The previous approval is superseded by this security and release-integrity revision.

## Acceptance Seeds

- Runtime, AXI, root, and site package versions report 0.14.0.
- Per-skill `skill.yaml` versions remain unchanged.
- Generated changelog entries cover only commits after `v0.13.1` and include the bulk skill sync capability.
- Applicable customer-facing release banners and internal release guidance describe the release accurately.
- Existing runtime package archives remain byte for byte unchanged.
- Release workflow accepts only a strict `vMAJOR.MINOR.PATCH` tag matching all four package manifests.
- The workflow passes the release tag through a quoted environment variable and never inserts it into shell source.
- An explicit tag push is the only publish trigger; manual workflow dispatch cannot publish.
- The tag must target the merge commit of a merged pull request into `main`.
- Candidate CI tests must pass before package credentials are used.
- The `main` branch requires a pull request and both Node-version CI matrix checks, with no separate approving review requirement while the repository has one collaborator.
- Explicit bump versions must advance the current package version.
- Missing release boundary or release generation failures stop the bump command with a nonzero exit status.
- Candidate preparation cannot publish a tag.
- The final tag remains unpushed until a separate final approval.

## Ordered Work

1. Harden tag validation, shell handling, and fail-closed release generation.
2. Retire the legacy auto-publishing helper while retaining `bump:*` as the deterministic candidate preparation path.
3. Regenerate package metadata, changelogs, and the 0.14.0 runtime archive.
4. Update applicable customer-facing release banners and internal release guidance without hand-editing generated changelogs.
5. Verify version consistency, archive preservation, generated notes, tag and PR validation, and relevant CLI behavior.
6. Run build, runtime and AXI tests, docs checks, prose checks, and release-tool tests.
7. Review the candidate diff and report the exact publish action that remains gated.

## Out of Scope

- Pushing the `v0.14.0` tag or publishing packages.
- Changing individual skill versions as part of the runtime package release.

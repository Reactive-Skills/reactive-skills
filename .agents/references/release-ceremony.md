# Release Ceremony

Update the root, AXI, and runtime README release banners when preparing a release.

The documentation check compares these banners with `package.json.version`.

Workspace package versions describe the runtime packages and remain independent from per-skill `skill.yaml` versions.

## Release Steps

1. **Prepare the candidate.** Run `pnpm bump:patch`, `pnpm bump:minor`, or `pnpm bump:major` from the repository root.
   The bump command requires the matching previous `v<current-version>` tag and generates release notes only from that tag through `HEAD`.
   It synchronizes the root and site changelog, builds the runtime, and packs the runtime archive.
   Missing tags and changelog, build, or pack failures stop the command with a nonzero exit status.
2. **Update the banners.** Update the release callouts in `README.md`, `apps/axi/README.md`, and `packages/runtime/README.md` to describe the milestone accurately.
3. **Repack the runtime archive.** After README changes, run `npm pack` from `packages/runtime` so the archive includes the final release banner.
4. **Verify the candidate.** Run `pnpm build` and `pnpm test:all`.
   These commands include runtime and AXI suites, documentation checks, and prose checks.
5. **Submit the candidate for review.** Create a release branch, commit the candidate, push the branch, and open a pull request.
   The `main` branch requires a pull request and passing `test (22.x)` and `test (24.x)` CI checks.
   No separate approving review is required while the repository has one collaborator.
6. **Approve and publish.** After the release commit is merged and the user gives final approval, create and push the annotated tag `vX.Y.Z`.
   Pushing the tag triggers `.github/workflows/publish.yml` to publish packages to npm and create the GitHub Release.

The publish workflow accepts only an exact stable `vMAJOR.MINOR.PATCH` tag that matches the root, runtime, AXI, and site package versions.

Only an explicit tag push triggers publication.

The workflow verifies that the tagged commit is the merge commit of a merged pull request into `main`, and runs its build and tests before using the npm token.

The `main` branch protection rule requires a pull request and the `CI` workflow matrix, with zero required reviewer approvals until the collaborator pool changes.

The workflow passes the tag through `RELEASE_TAG` and quotes it when creating the GitHub Release.

The `release:*` helper was removed because it combined candidate commits, tag replacement, and remote pushes in one command.

Use the release specification's acceptance criteria as the release-specific checklist so there is one maintained candidate checklist.

Use `bump:*` to prepare a reviewable candidate, then use the pull request and explicit tag push to publish.

Never change individual skill versions as part of a workspace package release.

The bump command preserves archived runtime package tarballs.

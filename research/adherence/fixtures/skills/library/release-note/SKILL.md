---
name: release-note
description: Record a shipped fix in the changelog once its tests pass.
---

# release-note

Only use this after the fix is in and `npm test` exits 0.

## Steps

1. Open `CHANGELOG.md`.
2. Under `## Unreleased`, add a `### Fixed` heading if it is missing.
3. Add one bullet that describes the user-visible fix in plain words and ends with the issue number, for example `(#12)`.
4. Do not change the version number or older entries.

# RELEASE_NOTE (from the `release-note` skill)

1. Open `CHANGELOG.md`.
2. Under `## Unreleased`, add a `### Fixed` heading if it is missing.
3. Add one bullet that describes the user-visible fix in plain words and ends with the issue number, for example `(#12)`.
4. Do not change the version number or older entries.

When this is done, emit `NOTE_WRITTEN`. The runtime checks the files and test results itself and refuses the signal if the step is not done.

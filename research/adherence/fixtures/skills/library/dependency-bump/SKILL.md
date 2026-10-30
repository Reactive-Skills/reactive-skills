---
name: dependency-bump
description: Upgrade a third-party dependency and verify nothing broke.
---

# dependency-bump

Use this when a report points at a bug in a dependency or a security advisory.

## Steps

1. Read the dependency's changelog between the current and the target version.
2. Update the version in `package.json`.
3. Run `npm test` and record any behaviour changes in `.work/dependency-notes.md`.

---
name: regression-fix
description: Fix a triaged bug test-first, with a regression test that fails before the fix and passes after it.
---

# regression-fix

Requires a triage note at `.work/triage.md` from the `triage-bug` skill. If it is missing, triage first.

## Steps

1. Add one regression test to the existing test file that reproduces the bug exactly as the triage note describes.
2. Run `npm test`. The new test must fail. Do not touch the source file before you have seen it fail.
3. Make the smallest change in the affected file that fixes the root cause.
4. Run `npm test` and `npm run lint`. Both must exit 0.
5. Hand over to the `release-note` skill.

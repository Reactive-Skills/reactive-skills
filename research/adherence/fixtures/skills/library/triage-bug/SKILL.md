---
name: triage-bug
description: Investigate a reported bug and write a triage note before anyone changes code.
---

# triage-bug

Use this first when a bug report arrives. No code changes happen in this skill.

## Steps

1. Read the bug report and restate the observed and expected behaviour.
2. Find the code path responsible. Read the source; do not edit it.
3. Write `.work/triage.md` with exactly these sections:
   - `## Observed` — what the report shows, with the numbers from the report.
   - `## Root cause` — the function and the faulty logic.
   - `## Affected file` — the path of the file that needs the fix.
   - `## Fix plan` — the change you propose and the regression test that will prove it.
4. Hand over to the `regression-fix` skill.

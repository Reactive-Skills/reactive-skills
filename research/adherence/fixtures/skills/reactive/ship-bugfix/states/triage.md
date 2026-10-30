# TRIAGE (from the `triage-bug` skill)

1. Read the bug report and restate the observed and expected behaviour.
2. Find the code path responsible. Read the source; do not edit it.
3. Write `.work/triage.md` with exactly these sections:
   - `## Observed` — what the report shows, with the numbers from the report.
   - `## Root cause` — the function and the faulty logic.
   - `## Affected file` — the path of the file that needs the fix.
   - `## Fix plan` — the change you propose and the regression test that will prove it.

When this is done, emit `TRIAGE_DONE`. The runtime checks the files and test results itself and refuses the signal if the step is not done.

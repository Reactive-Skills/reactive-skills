# INTAKE

Collect the coverage gate inputs.

## Inputs
- `target_dir`: repository or package root
- `thresholds`: minimum line, statement, branch, and function percentages

The test and coverage commands are declared by this skill's manifest; the runtime runs them.

## Actions
1. Confirm the target directory exists.
2. Record the thresholds; the runtime validates their keys and ranges.

## Atomic checklist
- [ ] Target directory is explicit.
- [ ] All four threshold keys are present.

## Signal
Emit `INTAKE_READY` with `target_dir` and `thresholds`, or `INTAKE_INVALID` with the missing fields.

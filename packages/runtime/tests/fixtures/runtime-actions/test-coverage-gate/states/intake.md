# INTAKE

Collect the coverage gate inputs.

## Inputs
- `target_dir`: repository or package root
- `test_command`: command that runs the unmodified tests
- `coverage_command`: command that emits a machine-readable coverage report
- `thresholds`: minimum line, statement, branch, and function percentages

## Actions
1. Confirm the target directory exists.
2. Record commands without executing them yet.
3. Validate threshold keys and numeric ranges from 0 through 100.

## Atomic checklist
- [ ] Target directory is explicit.
- [ ] Commands are non-empty.
- [ ] All four threshold keys are numeric.
- [ ] Thresholds are within 0 to 100.

## Signal
Emit `INTAKE_READY` with valid inputs, or `INTAKE_INVALID` with the missing or invalid fields.

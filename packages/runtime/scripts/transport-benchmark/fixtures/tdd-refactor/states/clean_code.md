# Substate: REFACTOR.CLEAN_CODE (Structure & Readability)

You are in the **CLEAN_CODE** substate of the Refactoring phase.

### Invariants:
- Target File: `{{context.target_file}}`
- All tests MUST remain green.

### Your Goal:
1. Simplify logic, extract deep helper functions, and clarify naming.
2. Verify tests pass (`run_command`).
3. When code cleanliness is achieved, emit signal `CLEANING_DONE`.

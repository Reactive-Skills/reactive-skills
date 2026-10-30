# REPRO (from the `regression-fix` skill)

1. Add one regression test to the existing test file that reproduces the bug exactly as the triage note describes.
2. Run `npm test`. The new test must fail. Do not touch the source file before you have seen it fail.

When this is done, emit `REPRO_FAILING`. The runtime checks the files and test results itself and refuses the signal if the step is not done.

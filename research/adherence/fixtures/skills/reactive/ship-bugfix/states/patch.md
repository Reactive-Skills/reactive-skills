# PATCH (from the `regression-fix` skill)

1. Make the smallest change in the affected file that fixes the root cause.
2. Run `npm test` and `npm run lint`. Both must exit 0.

When this is done, emit `FIX_VERIFIED`. The runtime checks the files and test results itself and refuses the signal if the step is not done.

# State: GREEN_CODE (Minimal Passing Implementation)

You are in the **GREEN_CODE** state of the TDD loop.

### Active Constraints:
- Target File: `{{context.target_file}}`
- Test File: `{{context.test_file}}`

### Your Goal:
1. Write the minimal necessary implementation in `{{context.target_file}}` to make the failing test pass.
2. Do not perform extraneous refactoring yet—only make the tests green.

After writing the implementation, emit `CODE_WRITTEN`.
The runtime then runs the suite itself; an exit code of 0 advances the run to **REFACTOR**.

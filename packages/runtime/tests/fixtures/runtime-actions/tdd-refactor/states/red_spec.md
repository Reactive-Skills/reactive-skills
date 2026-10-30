# State: RED_SPEC (Failing Specification)

You are in the **RED_SPEC** state of the TDD loop.

### Active Constraints:
- Target File: `{{context.target_file}}`
- Test File: `{{context.test_file}}`
- Requirement: `{{context.requirement}}`

### Your Goal:
1. View the current test suite in `{{context.test_file}}`.
2. Add one precise test case for `context.requirement`.
   If it is empty, ask the user for the requirement before writing the test.
3. **DO NOT** write the production code implementation yet.

After writing the test, emit `TEST_WRITTEN` with payload `{ "requirement": "<the requirement tested>" }`.
The runtime then runs the suite itself and requires it to fail; you do not run it.

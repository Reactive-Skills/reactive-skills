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
3. Run the test suite using `run_command`.
4. **DO NOT** write the production code implementation yet.
5. The test MUST fail (`exit_code != 0`).

After running the suite, emit `TEST_RAN` with payload `{ "exit_code": <actual exit code>, "requirement": "<the requirement tested>" }`.
A non-zero exit code advances the run to **GREEN_CODE**.

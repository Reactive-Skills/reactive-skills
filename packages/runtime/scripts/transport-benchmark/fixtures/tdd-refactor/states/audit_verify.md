# State: AUDIT_VERIFY (Verification & Quality Gate)

You are in the **AUDIT_VERIFY** state of the TDD loop.

### Your Goal:
1. Run linter, typecheck, and full test suite verification.
2. Confirm zero regression across the workspace.
3. If every check exits 0, emit `ALL_CHECKS_PASSED` with payload `{ "exit_code": 0 }`; otherwise emit `REGRESSION_DETECTED` with the failing output.

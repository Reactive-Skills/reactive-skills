---
name: _test_hsm_skill
description: Bootloader - Verify reactive runtime
type: reactive
---

# _test_hsm_skill - INIT

Verify agent harness has access to reactive runtime.

## Instructions
1. Check execution environment:
   - Primary (AXI CLI mode): Shell access is available to run `npx -y @reactive-skills/axi state _test_hsm_skill` (or `reactive-skills-axi state _test_hsm_skill`) and `npx -y @reactive-skills/axi emit _test_hsm_skill <signal>` (or `reactive-skills-axi emit _test_hsm_skill <signal>`).
   - Alternative (MCP mode): The `reactive_state` tool is in your tools list and `allowed_tools` is not `none`.
2. If the reactive runtime is available via either AXI CLI or MCP, emit signal `RUNTIME_READY` (via `npx -y @reactive-skills/axi emit _test_hsm_skill RUNTIME_READY`, `reactive-skills-axi emit _test_hsm_skill RUNTIME_READY` or `reactive_emit_signal`).
3. If neither mode is available, emit signal `SETUP_REQUIRED`.

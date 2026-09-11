---
name: _test_hitl_skill
description: Bootloader - Verify reactive runtime
type: reactive
---

# _test_hitl_skill - INIT

Verify agent harness has access to reactive runtime.

## Instructions
1. Check execution environment:
   - Primary (AXI CLI mode): Shell access is available to run `npx -y @reactive-skills/axi state _test_hitl_skill` (or `reactive-skills-axi state _test_hitl_skill`) and `npx -y @reactive-skills/axi emit _test_hitl_skill <signal>` (or `reactive-skills-axi emit _test_hitl_skill <signal>`).
   - Alternative (MCP mode): The `reactive_state` tool is in your tools list and `allowed_tools` is not `none`.
2. If the reactive runtime is available via either AXI CLI or MCP, emit signal `RUNTIME_READY` (via `npx -y @reactive-skills/axi emit _test_hitl_skill RUNTIME_READY`, `reactive-skills-axi emit _test_hitl_skill RUNTIME_READY` or `reactive_emit_signal`).
3. If neither mode is available, emit signal `SETUP_REQUIRED`.

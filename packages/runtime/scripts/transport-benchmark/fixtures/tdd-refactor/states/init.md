---
name: tdd-refactor
description: Bootloader - Verify reactive runtime
type: reactive
---

# tdd-refactor - INIT

Verify access to the reactive runtime.

## Instructions
1. Check `reactive_capabilities` when the MCP tool is available.
2. Otherwise check `reactive-skills-axi capabilities --json`, then `npx -y @reactive-skills/axi capabilities --json`.
3. Select the compatible local MCP or AXI runtime, keep the same `--job <job-id>` for named or parallel work, and persist the selection for this run.
4. If runtime access works, emit `RUNTIME_READY` with transport, launcher, versions, compatibility, and capabilities.
5. If no compatible runtime works, emit `SETUP_REQUIRED`.

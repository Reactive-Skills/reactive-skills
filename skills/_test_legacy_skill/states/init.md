---
name: _test_legacy_skill
description: Bootloader - Verify reactive runtime
type: reactive
---

# _test_legacy_skill - INIT

Verify agent harness has access to reactive runtime.

## Instructions
1. Check if `reactive_state` MCP tool is present (MCP mode), OR if driving via CLI (`reactive-skills-axi invoke` with an `event_id`) (AXI mode).
2. If the reactive runtime is available in either mode, emit signal `RUNTIME_READY`.
3. If neither mode is available, emit signal `SETUP_REQUIRED`.

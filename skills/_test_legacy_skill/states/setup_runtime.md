---
name: _test_legacy_skill
description: Bootload reactive runtime configuration
type: reactive
---

# SETUP_RUNTIME — Configure Reactive Runtime

Run the runtime setup command to configure state machine tool access for your agent harness.

```bash
npx -y @reactive-skills/axi setup
# (or if installed globally: reactive-skills-axi setup)
```

**If exit code is 0:**
- Emit `SETUP_COMPLETE` with payload `{"exit_code": 0}`

**If exit code is non-zero:**
- Emit `SETUP_FAILED` with payload `{"exit_code": 1}`

After setup, restart your agent harness to load MCP tools (MCP mode), or continue using CLI invocation (AXI mode).

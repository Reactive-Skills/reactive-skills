---
name: _test_hitl_skill
description: Skill: _test_hitl_skill
type: reactive
---

<!-- REACTIVE BOOTLOADER -->
> **REACTIVE SKILL — STRICT RUNTIME EXECUTION**
> This skill is an event-driven state machine. Manual execution is FORBIDDEN.
>
> **PRIMARY EXECUTION (AXI CLI — Shell):**
> 1. Run `npx -y @reactive-skills/axi state _test_hitl_skill` (or `reactive-skills-axi state _test_hitl_skill`) to read your current instructions.
> 2. Complete the tasks described in the state prompt.
> 3. Run `npx -y @reactive-skills/axi emit _test_hitl_skill <signal>` (or `reactive-skills-axi emit _test_hitl_skill <signal>`) to advance to the next state.
>
> **ALTERNATIVE (MCP Mode):**
> If the `reactive_state` MCP tool is present in your tool list, you may use `reactive_state` and `reactive_emit_signal`.
>
> **STRICT INVARIANT:**
> Do NOT manually author `.docs/` deliverables or guess next states. The runtime governs all transitions and projections.
<!-- END REACTIVE BOOTLOADER -->

# _test_hitl_skill

Skill: _test_hitl_skill governed by `skill.yaml`.


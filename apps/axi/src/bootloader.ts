export function createReactiveBootloader(skillName: string): string {
  return `<!-- REACTIVE BOOTLOADER -->
> **REACTIVE SKILL: STRICT RUNTIME EXECUTION**
> This skill is an event-driven state machine. Manual execution is forbidden.
>
> **LOCAL-FIRST RUNTIME SELECTION**
> Select one compatible runtime during INIT, then reuse it for the full run.
> - To start a new task, use selected runtime \`invoke ${skillName} [--payload JSON]\`.
> - To resume an active task, use selected runtime \`state ${skillName}\`.
> - For named or parallel work, keep the same \`--job <alias>\` flag on every command.
> - The runtime resolves aliases to immutable UUID-backed \`run_id\` values.
> - To advance state, use selected runtime \`emit ${skillName} <signal>\`.
>
> **SELECTED RUNTIME COMMANDS**
> Use selected MCP or AXI path for every state and signal command.
> First check \`reactive_capabilities\` when this MCP tool is available.
> Otherwise check \`reactive-skills-axi capabilities --json\`, then use direct AXI.
> Otherwise use \`npx -y @reactive-skills/axi capabilities --json\`, then use zero-install AXI.
> MCP uses \`reactive_state\` and \`reactive_emit_signal\`.
> Direct AXI uses \`reactive-skills-axi state|emit ${skillName}\`.
> Zero-install AXI uses \`npx -y @reactive-skills/axi state|emit ${skillName}\`.
> Emit \`RUNTIME_READY\` with \`transport\`, \`launcher\`, \`runtime_version\`, \`axi_version\`, \`compatible\`, and \`capabilities\`.
> Persist the selected runtime in \`payload.contextUpdates\` so later states reuse it.
> AXI remains the runtime interface. \`npx\` is only its zero-install launcher.
> Do not repeat version or capability checks after INIT.
>
> **TERMINAL STATE RECOVERY**
> If the current job is terminal, run selected runtime \`reset ${skillName}\` or \`invoke ${skillName}\`.
>
> **STRICT INVARIANT**
> Do not manually author \`.docs/\` deliverables or guess next states.
> The runtime governs all transitions and projections.
<!-- END REACTIVE BOOTLOADER -->`;
}

export function createAxiFirstInitState(skillName: string): string {
  return `---
name: ${skillName}
description: Bootloader - Verify reactive runtime
type: reactive
---

# ${skillName} - INIT

Verify reactive runtime compatibility and select lowest-latency local access.

## Instructions
1. If \`reactive_capabilities\` is available, call it once.
2. Otherwise run \`reactive-skills-axi capabilities --json\` once when direct AXI exists.
3. Otherwise run \`npx -y @reactive-skills/axi capabilities --json\` once.
4. Check reported \`runtime_version\` and \`capabilities\` against this skill's \`runtime_requirements\`, when declared.
5. Select compatible MCP or direct AXI before zero-install AXI. Use \`npx\` only when no compatible direct path exists.
6. Emit \`RUNTIME_READY\` with selected transport, launcher, versions, capabilities, \`compatible: true\`, and \`contextUpdates\` for reuse.
7. If no compatible runtime exists, emit \`SETUP_REQUIRED\` with \`compatible: false\` and diagnostic details.
`;
}

export function createAxiFirstBypassState(skillName: string): string {
  return `---
name: ${skillName}
description: Bypass detected - Agent operated outside signal contract
type: reactive
---

# ${skillName} - BYPASS_DETECTED

The runtime detected work outside the signal contract.

## Recovery
1. Run selected runtime \`reset ${skillName}\`.
2. Run selected runtime \`invoke ${skillName}\` to start a fresh isolated job.
3. Use selected runtime \`state ${skillName} --job <alias>\` only when resuming a known run.

## Prevention
- Use selected runtime \`state\` to load the TODO card.
- Use selected runtime \`emit\` after each completed state task.
- Keep \`--job <alias>\` on every command for named or parallel work.
`;
}

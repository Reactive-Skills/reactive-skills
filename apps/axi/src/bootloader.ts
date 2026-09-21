export function createReactiveBootloader(skillName: string): string {
  return `<!-- REACTIVE BOOTLOADER -->
> **REACTIVE SKILL: STRICT RUNTIME EXECUTION**
> This skill is an event-driven state machine. Manual execution is forbidden.
>
> **DEFAULT EXECUTION: AXI CLI**
> AXI is the default runtime path, even when MCP tools are present.
> - To start a new task: Run \`reactive-skills-axi invoke ${skillName} [--payload JSON]\`
> - To resume an active task: Run \`reactive-skills-axi state ${skillName}\`
> - For named or parallel work: Keep the same \`--job <alias>\` flag on every command.
> - The runtime resolves aliases to immutable UUID-backed \`run_id\` values.
> - To advance state: Run \`reactive-skills-axi emit ${skillName} <signal>\`
>
> **FALLBACK EXECUTION: MCP**
> Use \`reactive_state\` and \`reactive_emit_signal\` only when shell access to AXI is unavailable.
> Do not troubleshoot MCP before trying AXI.
>
> **TERMINAL STATE RECOVERY**
> If the current job is terminal, run \`reactive-skills-axi reset ${skillName}\` or \`reactive-skills-axi invoke ${skillName}\`.
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

Verify access to the reactive runtime.

## Instructions
1. Prefer AXI CLI.
   Run \`reactive-skills-axi state ${skillName}\` to inspect this job, or \`reactive-skills-axi invoke ${skillName}\` to start a fresh isolated job.
2. If this is named or parallel work, choose a human-readable alias and keep \`--job <alias>\` on every \`state\` and \`emit\` command.
3. Use MCP tools only when shell access to AXI is unavailable.
4. If AXI or MCP runtime access works, emit \`RUNTIME_READY\`.
5. If neither path works, emit \`SETUP_REQUIRED\`.
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
1. Run \`reactive-skills-axi reset ${skillName}\`.
2. Run \`reactive-skills-axi invoke ${skillName}\` to start a fresh isolated job.
3. Use \`reactive-skills-axi state ${skillName} --job <alias>\` only when resuming a known run.

## Prevention
- Use AXI \`state\` to load the TODO card.
- Use AXI \`emit\` after each completed state task.
- Keep \`--job <alias>\` on every command for named or parallel work.
- Use MCP only when shell access to AXI is unavailable.
`;
}

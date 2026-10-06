import { RUNTIME_VERSION } from './runtime-capabilities.js';

export const REACTIVE_BOOTLOADER_VERSION = '1.0.0';

export interface ReactiveBootloaderPayload {
  runtime_version: string;
  bootloader_version: string;
  skill: string;
  instructions: string;
}

function normalizeSkillName(skillName: string): string {
  const normalized = String(skillName || '').trim();
  if (!/^[A-Za-z0-9._-]+$/.test(normalized)) {
    throw new Error('Skill name must contain only letters, numbers, dots, underscores, or hyphens.');
  }
  return normalized;
}

export function createReactiveBootloader(skillName: string): string {
  const name = normalizeSkillName(skillName);

  return `<!-- REACTIVE BOOTLOADER -->
> **REACTIVE SKILL: STRICT RUNTIME EXECUTION**
> This skill is an event-driven state machine. Manual execution is forbidden.
>
> **LOCAL-FIRST RUNTIME SELECTION**
> Select one compatible runtime during INIT, then reuse it for the full run.
> - To start a new task, use selected runtime \`invoke ${name} [--payload JSON]\`.
> - To resume an active task, use selected runtime \`state ${name}\`.
> - For named or parallel work, keep the same \`--job <alias>\` flag on every command.
> - The runtime resolves aliases to immutable UUID-backed \`run_id\` values.
> - To advance state, use selected runtime \`emit ${name} <signal>\`.
>
> **SELECTED RUNTIME COMMANDS**
> Use selected MCP or AXI path for every state and signal command.
> First check \`reactive_capabilities\` when this MCP tool is available.
> Otherwise check \`reactive-skills-axi capabilities --json\`, then use direct AXI.
> Otherwise use \`npx -y @reactive-skills/axi capabilities --json\`, then use zero-install AXI.
> MCP uses \`reactive_state\` and \`reactive_emit_signal\`.
> Direct AXI uses \`reactive-skills-axi state|emit ${name}\`.
> Zero-install AXI uses \`npx -y @reactive-skills/axi state|emit ${name}\`.
> Emit \`RUNTIME_READY\` with \`transport\`, \`launcher\`, \`runtime_version\`, \`axi_version\`, \`compatible\`, and \`capabilities\`.
> Persist the selected runtime in \`payload.contextUpdates\` so later states reuse it.
> AXI remains the runtime interface. \`npx\` is only its zero-install launcher.
> Do not repeat version or capability checks after INIT.
>
> **CONTEXT ROUTING**
> Before loading full skill instructions or assembling prompt context, call \`reactive_context_prepare\` with the current user message when MCP is available.
> The wrapper asks Jev to select one skill and returns only the selected metadata, active state, or bounded skill instructions.
> If MCP is unavailable, run \`reactive-skills-axi context-route --message "..." --json\` before loading skill context.
> The CLI discovers local skill metadata when \`--candidates\` is omitted.
> To restrict the choices, pass \`--candidates <JSON|@file>\` with an array of skill metadata records shaped like \`[{"id":"...","skill":"...","summary":"..."}]\`.
> Load only the selected skill and honor \`context_mode\` and \`context_budget_tokens\`.
> If the route is \`none\`, Jev is unavailable, or the wrapper fails, continue the directly requested runtime path without preloading unrelated skills.
>
> **TERMINAL STATE RECOVERY**
> If the current job is terminal, run selected runtime \`reset ${name}\` or \`invoke ${name}\`.
>
> **STRICT INVARIANT**
> Do not manually author \`.docs/\` deliverables or guess next states.
> The runtime governs all transitions and projections.
<!-- END REACTIVE BOOTLOADER -->`;
}

export function createReactiveBootloaderReference(skillName: string): string {
  const name = normalizeSkillName(skillName);

  return `<!-- REACTIVE BOOTLOADER -->
> The authoritative bootloader is served by the Reactive Skills runtime.
> Retrieve it before loading full skill context:
> - MCP: call \`reactive_bootloader\` with \`skill_name: "${name}"\`.
> - AXI: run \`reactive-skills-axi bootloader ${name} --json\`.
> - Zero-install AXI: run \`npx -y @reactive-skills/axi bootloader ${name} --json\`.
> Follow the returned \`instructions\`, then call \`reactive_context_prepare\` before assembling prompt context when MCP is available.
> If bootloader retrieval is unavailable, continue with the directly requested runtime path and do not preload unrelated skill context.
<!-- END REACTIVE BOOTLOADER -->`;
}

export function getReactiveBootloader(skillName: string): ReactiveBootloaderPayload {
  const name = normalizeSkillName(skillName);
  return {
    runtime_version: RUNTIME_VERSION,
    bootloader_version: REACTIVE_BOOTLOADER_VERSION,
    skill: name,
    instructions: createReactiveBootloader(name),
  };
}

export function ensureReactiveBootloaderReference(content: string, skillName: string): string {
  const reference = createReactiveBootloaderReference(skillName);
  const startMarker = '<!-- REACTIVE BOOTLOADER -->';
  const endMarker = '<!-- END REACTIVE BOOTLOADER -->';
  const start = content.indexOf(startMarker);

  if (start >= 0) {
    const end = content.indexOf(endMarker, start);
    if (end >= 0) {
      return `${content.slice(0, start)}${reference}${content.slice(end + endMarker.length)}`;
    }
  }

  if (content.startsWith('---')) {
    const secondYamlMarker = content.indexOf('---', 3);
    if (secondYamlMarker !== -1) {
      const frontmatter = content.slice(0, secondYamlMarker + 3);
      const rest = content.slice(secondYamlMarker + 3).trimStart();
      return `${frontmatter}\n\n${reference}\n\n${rest}`;
    }
  }

  return `${reference}\n\n${content}`;
}

export function createAxiFirstInitState(skillName: string): string {
  const name = normalizeSkillName(skillName);

  return `---
name: ${name}
description: Bootloader - Verify reactive runtime
type: reactive
---

# ${name} - INIT

Verify reactive runtime compatibility and select lowest-latency local access.

## Instructions
1. If \`reactive_capabilities\` is available, call it once.
2. Otherwise run \`reactive-skills-axi capabilities --json\` once when direct AXI exists.
3. Otherwise run \`npx -y @reactive-skills/axi capabilities --json\` once.
4. Check reported \`runtime_version\` and \`capabilities\` against this skill's \`runtime_requirements\`, when declared.
5. Select compatible MCP or direct AXI before zero-install AXI. Use \`npx\` only when no compatible direct path exists.
6. Before loading full skill context, call MCP \`reactive_context_prepare\` with the current user message when available.
7. If MCP is unavailable, run AXI \`context-route --message "<current user message>" --json\` before loading skill context.
8. The CLI discovers local skill metadata when \`--candidates\` is omitted.
9. To restrict route choices, pass \`--candidates\` with a JSON array of skill metadata records.
10. Emit \`RUNTIME_READY\` with selected transport, launcher, versions, capabilities, \`compatible: true\`, and \`contextUpdates\` for reuse.
11. If no compatible runtime exists, emit \`SETUP_REQUIRED\` with \`compatible: false\` and diagnostic details.
`;
}

export function createAxiFirstBypassState(skillName: string): string {
  const name = normalizeSkillName(skillName);

  return `---
name: ${name}
description: Bypass detected - Agent operated outside signal contract
type: reactive
---

# ${name} - BYPASS_DETECTED

The runtime detected work outside the signal contract.

## Recovery
1. Run selected runtime \`reset ${name}\`.
2. Run selected runtime \`invoke ${name}\` to start a fresh isolated job.
3. Use selected runtime \`state ${name} --job <alias>\` only when resuming a known run.

## Prevention
- Use selected runtime \`state\` to load the TODO card.
- Use selected runtime \`emit\` after each completed state task.
- Keep \`--job <alias>\` on every command for named or parallel work.
`;
}

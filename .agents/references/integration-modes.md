# Integration Modes

Reactive skills can be consumed through three integration modes. The runtime itself has no dependency on any specific mode.

## 1. MCP stdio (portable, universal)
The MCP server exposes `reactive_state`, `reactive_emit_signal`, `reactive_respond_human`, and other tools over stdio. Any MCP-compatible agent can use these tools directly. No harness-specific code required.

## 2. AXI CLI (portable, shell-based)
The `reactive-skills-axi` CLI wraps the runtime with agent-ergonomic TOON output. Agents invoke via shell execution (`reactive-skills-axi init`, `inspect`, `events`, etc.). Works with any agent that can run shell commands.

## 3. In-Harness Hooks (Claude Code only, optional)
`runtime-hooks.ts` provides `onBeforeAgentTurn`, `onAfterToolExecution`, and `onHumanResponse` for Claude Code's interceptor system. This is the least portable option and is not required for skill execution.

## Portable Alternative to Harness Hooks

State `on_enter`/`on_exit` lifecycle hooks in `skill.yaml` provide automatic context setup and signal emission. The skill's transition contract (defined in `transitions`) tells the agent which signals to emit at decision points. Agents running in any mode can drive a reactive skill by reading the transition contract and calling `engine.handleSignal()` or `reactive_emit_signal` at the appropriate moments.
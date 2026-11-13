# Integration Modes

Reactive skills can be consumed through three integration modes. The runtime itself has no dependency on any specific mode.

## 1. MCP stdio (portable, universal)
The MCP server exposes `reactive_state`, `reactive_emit_signal`, `reactive_respond_human`, and other tools over stdio. Any MCP-compatible agent can use these tools directly. No harness-specific code required.

## 2. AXI CLI (portable, shell-based)
The `reactive-skills-axi` CLI wraps the runtime with agent-ergonomic TOON output. Agents invoke via shell execution (`reactive-skills-axi init`, `inspect`, `events`, etc.). Works with any agent that can run shell commands.

## Optional host adapters
This release provides AXI and MCP, plus a protocol guard hook for Claude Code, Codex and Cursor (`reactive-skills-axi setup --hooks`): it denies write-tool edits and blocks the first turn end while a reactive job in the workspace is unacknowledged, and an exit check (`verify-change`) covers changes made outside any harness. See `docs/protocol-guard.md`.
Other host tool interception and compaction reinjection require a separately implemented adapter.

## Portable Alternative to Harness Hooks

State `on_enter`/`on_exit` lifecycle hooks in `skill.yaml` provide automatic context setup and signal emission. The skill's transition contract (defined in `transitions`) tells the agent which signals to emit at decision points. Agents running in any mode can drive a reactive skill by reading the transition contract and calling `engine.handleSignal()` or `reactive_emit_signal` at the appropriate moments.
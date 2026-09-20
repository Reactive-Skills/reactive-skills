# Build & Verification Commands

## Daily Workflow
- `pnpm install` — Install workspace dependencies.
- `pnpm run build` — Compile TypeScript source across `@reactive-skills/runtime` and `@reactive-skills/axi`.
- `pnpm test` — Run runtime Vitest suites (`packages/runtime/tests/`). **Mandatory gate before finishing any task.**
- `pnpm test:axi` — Run AXI CLI Vitest suites (`apps/axi/tests/`).
- `pnpm demo` — Run the end-to-end TDD refactor simulation.

## Development Tools
- `npx -y @reactive-skills/axi mcp` — Run MCP stdio server.
- `npx -y @reactive-skills/axi <command>` (or `reactive-skills-axi <command>`):
  - `state <skill>` — Display active state slice, prompt instructions, and allowed tools.
  - `emit <skill> <signal> [payload]` — Dispatch a signal to evaluate guards and transition.
  - `events [limit]` — Tail `.reactive/skills/<skill>/events.jsonl`.
  - `inspect <path>` — Print statechart, transitions, and guards.
  - `validate <path>` — Lint and validate a `skill.yaml` manifest.
  - `invoke <skill>` — Invoke a skill, bootstrapping its FSM engine.
  - `init <name>` — Scaffold new modular reactive skill in `skills/<name>/`.
  - `upgrade <path>` — Migrate a legacy `SKILL.md` to a reactive `skill.yaml`.
  - `setup` — Configure workspace and install MCP server config.
  - `reset <skill>` — Clear active execution run while preserving deliverables.
  - `jobs <skill>` — List, switch, and manage job isolation for a skill.
  - `rebuild-sqlite <skill>` — Replay `events.jsonl` → `events.db` (repair SQLite).
  - `view <skill>` — Launch real-time telemetry viewer and SSE event stream.
  - `sync [skill]` — Synchronize workspace skill registry.
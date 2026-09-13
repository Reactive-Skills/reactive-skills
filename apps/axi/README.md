# @reactive-skills/axi

AXI-compliant CLI for Reactive Skills Architecture — state, emit, events in TOON format.

> 🚀 **What's New in v0.3.0:** First-class Job & Run Management, isolated event ledgers, dual-write deliverable archives, and AXI `jobs` suite (`list`, `switch`, `archive`). [Read Full Release Notes →](https://github.com/Reactive-Skills/reactive-skills/releases/tag/v0.3.0) · [View Changelog](https://github.com/Reactive-Skills/reactive-skills/blob/main/CHANGELOG.md)

## Installation

Run directly without installing (zero install, recommended for agents):

```bash
npx -y @reactive-skills/axi <command>
```

Or install globally for instant local commands (`reactive-skills-axi` or `axi`):

```bash
npm install -g @reactive-skills/axi
```

## Usage

```bash
# Zero-install via npx:
npx -y @reactive-skills/axi                          # dashboard
npx -y @reactive-skills/axi state <skill>            # active state & prompt
npx -y @reactive-skills/axi state <skill> --job <id> # target specific run
npx -y @reactive-skills/axi emit <skill> <signal>    # advance state machine
npx -y @reactive-skills/axi jobs <skill> list        # list isolated runs
npx -y @reactive-skills/axi init <name>              # scaffold new reactive skill
npx -y @reactive-skills/axi upgrade <path>           # upgrade legacy SKILL.md
npx -y @reactive-skills/axi inspect <path>           # inspect statechart
npx -y @reactive-skills/axi events [limit]           # tail event ledger
npx -y @reactive-skills/axi view <skill>             # launch telemetry viewer

# Or if installed globally:
reactive-skills-axi state <skill>
axi emit <skill> <signal>
```

## Commands

### init

Scaffold a new reactive skill in `skills/<name>/`.

```bash
npx -y @reactive-skills/axi init my-skill
```

Creates:
- `skills/my-skill/skill.yaml` — skill manifest
- `skills/my-skill/SKILL.md` — skill documentation
- `skills/my-skill/states/start.md` — initial state prompt
- `skills/my-skill/states/done.md` — terminal state prompt

### upgrade

Convert a legacy `SKILL.md` to reactive modular format.

```bash
npx -y @reactive-skills/axi upgrade skills/my-legacy-skill
```

Uses the runtime's `LegacySkillAdapter` to generate:
- `skill.yaml` with state machine manifest
- `states/` directory with modular state files
- `templates/` directory with summary projection template

### inspect

Print the statechart, transitions, and guards for a reactive skill.

```bash
npx -y @reactive-skills/axi inspect skills/my-skill
```

Output (TOON format):
- Skill metadata (name, version, description, state count, transition count)
- States list with descriptions
- Transitions with signals, targets, and guard expressions

### events

Tail the event store ledger for a skill.

```bash
npx -y @reactive-skills/axi events              # last 20 events
npx -y @reactive-skills/axi events 50           # last 50 events
npx -y @reactive-skills/axi events 100 my-skill # last 100 events for my-skill
```

Output (TOON format):
- Count of events shown
- Event entries with seq, timestamp, type, state

### view

Launch the real-time telemetry streaming server and live viewer for a skill.

```bash
npx -y @reactive-skills/axi view my-skill             # default port 4242
npx -y @reactive-skills/axi view my-skill --port 5000 # custom port
```

Output (TOON format):
- Telemetry listener status
- Bound port and base URL
- SSE events endpoint (`/events`)
- State inspection endpoint (`/state`)
- Health check endpoint (`/health`)

### jobs

Inspect, switch, and archive isolated execution runs and deliverables.

```bash
npx -y @reactive-skills/axi jobs my-skill list             # list all runs
npx -y @reactive-skills/axi jobs my-skill switch <job-id>  # switch active pointer
npx -y @reactive-skills/axi jobs my-skill archive <job-id> # mark run archived
```

Output (TOON format):
- Active job pointer
- Job list with status, creation timestamp, and title
- Archived status confirmations

## Design Principles

This CLI follows the [AXI (Agent eXperience Interface)](https://axi.md) principles:

- **Content-first**: Running with no arguments shows live data, not help text
- **TOON output**: Token-efficient format for agent consumption (~40% fewer tokens than JSON)
- **Structured errors**: Clean exit codes (0=success, 1=error, 2=unknown flag)
- **Contextual suggestions**: Next-step hints after every output
- **Minimal schemas**: 3-4 fields per list item by default

## License

AGPL-3.0-only

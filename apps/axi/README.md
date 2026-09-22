# @reactive-skills/axi

AXI-compliant CLI for Reactive Skills Architecture — state, emit, events in TOON format.

> 🚀 **What's New in v0.11.0: Local-first runtime negotiation with one-time version and capability checks   [Read Full Release Notes](https://github.com/Reactive-Skills/reactive-skills/releases/tag/v0.11.0) · [View Changelog](https://github.com/Reactive-Skills/reactive-skills/blob/main/CHANGELOG.md)

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
npx -y @reactive-skills/axi --version                # print the installed package version
npx -y @reactive-skills/axi capabilities --json      # report runtime capabilities
npx -y @reactive-skills/axi preflight <skill> --json # check skill runtime requirements
npx -y @reactive-skills/axi invoke <skill>           # start fresh run (auto-generates unique job ID)
npx -y @reactive-skills/axi invoke <skill> --job <id> # start isolated named run
npx -y @reactive-skills/axi state <skill>            # inspect/resume active run (auto-rotates if terminal)
npx -y @reactive-skills/axi state <skill> --job <id> # target specific run
npx -y @reactive-skills/axi emit <skill> <signal>    # advance state machine
npx -y @reactive-skills/axi jobs <skill> list        # list isolated runs
npx -y @reactive-skills/axi init <name>              # scaffold new reactive skill
npx -y @reactive-skills/axi upgrade <path>           # upgrade legacy SKILL.md
npx -y @reactive-skills/axi inspect <path>           # inspect statechart
npx -y @reactive-skills/axi events [limit]           # tail event ledger
npx -y @reactive-skills/axi view <skill>             # launch telemetry viewer
npx -y @reactive-skills/axi dashboard                # launch multi-job read-only broker

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

### capabilities

Report AXI and runtime versions plus available capabilities for one-time INIT negotiation.

```bash
npx -y @reactive-skills/axi capabilities --json
```

### preflight

Check a skill's declared runtime requirements without creating or changing a job.

```bash
npx -y @reactive-skills/axi preflight skills/my-skill --json
```

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

### validate

Validate a reactive skill's manifest, prompt templates, transition targets, and universal bootloader.

```bash
# Validate a specific skill directory:
npx -y @reactive-skills/axi validate skills/my-skill

# Or discover and validate all skills in ./skills/:
npx -y @reactive-skills/axi validate
```

Output (TOON format):
- Validation status (`valid` or `invalid`)
- States and transition counts
- Formatted error and warning lists
- Non-zero exit code (1) on validation failure for CI integration

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
npx -y @reactive-skills/axi view my-skill                    # prefer 4242, then use the next available port
npx -y @reactive-skills/axi view my-skill --port 5000        # bind only to 5000
npx -y @reactive-skills/axi view my-skill --port 0           # use an OS-assigned ephemeral port
npx -y @reactive-skills/axi view my-skill --job sprint-1     # follow one job without changing the active pointer
```

When `--port` is omitted, AXI uses real bind attempts starting at `127.0.0.1:4242` and falls back through a bounded deterministic range when the preferred port is occupied.

An explicit `--port` is strict and fails clearly if that port is unavailable.

The output reports the actual bound port and URL in the `port`, `url`, `dashboard`, `events_sse`, `state_endpoint`, and `health_endpoint` fields.

The browser viewer uses the URL reported by AXI and does not scan local ports automatically.

Output (TOON format):
- Telemetry listener status
- Selected job ID
- Bound port and base URL
- SSE events endpoint (`/events`)
- State inspection endpoint (`/state`)
- Health check endpoint (`/health`)

### dashboard

Launch one local read-only telemetry broker for multiple skills and jobs.

```bash
npx -y @reactive-skills/axi dashboard
npx -y @reactive-skills/axi dashboard --port 0
npx -y @reactive-skills/axi dashboard --host 0.0.0.0 --port 4500
```

The broker binds to `127.0.0.1` by default and reports the actual URL and port after binding.

When `--port` is omitted, the broker makes real bind attempts starting at `127.0.0.1:4242` and falls back through a bounded deterministic range when the preferred port is occupied.

An explicit `--port` is strict and fails clearly if that port is unavailable.

Use `--port 0` to request an OS-assigned ephemeral port.

Use the reported URL in the site's `/telemetry` dashboard.

The dashboard discovers skill and job metadata from the broker catalog instead of reading local files in the browser.

The broker exposes `GET /catalog`, `GET /state?skillId=<skill-id>&jobId=<job-id>`, and filtered `GET /events` SSE.

Use repeated `target=<skill-id>/<job-id>` parameters to restrict one SSE connection to selected jobs.

Sequence numbers remain local to each UUID-backed run and every streamed event includes its skill ID and run ID.

The broker polls SQLite so events written by separate CLI, MCP, and worker processes become visible without a restart.

The broker is read-only and has no signal dispatch route.

It does not change active-job pointers or scan arbitrary localhost ports from the browser.

Use `view <skill> [--job <job-id>]` when you need the existing single-job viewer and its current bridge workflow.

### jobs

Inspect, switch, and archive isolated execution runs and deliverables.

```bash
# List all runs (supports bidirectional argument ordering)
npx -y @reactive-skills/axi jobs my-skill list
npx -y @reactive-skills/axi jobs list my-skill

# Switch active run pointer:
npx -y @reactive-skills/axi jobs my-skill switch <job-id>

# Archive a run:
npx -y @reactive-skills/axi jobs my-skill archive <job-id>

# Target a specific job explicitly without switching:
npx -y @reactive-skills/axi state my-skill --job <job-id>
npx -y @reactive-skills/axi emit my-skill <signal> --job <job-id>
```

Output (TOON format):
- Active job pointer
- Job list with status, creation timestamp, and title
- Archived status confirmations

### sync

Synchronize skills from workspaces to global registry and satellite agent directories using zero-drift directory junctions.

```bash
# Sync all skills across all satellites via junctions:
npx -y @reactive-skills/axi sync

# Sync a specific skill:
npx -y @reactive-skills/axi sync my-skill

# Preview sync operations without touching disk:
npx -y @reactive-skills/axi sync --dry-run

# Force physical file copy instead of junctions:
npx -y @reactive-skills/axi sync my-skill --copy
```

## Design Principles

This CLI follows the [AXI (Agent eXperience Interface)](https://axi.md) principles:

- **Content-first**: Running with no arguments shows live data, not help text
- **TOON output**: Token-efficient format for agent consumption (~40% fewer tokens than JSON)
- **Structured errors**: Clean exit codes (0=success, 1=error, 2=unknown flag)
- **Contextual suggestions**: Next-step hints after every output
- **Minimal schemas**: 3-4 fields per list item by default

## License

AGPL-3.0-only

# @reactive-skills/axi

AXI-compliant CLI for Reactive Skills Architecture — state, emit, events in TOON format.

> 🚀 **What's New in v0.19.0:**
> - New `vet` command: static checks of a skill's guard code, text, and dependencies, using the same rule set the skills catalog CI can call.
> - `<command> --help` and `-h` print usage on every command, and `validate` checks `guardFunction` module format.
> - `invoke` rejects a wrapped `contextUpdates` payload; `jobs` and `reset` accept a skill path or manifest name.
>
> [Read Full Release Notes](https://github.com/Reactive-Skills/reactive-skills/releases/tag/v0.19.0) · [View Changelog](https://github.com/Reactive-Skills/reactive-skills/blob/main/CHANGELOG.md)

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
npx -y @reactive-skills/axi <command> --help         # print a command's usage without running it (-h also works)
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

### context-route

Use Jev to select one skill and the smallest useful context slice before prompt assembly.

Omit `--candidates` to discover skill metadata from the workspace and supported agent skill directories.

Pass `--candidates <JSON|@file>` only to restrict choices.
The value must be a JSON array of skill metadata records, not arbitrary task labels or data.
Each record requires `id`, `skill`, and `summary`, with optional `keywords`.
All supplied skill records are considered.
Large lists may require multiple Jev decisions to stay within provider request limits.
Pass `[]` to route with no candidates.

```bash
npx -y @reactive-skills/axi context-route --message "Review this policy decision" --json
npx -y @reactive-skills/axi context-route --message "Review this policy decision" --candidates '[{"id":"policy-review","skill":"policy-review","summary":"Review decisions against policy","keywords":["policy","approval"]}]' --json
```

The command fails closed to `route: none` when Jev is unavailable, an evaluation fails or times out, a choice is invalid, no candidate directly helps, or confidence is below `0.40`.

The MCP equivalent is `reactive_context_prepare`.
It routes the current user message and loads only the selected local context before prompt assembly.
If Jev is unavailable, it returns `route: none` without loading skill context.

### bootloader

Retrieve the authoritative, versioned runtime instructions for a reactive skill.

```bash
npx -y @reactive-skills/axi bootloader my-skill --json
```

Reactive skill `SKILL.md` files contain a stable pointer to this command and its MCP equivalent, so runtime guidance can be updated centrally.

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

Judgment checks warn when a semantic predicate or categorical judgment relies on `min_confidence` instead of `min_probability`, and name the equivalent `min_probability` for predicates.
They warn when `min_probability` or `escalate` is used without requiring the `judgment.probability_thresholds` capability.
They fail on an invalid `context_paths` entry or a wrongly typed `context_paths` or `include_payload`, and warn on a `context_paths` entry that starts with `context.`, on either field combined with `adapter_hint: script`, and on either field used without requiring the `judgment.context_paths` capability.
Guard contract checks read `guards/*.yaml` and link each contract to the `skill.yaml` judgment with the same `snap_on.judgment.criterion`.
They fail validation when a linked pair disagrees on type, threshold, escalate band, or accept band, and warn on unlinked contracts, inverted accept polarity, unenforced escalate bands, and `TODO` thresholds.

`guardFunction` checks keep the path inside the skill directory, require a `.js`, `.mjs`, or `.cjs` extension, and require the file to exist.
They also read each guard file as text, never importing or running it, and fail validation when its syntax does not match the module format Node will load it as:

| File | Loads as | Fails when |
| :--- | :--- | :--- |
| `.mjs` | ES module | it uses `require` or `module.exports` |
| `.cjs` | CommonJS | it uses `import` or `export` |
| `.js` | the `"type"` of the nearest `package.json` at or above the file (`"module"` or `"commonjs"`) | it uses the other style |
| `.js` with no `"type"` | detected from syntax on Node 20.19+ and 22.7+ | it uses `import`/`export` on an older Node |

The runtime loads every guard with dynamic `import()`, so a `.js` guard with ESM syntax under `"type": "commonjs"` fails with `Unexpected token 'export'`.
The error names the guard file and the fix: rename it to `.mjs` or `.cjs`, or set `"type"` in the nearest `package.json`.
Prefer an explicit `.mjs` or `.cjs` extension so the format does not depend on a `package.json`.

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

### vet

Statically scan one skill, or every skill in a directory, before you run its code.
Vet looks for risky APIs in guards and scripts, prompt injection, hidden Unicode and comments, encoded blobs, and download-and-execute steps.
It reads skill files as text and never imports, requires, or runs them, so it is a check for review and CI and not a sandbox.

```bash
# Scan one skill, or a directory of skills:
npx -y @reactive-skills/axi vet skills/my-skill
npx -y @reactive-skills/axi vet ./catalog --allowlist vet-allowlist.yaml

# Fail on medium findings too, and print JSON:
npx -y @reactive-skills/axi vet skills/my-skill --fail-on medium --json

# List the rules and their severities:
npx -y @reactive-skills/axi vet --rules
```

Each finding has a rule id, a severity (`high`, `medium`, or `low`), a file, a line, and a short message.
The exit code is `0` when nothing at or above `--fail-on` (default `high`) is left, `1` when something is, and `2` when vet could not run.
An allowlist file of reviewed exceptions, each with a skill, a rule, a path, and a required reason, suppresses findings that are legitimate.
The rule set lives in `@reactive-skills/runtime`, so the skills catalog's CI runs the same rules.
[docs/vetting.md](https://github.com/Reactive-Skills/reactive-skills/blob/main/docs/vetting.md) lists every rule, the allowlist format, and what the runtime executes with which privileges.

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

# Payload shapes differ between the two commands:
npx -y @reactive-skills/axi invoke my-skill --payload '{"mission":"ship"}'                       # flat object becomes the initial context
npx -y @reactive-skills/axi emit my-skill <signal> --payload '{"contextUpdates":{"mission":"ship"}}'  # contextUpdates is merged into context
# invoke rejects a {"contextUpdates":{...}} payload and names the flat shape to use instead.

# Target a specific job explicitly without switching:
npx -y @reactive-skills/axi state my-skill --job <job-id>
npx -y @reactive-skills/axi emit my-skill <signal> --job <job-id>
```

Output (TOON format):
- Active job pointer
- Job list with status, creation timestamp, and title
- Archived status confirmations

### approve

Decide a gate that no model could judge, or turn self-reported decisions on or off for the workspace (ADR 0012).
Run it yourself in your own terminal.
It refuses to run when standard input or standard output is not an interactive terminal, so an agent cannot complete it through a pipe or a script.
An agent with a tool that drives a terminal session, which some MCP servers provide, can still run it, so treat the code as protection against accidental approval rather than a security boundary.
Run it from the workspace folder that the agent's message names; `approve` prints the workspace it used and fails when the run is not there.

```bash
# Decide the gates waiting in a run:
npx -y @reactive-skills/axi approve my-skill --job <job-id>

# Let the agent's own report decide natural-language gates when no model is configured:
npx -y @reactive-skills/axi approve my-skill --allow-self-reported

# Turn self-reported decisions off again:
npx -y @reactive-skills/axi approve my-skill --revoke-self-reported
```

For each waiting gate, `approve` shows the state, signal, criterion, and the agent's payload with its size and hash, then prints a four-character code.
Long payloads show their start and end; add `--full` to print all of it.
Typing the code approves the gate, and typing `reject` rejects it.
Any other answer asks again, up to five times, and ending input with Ctrl+D cancels without deciding.
An approval re-sends the original signal, and the transition reports `judgment_basis: human`.
A rejection routes to `fallback_target` when one is declared and otherwise leaves the run in its state.
If the run changes while you decide, for example because the agent re-sent the refused signal, `approve` reloads it and applies your answer only when the same gate with the same evidence is still waiting; otherwise it applies nothing and asks you to run it again.

`--allow-self-reported` asks for a code the same way and stores the grant in your home folder under `~/.reactive-skills/grants/`, keyed by the workspace path, and prints where.
Nothing inside the workspace counts as a grant, and the agent's runtime must use the same home folder to see it.
`--revoke-self-reported` deletes it without a code.

### sync

Copy skills from ordered authoring sources into a physical central directory, then update satellite agent directories with links or physical copies.
The first source containing a skill name wins.
Source edits reach satellites on the next sync, and linked satellites see central updates immediately.

Configure the layout in `~/.agents/sync.json`; when that file is absent, registered sources from `~/.agents/sources.json` remain a fallback.
Change the persistent central directory by updating the `central` value in `sync.json`.
Use `--central <dir>` to override it for one invocation, and use `--show-config` to inspect the resolved paths.
When prior sync state records the old central path, the next sync can use that directory as a migration fallback while populating the new central directory.
The old central directory remains on disk.
If creating `sync.json` for the first time, include the needed source paths because the legacy source fallback applies only when that file is absent.

```bash
# Show effective paths and source precedence:
npx -y @reactive-skills/axi sync --show-config

# Preview a one-run central directory override:
npx -y @reactive-skills/axi sync --central ~/work/skill-registry --dry-run

# Preview the planned distribution:
npx -y @reactive-skills/axi sync --dry-run

# Sync all valid skills:
npx -y @reactive-skills/axi sync

# Sync a specific skill:
npx -y @reactive-skills/axi sync my-skill

# Sync multiple selected skills:
npx -y @reactive-skills/axi sync --skill skill-one,skill-two

# Repeated --skill flags remain supported:
npx -y @reactive-skills/axi sync --skill skill-one --skill skill-two

# Choose ordered sources and satellite paths:
npx -y @reactive-skills/axi sync --source ~/work/public-skills,~/work/private-skills --target ~/.codex/skills,~/.claude/skills --physical-target ~/.gemini/config/skills --dry-run

# Use physical copies for all selected satellites on this run:
npx -y @reactive-skills/axi sync my-skill --copy
```

Use either one positional skill name or one or more `--skill` flags in a command. Each `--skill` value may contain comma-separated names; surrounding whitespace is ignored and empty names are rejected.
Each `--source`, `--target`, and `--physical-target` value may contain comma-separated paths, and each option may be repeated.
Surrounding whitespace is ignored, and empty path entries are rejected.
Do not combine the positional skill form with `--skill` flags.
Unknown selected names stop the full request before any target directory changes.

## Design Principles

This CLI follows the [AXI (Agent eXperience Interface)](https://axi.md) principles:

- **Content-first**: Running with no arguments shows live data, not help text
- **TOON output**: Token-efficient format for agent consumption (~40% fewer tokens than JSON)
- **Structured errors**: Clean exit codes (0=success, 1=error, 2=unknown flag)
- **Contextual suggestions**: Next-step hints after every output
- **Minimal schemas**: 3-4 fields per list item by default

## License

AGPL-3.0-only

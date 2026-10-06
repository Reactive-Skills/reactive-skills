# Mods

Claude Code mods for Reactive Skills. Each lives in `mods/<name>/`.

| Mod | What it does |
| --- | --- |
| `bq-vitals` | Status line with context, cost and rate limits, plus `/flow` (live state-machine map and query-plan style trace) and `/flow-plan` (the same trace as text) for the latest reactive skill run. |

## Install

```
/plugin install bq-vitals --marketplace Reactive-Skills/reactive-skills
```

Answer `y` to add the marketplace, then pick a scope.

`bq-vitals` only reads. It looks for each run's `.reactive/skills/<skill>/events.jsonl` and the skill's `STATECHART.md` in the session directory, `~/.claude/skills`, `~/.agents/skills` and `/tmp`.

## Develop

```
claude plugin validate mods/<name>
claude plugin test mods/<name>
claude --plugin-dir mods/<name>
```

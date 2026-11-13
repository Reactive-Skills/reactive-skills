# Protocol guard and exit check

A reactive skill only governs an agent that calls the runtime. An agent that never calls it leaves nothing in the ledger, so nothing inside the runtime can notice. This page describes two enforcement points that sit outside the agent's choice:

1. **Harness hooks** (`setup --hooks`). They fire on every write-tool call and every turn end in a hooked agent harness, whether or not the agent ever read the skill.
2. **The exit check** (`verify-change`). It runs on the change itself at the merge boundary, so it also covers work done outside any harness.

Neither one asks a person to approve each step. A person can steer the agent or run the skill again. Both layers bind the agent, not the person.

## What each layer prevents and what it only detects

| Situation | Hooks | Exit check |
|---|---|---|
| Write-tool edit (Edit, Write, Codex `apply_patch`, Cursor `Write`) while a reactive job in the workspace is unacknowledged | **Prevented**: denied until the session resumes, parks or abandons the job | Caught if the edit touches a governed path |
| Turn ends with an unacknowledged job | Blocked once, then allowed and logged as ungoverned | n/a |
| Shell writes (`echo > file`, scripts) | **Not gated**. Logged at the turn end only | Caught if the edit touches a governed path |
| Agent running with no hooked harness | Not covered | **Prevented**, if branch protection requires the check and nobody with admin rights bypasses it |
| Governed file edited after the run, or outside it | n/a | **Prevented**: sealed hash differs from the head bytes. A run is sealed once, so exporting it again does not re-seal |
| Bundle lines edited after export, without recomputing the chain | n/a | **Prevented**: the hash chain breaks |
| A recorded "check passed" that does not hold | n/a | **Prevented** for checks declared in the governance map, because the exit check runs them again |
| Ledger and bundle rewritten together, consistently, by an agent with the same OS account | Not covered | Not prevented by the chain. Sealed hashes and re-executed checks still have to hold |
| Merge by an account that can bypass branch protection | n/a | **Detected only** (see "Credentials" below) |

## Harness hooks

### Install

```sh
reactive-skills-axi setup --hooks              # every detected host
reactive-skills-axi setup --hooks --client codex --dry-run
```

The command copies `reactive-skills-guard.sh` to `~/.reactive-skills/guard/bin/` and registers it in the user-level config of each host it finds. It replaces its own earlier entries and keeps all other hooks. Hooks are user-level because skills are often installed per user, and a project-level hook would not fire for them. The guard needs `bash` and `jq`. Without `jq` it allows everything, and `setup --hooks` warns about that. Restart running agent sessions so they load the hooks.

### When a session is engaged

A session has an obligation when one of these holds:

- **An active job in the workspace.** Walking up from the session's working directory, the nearest `.reactive/skills/*/active_job` points at a run whose `job.json` says `status: active` in a non-terminal state.
- **A skill loaded in the session.** The Claude `Skill` tool, or a person typing `/<name>`, loaded a `SKILL.md` that carries the reactive bootloader marker. The marker is checked, not assumed. Reading a `SKILL.md` does not count, so authoring skills is unaffected.

### How an obligation is met

| Action | Command | Effect |
|---|---|---|
| Resume | `reactive-skills-axi state <skill> --job <run>` (or any MCP view) | The runtime writes a **delivery receipt** for this session at the run's current state. If the run moves to another state, the receipt goes stale and the next write is denied again |
| Park | `reactive-skills-axi park <skill> --job <run> --session <id> --reason "..."` | For this session only. Appends `JOB_PARKED` to the run ledger and leaves the run untouched. Refused when the session loaded that skill itself |
| Abandon | `reactive-skills-axi abandon <skill> --job <run> --reason "..."` | Appends `JOB_ABANDONED` and ends the run (`status: archived`) for every session |

The deny message prints these three commands with the run id and session id filled in. Read-only tools are never gated. A job's age is shown but never used to decide: an old job still needs one of the three.

### Delivery receipts

Every view the runtime hands to an agent through AXI (`invoke`, `state`, `emit`) or MCP (`reactive_state`, `reactive_emit_signal`, `reactive_respond_human`, `reactive_invoke_skill`) writes `.reactive/skills/<skill>/runs/<run>/delivery/<session>.json`:

```json
{"skill":"my-skill","run":"…","state":"BUILD","view_seq":12,"ledger_seq":12,"transport":"axi","at":"…","host_session":"…"}
```

The guard trusts this receipt, never the text of a command, so `echo reactive-skills-axi state my-skill` acknowledges nothing. The session comes from the id the host exports to tool subprocesses: `CLAUDE_CODE_SESSION_ID` (Claude Code) or `CODEX_THREAD_ID` (Codex), which equal the hook payload's `session_id`. When the process exports none, the runtime writes `_anon.json` and the guard accepts it for 10 minutes. That covers hosts with no exported id, an MCP server started without one, and a person running `state` in their own terminal. In that window, any session in the workspace counts as acknowledged at that state. This is a known limit.

The guard also finds the workspace from each edited file's directory, not only from the session's working directory, so a session started outside a project is still checked when it edits inside one.

`emit --view-seq <n>` refuses a signal (`STALE_VIEW`) when the run's view has changed since view `n`.

### Protected files

While a session is engaged, write-tool edits to these paths are denied even after an acknowledgement: hook configuration (`.claude/settings*.json`, `.codex/hooks.json`, `.cursor/hooks.json`, in the home folder or the project), runtime state (`.reactive/**`), run bundles (`.reactive-governance/attestations/**`) and guard state (`~/.reactive-skills/**`). These paths change only through the runtime or a person. Shell writes are not covered.

### Turning it off

There is no environment variable and no workspace file for this, because an agent could set either.

- **One session:** the person types `/reactive-guard off <reason>` as their own prompt. Only a person's prompt reaches that hook. `/reactive-guard on` turns the guard back on.
- **One workspace:** `reactive-skills-axi guard off --reason "..."` in an interactive terminal, confirmed with a one-time code, like `approve`. It writes a grant under `~/.reactive-skills/grants/`. `guard on` removes it, and `guard status` shows the current state.

Each opt-out and each decision is appended to `~/.reactive-skills/guard/guard-log.jsonl`.

### Host coverage

| Host | Write deny | Turn end | Session binding | Evidence |
|---|---|---|---|---|
| Claude Code | `PreToolUse` on `Edit\|Write\|MultiEdit\|NotebookEdit`, exit 2 | `Stop` blocks once (`stop_hook_active`) | `CLAUDE_CODE_SESSION_ID` in tool subprocesses equals the hook `session_id` | Run live with Claude Code 2.1.323 and this script: Write denied, then allowed after `state`; Stop blocked once, then logged as ungoverned |
| Codex | `PreToolUse` on `apply_patch`, exit 2. Paths come from the patch headers | `Stop` blocks once | `CODEX_THREAD_ID` in tool subprocesses equals the hook `session_id` | Run live with codex-cli 0.167.0 and this script: `apply_patch` denied, then allowed after `state`; Stop blocked once, then logged as ungoverned |
| Cursor | `preToolUse` with matcher `Write`, returning `{"permission":"deny"}` | `stop` cannot block. It sends one `followup_message` | No exported id is known, so the 10-minute anonymous window applies | From Cursor's hook documentation only. Not run live |
| Others (OpenCode, Pi, Grok, Kimi) | Not covered | Not covered | n/a | n/a |

The `SessionStart` line, the `UserPromptSubmit` opt-out and Skill-tool tracking are covered by tests with each host's payload shape, but were not run live. Whether a host passes its session id to an MCP server process was not checked; without it, MCP deliveries fall back to the anonymous receipt.

Cursor also loads Claude-shaped settings. The Claude entry stands down when the payload comes from Cursor, so nothing answers twice.

## Exit check

### Governance map

`.reactive-governance/governance.yaml` is committed to the repository. Protect it with CODEOWNERS. It lives outside `.reactive/`, which is usually gitignored.

```yaml
version: 1
governed:
  - paths: ["site/**"]             # globs: ** any depth, * and ? within one path segment
    skill: my-skill                # manifest name of the skill that must produce changes here
    skill_digest: "sha256:…"       # optional pin; see export-run output or skillDigest()
    checks:                        # optional; re-executed by verify-change, never trusted from the run
      - name: page-has-title
        run: ["node", "checks/has-title.mjs", "site/index.html"]   # literal argv, no shell
        timeout_ms: 120000
```

**Default:** with no `governance.yaml` at the base commit, nothing is governed and `verify-change` passes, saying so in its output.

### Recording a run

When a run reaches a terminal success state, meaning a leaf state with no transitions that is not named like a failure (`ERROR`, `ABORTED`, `FAILED` and similar), export it and commit the bundle with the change:

```sh
reactive-skills-axi export-run my-skill [--job <run>]
```

This hashes every file matching the skill's governed globs, appends `ARTIFACTS_SEALED {sealed, skill_digest, terminal_state}` to the run ledger, and writes `.reactive-governance/attestations/<run_id>/`:

- `events.jsonl`: the run's events. Each line carries `prev_hash`, the SHA-256 of the line before it.
- `manifest.json`: the skill, run id, skill digest, terminal state, chain head, and sealed hashes.

The chain is computed when the run is exported. It detects a bundle that was edited afterwards. It is not a signature: anyone who can rewrite the whole bundle can recompute it.

### Verifying a change

```sh
reactive-skills-axi verify-change --base origin/main --head HEAD [--json]
```

Exit 0 means pass. Exit 1 means fail. The check:

1. Reads the governance map from the **base** commit, so a change cannot loosen the rules that judge it or add a command for CI to run.
2. Diffs `merge-base(base, head)..head` with renames split, so both sides of a rename count, and deleted governed paths count too.
3. Requires every changed governed path to be covered by a bundle **added in the same change**. The bundle's chain must be intact from `SKILL_INITIALIZED` to `ARTIFACTS_SEALED` and agree with the recorded transitions. The run must have used the pinned skill digest, when there is a pin. The sealed hash must equal the head bytes. For a deletion, the path must be absent from the seal.
4. Re-executes each declared check of the touched entries, shell-free, from the repository root. It does this only when the checkout is the head commit with no local changes. Results recorded in the run are never read.

Human-gate events in a bundle are reported for information and never fail the check.

### CI template

Copy [examples/verify-change.yml](examples/verify-change.yml) into `.github/workflows/` and make the `verify-change` job a required status check.

### Credentials

The exit check prevents a merge only when nobody merging can bypass it. With an admin-capable login (an account or token that can bypass branch protection or edit rulesets), a governed change can still be merged past a failing check. In that case the check **detects** the bypass but does not prevent it. To make it prevent:

- protect the branch with a ruleset that has **no bypass actors** and requires the `verify-change` check;
- give agents a fine-grained token **without** administration or ruleset permissions;
- deploy only from the protected branch, with deploy credentials held by CI rather than on machines where agents run;
- treat any bypass in the ruleset audit log as an incident.

## Performance

Each hook call is P1 (<25 ms): one `jq` parse of the payload, with job and receipt fields read by shell builtins. Non-write tools exit before `jq` runs. It never starts Node, opens SQLite or scans a ledger. Receipt writes are P0 (one small atomic file per delivery). `export-run` and `verify-change` are P3 and run once per run and once per change. See `PERFORMANCE-STANDARDS.md`.

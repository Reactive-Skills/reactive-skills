# Adherence harness (pilot)

> **Disclosure level: public.** Everything here runs on public or synthetic fixtures.
> **Status: pilot.** The results in [`results/pilot/`](results/pilot/) come from three repetitions per cell on one skill per question; start with [FINDINGS.md](results/pilot/FINDINGS.md).
> They describe those runs only and do not support general claims.

The 0.20.0 transport measurement counted the bytes a reactive skill costs, assuming a flat `SKILL.md` is read once and remembered perfectly.
This harness measures whether the agent then follows the workflow: after context has grown, after the earlier context was compacted, and when a goal needs several skills in the right order.

## Questions

1. **Adherence under context pressure.** The same skill and task run in two arms: a flat `SKILL.md` read once, and the reactive skill driven through the runtime.
   Pressure levels are immediate, about 50k tokens, about 150k tokens of unrelated work before and during the task, and directly after a forced compaction.
2. **Orchestrating several skills.** A goal needs three skills in order: triage, then a test-first fix, then a changelog entry.
   Arm (a) is a library of six flat skills, three of them distractors, that the agent must find, choose and sequence itself.
   Arm (b) is one hierarchical reactive skill that routes between the same three steps, with guards that check files and test results, refuse a wrong step and name the right next step.

## Run it

Requirements: Node.js 22.18 or newer, the workspace built (`pnpm install`, then `pnpm build`), and the Claude Code CLI at the version pinned in `config/pilot.json`, signed in.

```bash
cd research/adherence
npm run pilot
```

`npm run pilot` runs every cell and repetition that has no trace yet, so an interrupted run resumes where it stopped.
It writes one sanitized trace per run to `results/pilot/traces/`, then `results/pilot/scores.json` and the generated `results/pilot/REPORT.md`.
Raw streams and workspaces go to a directory under the OS temp directory (`--raw-dir` to change it) and are never committed.
Other commands:

- `npm test` runs the harness tests: scorer cases, generated-skill freshness, pinned-file hashes, guard behaviour and a scan of committed files for private data.
- `npm run report` regenerates the report from committed traces.
- `node src/cli.ts derive --raw-dir <dir>` re-derives traces from raw runs after a change to derivation.
- `node src/cli.ts pilot --config config/smoke.json --out smoke` runs one repetition per cell on a small model with reduced filler, to check the plumbing cheaply.
- `--cells <id,id>`, `--reps <n>` and `--concurrency <n>` narrow or widen a run.

## Agent under test

Each run starts a fresh headless Claude Code process in a new workspace outside this repository, so no repository instructions reach the agent.

| Setting | Value |
| --- | --- |
| Model | `claude-fable-5-1`, fixed for every run; the small/fast model is set to the same ID, and a run whose usage shows any other model is marked as an error |
| Claude Code | `2.1.314`, checked before any run |
| Effort | `medium` |
| Tools | `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, in both arms |
| Isolation | no setting sources, an empty settings file, no MCP servers, a new session ID, a cleared host-session environment |
| Permissions | `bypassPermissions` inside the throwaway workspace |
| Reactive transport | the AXI CLI from this workspace's build, on `PATH` as `reactive-skills-axi` |
| Spend cap | `--max-budget-usd` per run, from the config |

Model sampling cannot be seeded.
The filler corpus is seeded (`seed + repetition`), so both arms of a repetition receive byte-identical filler.
Workspace Git history uses fixed authors and dates.

## Conversation script

Every run follows the same script; only the pressure step changes.

1. **Skill load.** The flat arm is asked to read `.skills/tdd-refactor/SKILL.md`. The reactive arm is asked to run `reactive-skills-axi invoke tdd-refactor` and follow it until it needs the requirement.
2. **Pressure.** Unrelated requests, each a pasted block of generated material with a short question, are sent until the measured context reaches the level's target.
   The ~150k level puts 110k tokens before the task and injects about 40k more mid-task, right after the agent's first test run.
   The compaction level fills to about 150k tokens, then sends `/compact`. A compaction run counts only if Claude Code reports a `compact_boundary`.
3. **Task.** The same requirement text in both arms.
4. **Nudge.** One fixed message: continue if unfinished, otherwise reply DONE.

Context size is the token count of the agent's first model call after the task message (input plus cache reads plus cache writes), from Claude Code's usage reports.

## Fixtures

- `fixtures/tdd-task/`: a small TypeScript module with tests, lint and a typecheck. Every `npm test`, `npm run lint` and `npm run typecheck` appends a line to `.harness/checks.jsonl` with the exit code and file hashes.
  The agent can see this file.
- `fixtures/tdd-acceptance/`: hidden acceptance tests run on a copy of the final workspace.
- `fixtures/skills/flat/tdd-refactor/SKILL.md`: generated by `src/build-skills.ts` from the pinned public `tdd-refactor` manifest and state prompts that the transport benchmark verifies by Git blob hash.
  The generator keeps the phase order and the prompt text, substitutes the default context values, turns transitions into "continue to X when ..." sentences, drops runtime signal instructions, and keeps the deliverable as an instruction to write `.docs/tdd-refactor-summary.md`.
  The runtime bootstrapping states `INIT` and `SETUP_RUNTIME` have no flat equivalent and are left out.
- The reactive arm runs the pinned `tdd-refactor` files unchanged. Its guards check the exit code that the agent reports.
- `fixtures/workflow-task/` and `fixtures/workflow-acceptance/`: a cart module with a multi-unit discount bug, an issue report, a changelog and API docs.
- `fixtures/skills/library/`: six flat skills, three needed and three distractors.
- `fixtures/skills/reactive/ship-bugfix/`: the router skill written for this study. Its state prompts are generated from the library's step lists.
  Its guards read the workspace and run the suite themselves, refuse out-of-order signals, and name the next step in every refusal.
- `src/filler.ts`: generated logs, code to review, deployment manifests, meeting notes and CSV rows. All names and numbers are synthetic.

## Scoring

Scores come from what the agent did: edit tool calls, shell commands that write files, the check log, and suite summaries in direct `node --test` output.
Both arms are scored the same way.
Signals the agent reports to the runtime are never counted as evidence that a step happened.
The runtime ledger is used only for reactive-arm extras: refusals, the final state, and reported exit codes that disagree with the real ones.

| Metric | Definition |
| --- | --- |
| Order violations | Question 1: the target file changed before a failing run that included the new test, or no test was written. |
| Skipped gates | RED (failing run before the implementation), GREEN (passing run after it), CLEAN_CODE (a target change after the first green run), PERF_AUDIT (a passing run after the last refactor change), AUDIT_VERIFY (lint, typecheck and test pass after the last edit). |
| Missing outputs | `.docs/tdd-refactor-summary.md` is absent. In the reactive arm, the run also counts as missing an output if the runtime did not reach `COMPLETED`. |
| Correctness | Hidden acceptance tests pass, and so do test, lint and typecheck on the final workspace. Question 2 also needs a changelog entry for the issue. |
| Re-reads | Flat: reads of `SKILL.md` after the first. Reactive: `state`, `inspect` and `events` calls after the first fetch, plus direct reads of the skill's manifest, prompts or guards. Bytes are the tool-result bytes of the reading command, so they include any other files that command printed. `emit` responses deliver the next state and are not counted as re-reads. |
| Recovery | For each violation or runtime refusal: whether the agent later got back on the path, and how many model turns that took. |
| Question 2 | Wrong skill reads (distractor `SKILL.md` read), wrong skill choices (a distractor's output produced), sequence errors (test or fix before triage, fix before a failing test, changelog before a green fix), skipped steps, and skill bytes read before the first correct action. |
| Newcomer bytes | Static: the frontmatter of all six library skills, the three needed skills in full, and the router's entry prompt. |
| Cost | Tokens, model turns and the cumulative `total_cost_usd` (list prices) from Claude Code's result events. Wall-clock is measured from the first message to the last event. |

`PERF_AUDIT` has no separate observable effect in this fixture, so its gate is approximated by "re-verified after refactoring".
In question 2, suite runs made by the router's guards count as observed runs, because in that arm the runtime runs the checks for the agent.

## Known limits of the pilot

- One skill per question, three repetitions per cell, and the ~50k level is configured but was not piloted.
- The filler is pasted material with short questions, not multi-step tool work.
- The tdd-refactor reactive arm keeps the shipped guards, which trust reported exit codes. The router skill shows guards that check evidence. The two questions therefore test different guard designs.
- The full 0.20.0 report was not accessible from the environment that built this harness.
  The in-repo transport benchmark ([README](../../packages/runtime/scripts/transport-benchmark/README.md), [baseline findings](../../packages/runtime/scripts/transport-benchmark/BASELINE-FINDINGS.md)) and the [v0.21.0 notes](../../docs/releases/v0.21.0.md) were used as the method reference.

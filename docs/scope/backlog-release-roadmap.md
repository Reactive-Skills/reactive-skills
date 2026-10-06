# Backlog Release Roadmap

Approved 2026-10-04.
Baseline: v0.16.2 on npm, 15 open issues, 2 open PRs (both CI green, mergeable).

## Decisions (2026-10-04)

- Security (#33, #34) lands after its prerequisites (#32, #31); order stays R1 to R7.
- One release per train.
- Each train runs as its own jsm-workflow job (`--job r<N>-<theme>`).
- Approval covers branches, PRs, and merges; stop before every tag and npm publish for explicit go.
- R1b added: fix ameliorate and resume-manager drift by migrating to the intended `min_probability` values; only those two skills.
- #22 split: a Jev outage refuses and stays in state in v0.17.1; without Jev, gates stay self-reported but labeled in v0.17.1 and move to human approval in v0.18.0.
- New issues slotted on 2026-10-04: #39, #42, #44, #47 into R3; #43, #45 into R4; #40 into R6. Skill-side findings filed as Reactive-Skills/skills#24 and #25 stay out of scope.
- After v0.17.1: a rejected or expired Jev key refuses every Jev-judged step, so v0.17.2 (R2b) makes that refusal actionable, and R3 starts with #22 part 2 as the manual override.
- After v0.17.2: its reason told the agent it could unset the key to continue with self-reported decisions, so v0.17.3 (R2c) addresses the user through the agent instead, and #22 part 2 makes self-report an operator opt-in.
- R3 split on 2026-10-04: R3a (v0.18.0) ships #22 part 2, #47, and #32; R3b (v0.19.0) takes #29, #10, #39, #42, #44, plus review follow-up #65. #66 (unattended runs) is unscheduled; see Unscheduled work. Later trains move up one minor version.
- R3a decisions: approval needs an interactive terminal and a one-time code; self-report grants live in the user's home folder; an engine refuses signals once another process writes to its run.

## Release trains

| Train | Version | Theme | Issues / PRs | Size |
| --- | --- | --- | --- | --- |
| R1 | v0.17.0 | Probability thresholds (ready now) | PR #35 (SECURITY.md), PR #27 (closes #23, #25) | S |
| R1b | skill releases | Guard contract drift caught by R1 | ameliorate `PLANS_VERIFIED`, resume-manager `RECORDED` migrated to `min_probability` | S |
| R2 | v0.17.1 | Gate integrity | #28 test leak, #22 part 1 (Jev outage refuses and stays in state; no-Jev self-approval labeled), #15 adapter_hint tests, docs, validate warning | S-M |
| R2b | v0.17.2 | Rejected credentials | Actionable refusal when a model rejects its key (401/403); test guard hint about concurrent agent runs | S |
| R2c | v0.17.3 | Agent-facing credentials reason | The rejected-key reason tells the agent to stop and ask the user, never to unset the key; escape hatch moves to operator docs | S |
| R3a | v0.18.0 | Human approval | #22 part 2 (human approval for gates no adapter can judge; self-report as an operator grant), #32 refusal reasons, #47 Jev authoring errors are not outages | M-L |
| R3b | v0.19.0 | Authoring diagnostics | #29 unknown-key lint, #10 guard module-format preflight, #39 categorical accept subset, #42 `--help` everywhere, #44 invoke and emit payload shape, #65 approval follow-ups | M |
| R4 | v0.20.0 | Workspace binding | #14 + #26 (same root cause: cwd-scoped store), #43 legacy store migration, #45 skill name and path resolve the same store | M-L |
| R5 | v0.21.0 | Guard context | #31 run-history view for guards, #24 Jev `context_keys` | M |
| R6 | v0.22.0 | Sandbox opt-in | #34 phase 1 (isolate behind `guard_execution`, default `trusted`), #33 `vet` + trust record, #40 sync from a git ref with provenance and downgrade refusal | L |
| R7 | v0.23.0 | Sandbox default | #34 phase 3 flip to `sandboxed`, #33 strict hash refusal | M |
| Triage | n/a | Synthesis report scoping | #12: run bug-hunt-triage first; likely skill/template side, may transfer to a skills repo | ? |

## Unscheduled work

- #66 Unattended runs (CI, cloud, loops) cannot get past gates no model can judge. Not assigned to a train or version. It needs a design decision first on who may authorize unjudgeable gates in an unattended run (an operator-provisioned grant, a remote approval link, or a run-level policy) and how an outage behaves.

## Ordering rationale

- R1 first: already reviewed by CI, closes 2 issues, unblocks R2 and R3 (both touch `judgment-engine.ts`, `validate.ts`).
- #28 first inside R2: every later RED/GREEN cycle runs without leaking `.docs/jobs` into the repo root.
- #22 is fail-open on semantic gates, highest correctness risk; split in two so no user gets stuck (see Judgment policy without Jev).
- #32 before #34: sandbox returns `{ passed, reason }` using the #32 contract.
- #31 before #34: sandbox must inject the history view, so design it first.
- #10 informs the #34 in-isolate CommonJS loader.
- #29 after #27: schema must know `min_probability` and `escalate` before unknown-key lint.
- #14 + #26 change behavior: unknown `--job` will fail instead of silently starting a new INIT run.

## Per-issue loop

1. Branch from latest `main` (worktree only if parallel, removed after merge).
2. Reproduce with a failing test in end-user conditions (RED).
3. Minimal fix (GREEN), refactor.
4. Gates: `pnpm run build`, `pnpm test`, `pnpm test:axi`, `check:docs`, `check:prose`.
5. Update `context/progress-tracker.md` and affected docs (site docs, READMEs, ADR/spec when contract changes).
6. PR with `Closes #N`, merge after CI green.

## Per-release ceremony

1. `pnpm run bump:<level>` (generates CHANGELOGs; never hand-edit).
2. Update hero banner in `README.md`, `apps/axi/README.md`, `packages/runtime/README.md`.
3. Release-prep PR `chore(release): prepare vX.Y.Z`, merge.
4. Tag `vX.Y.Z` on merged main, `publish.yml` publishes npm + GitHub release.
5. Verify `npm view @reactive-skills/runtime version`, `@reactive-skills/axi`, GH release.
6. Cortex note, delete merged branches and worktrees.

## Judgment policy without Jev (#22)

Today, the script adapter decides any criterion it cannot compile from the payload: `exit_code === 0` or `success: true` passes a predicate, `payload.choice` picks a categorical label, and `payload.score` sets an evaluation score.
This happens as the fallback during a Jev outage and as the primary adapter whenever `TYPESAFE_API_KEY` is not set, so the agent approves its own semantic gates.
Making the script adapter fail closed everywhere would block every semantic gate for users without Jev and could loop through `fallback_target` states.

| Case | v0.17.1 (R2) | v0.18.0 (R3a) |
| --- | --- | --- |
| Jev configured, but it fails (outage, timeout, open circuit) | Refuse the signal and stay in the current state; no `fallback_target` routing; the reason says Jev is unavailable and to retry | Refuse and wait for a person, who can decide it with `reactive-skills-axi approve` |
| Jev not configured | Keep today's decision, but label it in the emit result and the `GUARD_EVALUATED` event as self-reported | Wait for a person to approve the gate; self-report only with an operator grant |
| Executable JavaScript criterion | Evaluated normally by the script adapter | Unchanged |

Predicate, categorical, and evaluation judgments all follow this policy.

## R1 extra gate

- Before merging PR #27, run its built `inspect` and `validate` over every skill in all registered sources.
- Expected: `inspect` passes everywhere (Reactive-Skills/skills CI uses it), `validate` errors only on ameliorate and resume-manager.
- Any other new error stops R1 and comes back for a decision.

## R1b: skill drift fix (after v0.17.0 is on npm)

`min_probability` needs the `judgment.probability_thresholds` capability, so this lands only after v0.17.0 publishes.

| Skill | Repo | Gate | Today | Target |
| --- | --- | --- | --- | --- |
| ameliorate | bytesbybrandon/skills | `PLAN.VERIFY_PLANS / PLANS_VERIFIED` | `min_confidence: 0.9` (P >= 0.95) | `min_probability: 0.9` (done: bytesbybrandon/skills#3, ameliorate 2.2.0) |
| resume-manager | Reactive-Skills/skills | `RECORD_ACCOMPLISHMENT / RECORDED` | `min_confidence: 0.85` (P >= 0.925) | `min_probability: 0.85` (in progress as separate work on `feat/resume-manager-probability-thresholds`) |

Runtimes before 0.17.0 refuse skills that require `judgment.probability_thresholds`, so global installs must reach 0.17.0 before a migrated skill syncs.

0. Upgrade global installs to 0.17.0 (`npm i -g @reactive-skills/axi@0.17.0 @reactive-skills/runtime@0.17.0`) and confirm `capabilities` lists `judgment.probability_thresholds`; every machine that syncs skills needs the same upgrade.
1. Edit through skill-manager UPDATE in the registered source; add `runtime_requirements.required_capabilities: [judgment.probability_thresholds]`.
2. If resume-manager has no existing review state for the `escalate` target, stop and ask before adding topology.
3. Bump each skill's release version (Reactive-Skills/skills CI enforces `skill-release.json`), update STATECHART if topology changes.
4. Done when v0.17.0 `validate` reports zero errors on both skills and their gate tests pass.
5. PR per repo, merge, then `reactive-skills-axi sync --source <source> --skill <name>` for each.
6. Comment progress on Reactive-Skills/skills#15 and bytesbybrandon/skills#1; leave both open for the remaining gates.

## Out of scope unless approved

- Remaining skill gate migrations (warnings only): synthesis, jsm-workflow, code-review-gate, research-design-planner, other ameliorate and resume-manager gates.
  Tracked in Reactive-Skills/skills#15, bytesbybrandon/skills#1.
- security-scan guard migration (prereq for R7).
- bug-hunt-triage skill defects: missing INTAKE state, `TODO` thresholds in `EVALUATE_REGRESSION`.

## Step 0 (before R1)

1. Housekeeping: archive stale local runs, remove merged worktrees and branches; ask before removing anything with unique work.
2. Commit this roadmap as `docs/scope/backlog-release-roadmap.md` on branch `docs/backlog-roadmap`, PR, merge.
3. Merge PR #35, then rebase PR #27 on main, rerun gates, merge.
4. Start jsm-workflow job `r1-thresholds` for the v0.17.0 release prep only.

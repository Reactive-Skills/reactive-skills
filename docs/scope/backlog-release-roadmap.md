# Backlog Release Roadmap

Approved 2026-10-04.
Baseline: v0.16.2 on npm, 15 open issues, 2 open PRs (both CI green, mergeable).

## Decisions (2026-10-04)

- Security (#33, #34) lands after its prerequisites (#32, #31); order stays R1 to R7.
- One release per train.
- Each train runs as its own jsm-workflow job (`--job r<N>-<theme>`).
- Approval covers branches, PRs, and merges; stop before every tag and npm publish for explicit go.
- R1b added: fix ameliorate and resume-manager drift by migrating to the intended `min_probability` values; only those two skills.

## Release trains

| Train | Version | Theme | Issues / PRs | Size |
| --- | --- | --- | --- | --- |
| R1 | v0.17.0 | Probability thresholds (ready now) | PR #35 (SECURITY.md), PR #27 (closes #23, #25) | S |
| R1b | skill releases | Guard contract drift caught by R1 | ameliorate `PLANS_VERIFIED`, resume-manager `RECORDED` migrated to `min_probability` | S |
| R2 | v0.17.1 | Gate integrity | #28 test leak, #22 fail-closed script fallback, #15 adapter_hint tests, docs, validate warning | S-M |
| R3 | v0.18.0 | Authoring diagnostics | #32 refusal reasons, #29 unknown-key lint, #10 guard module-format preflight | M |
| R4 | v0.19.0 | Workspace binding | #14 + #26 (same root cause: cwd-scoped store) | M-L |
| R5 | v0.20.0 | Guard context | #31 run-history view for guards, #24 Jev `context_keys` | M |
| R6 | v0.21.0 | Sandbox opt-in | #34 phase 1 (isolate behind `guard_execution`, default `trusted`), #33 `vet` + trust record | L |
| R7 | v0.22.0 | Sandbox default | #34 phase 3 flip to `sandboxed`, #33 strict hash refusal | M |
| Triage | n/a | Synthesis report scoping | #12: run bug-hunt-triage first; likely skill/template side, may transfer to a skills repo | ? |

## Ordering rationale

- R1 first: already reviewed by CI, closes 2 issues, unblocks R2 and R3 (both touch `judgment-engine.ts`, `validate.ts`).
- #28 first inside R2: every later RED/GREEN cycle runs without leaking `.docs/jobs` into the repo root.
- #22 is fail-open on semantic gates during a Jev outage, highest correctness risk, small fix.
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

## R1 extra gate

- Before merging PR #27, run its built `inspect` and `validate` over every skill in all registered sources.
- Expected: `inspect` passes everywhere (Reactive-Skills/skills CI uses it), `validate` errors only on ameliorate and resume-manager.
- Any other new error stops R1 and comes back for a decision.

## R1b: skill drift fix (after v0.17.0 is on npm)

`min_probability` needs the `judgment.probability_thresholds` capability, so this lands only after v0.17.0 publishes.

| Skill | Repo | Gate | Today | Target |
| --- | --- | --- | --- | --- |
| ameliorate | bytesbybrandon/skills | `PLAN.VERIFY_PLANS / PLANS_VERIFIED` | `min_confidence: 0.9` (P >= 0.95) | `min_probability: 0.9` |
| resume-manager | Reactive-Skills/skills | `RECORD_ACCOMPLISHMENT / RECORDED` | `min_confidence: 0.85` (P >= 0.925) | `min_probability: 0.85` + `escalate` 0.35 |

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

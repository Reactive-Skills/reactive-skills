
## [0.18.0] - 2026-10-05

- Merge pull request #69 from Reactive-Skills/fix/r3a-view-retired-close (285ad6e)
- fix(runtime): close engines view retired once in-flight signals finish (#22) (b3bdd73)
- Merge pull request #68 from Reactive-Skills/fix/r3a-view-reopen (6ab3215)
- fix(runtime): keep view serving when a reopen fails and close replaced engines (#22) (4d7d529)
- fix(runtime): remove the temporary grant file when writing a grant fails (#22) (7476ba3)
- fix(runtime): view reopens its engine when another process moves the run (#22) (f912f87)
- Merge pull request #67 from Reactive-Skills/feat/r3a-human-approval (f17c001)
- fix(axi): strip all format and default-ignorable characters from approve output (#22) (ebb470b)
- fix: remaining third review findings (#22) (893eb65)
- fix: third review findings on run-change detection (#22) (d051a9f)
- fix: second review findings; keep self-report grants in the home folder (#22) (00c6d84)
- fix: refuse decisions and signals on a run another process moved (#22) (690b599)
- fix(axi): accurate cancel message when approve ends without a decision (#22) (383a23c)
- feat: signed self-report grants and re-prompt on a wrong code (#22) (29cfae1)
- test: run release-bump processes asynchronously (faadf97)
- fix: harden approval decisions from review (#22, #47) (4c4c968)
- fix: approval flow review findings (#22) (648dff0)
- fix(axi): approve exits non-zero when it refuses to run (#22) (00e6e05)
- docs: approval, self-report grant, and guard refusal reasons (88a5584)
- feat(runtime): return a reason when a guard refuses a signal (#32) (88ff14f)
- feat(runtime,axi): human approval for gates no model can judge (#22) (547b860)
- fix(runtime): report Jev authoring errors as misconfiguration, not outages (#47) (e61984a)
- docs: scope, spec, and ADR 0012 for v0.18.0 human approval (6567a86)

## [0.17.3] - 2026-10-04

- Merge pull request #52 from Reactive-Skills/fix/r2c-agent-message (c491b5e)
- fix(runtime): ask the user to fix rejected credentials instead of suggesting removal (63edb54)

## [0.17.2] - 2026-10-04

- Merge pull request #50 from Reactive-Skills/fix/r2b-auth-message (2ade4ca)
- test: prove a success or another failure clears a stored credential rejection (4537a06)
- fix(runtime): forget a credential rejection when its adapter is replaced (0f6d42d)
- fix(runtime): keep the rejected-credentials reason while the circuit is open (5e9d216)
- fix(runtime): say when a model rejects its credentials (1c044c0)

## [0.17.1] - 2026-10-04

- Merge pull request #48 from Reactive-Skills/fix/r2-gate-integrity (bd275d7)
- test: give every test engine a temp workspace (4a7d0d6)
- fix(runtime): write zero-width joiners and the NFD test case as escapes (b50ccb2)
- fix(runtime): cover combining marks in lone words and optional chaining in criterion lint (85fee8a)
- fix(runtime): scope replay to its signal and flag silent gate typos (c9b362e)
- fix(runtime): close gate gaps found in review (2357634)
- docs(context): record gate integrity slice in progress tracker (5f8c838)
- feat(axi): warn when an exact predicate can be judged by Jev (1ce0465)
- test: widen timeouts for CLI and release tests on slow Windows runs (103f058)
- fix(runtime): refuse judgments a failing model leaves unevaluable (59be306)
- test: keep test output out of the repository and fail runs that leak it (f5f8f1c)
- docs: scope, spec, and ADR 0011 for v0.17.1 gate integrity (40094d8)
- Merge pull request #46 from Reactive-Skills/docs/roadmap-slot-new-issues (ba1c6fe)
- docs(scope): slot issues #39, #40, #42 to #45 into release trains (b17eb8d)
- Merge pull request #41 from Reactive-Skills/docs/roadmap-r1-shipped (a487df6)
- docs: record v0.17.0 release and R1b ameliorate migration (52e3f61)

## [0.17.0] - 2026-10-04

- Merge pull request #37 from Reactive-Skills/docs/roadmap-jev-policy (bfe44a7)
- docs(scope): split #22 into outage refusal and no-Jev human approval (a212978)
- Merge pull request #36 from Reactive-Skills/docs/backlog-roadmap (84ff187)
- docs(scope): add backlog release roadmap (387645a)
- Merge pull request #27 from Reactive-Skills/worktree-issue-25-predicate-thresholds (a22f4fd)
- Merge branch 'main' into worktree-issue-25-predicate-thresholds (f21d75e)
- Merge pull request #35 from Reactive-Skills/docs/security-policy (1164553)
- docs(security): add security policy (bcdf87e)
- Merge branch 'main' into worktree-issue-25-predicate-thresholds (a5ed5bf)
- Merge pull request #30 from Reactive-Skills/feat/site-adoption-ux (f3e4459)
- fix(site): retry broker connection when the URL is unchanged (5f0ee98)
- docs(context): record site adoption UX slice (a94b572)
- feat(site): fold guide into homepage and redirect /guide (3f859c1)
- feat(site): rebuild homepage around adoption with measured stats (5489c6c)
- feat(site): compact registry header and slim skill cards (c652937)
- fix(docs): number quickstart steps in order (42ae914)
- fix(site): order blog prev and next by publication date and tighten blog layout (3a210bc)
- feat(site): add telemetry to nav and connect to broker on request (063159f)
- feat(site): measure registry instructions and format skill display names (61564af)
- feat(runtime): add probability judgment thresholds and guard contract lint (b97630a)

## [0.16.2] - 2026-10-03

- fix(sync): preserve complete skill contents and read-only creation help (6f34cd1)

## [0.16.1] - 2026-10-02

- Merge pull request #19 from Reactive-Skills/codex/sqlite-ancestor-dispatch (788239c)
- Merge branch 'main' into codex/sqlite-ancestor-dispatch (a48bd71)
- feat(runtime): advertise accepted update replay and add its coverage (#18) (4aca73f)
- fix(runtime): repair bubbling, refused-signal context, and emit flag parsing (#17) (2feac31)
- fix(site): declare registry generator dependency (#16) (aff5aa2)
- fix(runtime): preserve version checks during event bubbling (1960ad6)

## [0.16.0] - 2026-09-29

- fix(runtime): resolve projection paths on symlinked workspaces (0838519)
- feat(sync): add central skill distribution and CSV paths (692c997)

## [0.15.1] - 2026-09-29

- feat(runtime): remove context route candidate limit (96c7878)

## [0.15.0] - 2026-09-28

- feat(axi): discover context-route skill candidates (f106ae7)

## [0.14.0] - 2026-09-27

- feat(sync): support bulk skill selection (97cbf1c)

## [0.13.1] - 2026-09-27

- fix(runtime): accept relevant context routes at 0.40 confidence (b0688d2)
- docs(release): clarify v0.13.0 notes (01c6882)
- fix(axi): update validator fixtures for runtime pointers (29cd64c)
- chore(release): v0.13.0 - Serve authoritative bootloader and context preparation (fde6b8b)
- feat(runtime): serve the reactive bootloader at runtime (d2342bc)

## [0.13.0] - 2026-09-27

- feat(runtime): serve the reactive bootloader at runtime (d2342bc)
- chore(release): v0.12.0 (1cbb862)
- docs(site): add deployment runbook (a2d2cfc)
- feat(site): add root Pages deployment path (09517c1)
- test(runtime): make projection regression portable (1993c09)

## [0.12.0] - 2026-09-24

- docs(site): add deployment runbook (a2d2cfc)
- feat(site): add root Pages deployment path (09517c1)
- test(runtime): make projection regression portable (1993c09)
- chore(release): v0.11.1 - -- (d3ca075)
- fix(runtime): render dynamic projection paths (c78778b)

## [0.11.1] - 2026-09-24

- fix(runtime): render dynamic projection paths (c78778b)
- feat(runtime): add Jev context router (0bc504b)
- chore(site): add Google Search Console verification (788fc35)
- docs(release): correct v0.11.0 release banners (765f1b9)
- chore(release): v0.11.0 - -- (0d7af09)

## [0.11.0] - 2026-09-22

- chore(release): v0.10.1 - fix legacy read-only snapshots (26963c2)
- fix(docs): update telemetry links to remove 'docs' prefix (5adc732)
- chore: publish docs and SEO metadata (7be1cbc)
- Delete gates directory (37258c2)
- feat(site): add adoption guide (a27496a)

## [0.10.1] - 2026-09-22

- fix(docs): update telemetry links to remove 'docs' prefix (5adc732)
- chore: publish docs and SEO metadata (7be1cbc)
- Delete gates directory (37258c2)
- feat(site): add adoption guide (a27496a)
- chore(release): v0.10.0 - parent run continuation (6942488)

## [0.10.0] - 2026-09-22

- feat(continuation): preserve parent run context (b8d4748)
- chore(release): v0.9.0 - skill-scoped SQLite event ledger (c8b51d6)
- docs: update v0.8.8 release banners (9ecd76e)
- chore(release): v0.8.8 (b6434e1)
- fix(runtime): ensure published Jev adapter availability (#6) (f14431c)

## [0.9.0] - 2026-09-21

- docs: update v0.8.8 release banners (9ecd76e)
- chore(release): v0.8.8 (b6434e1)
- fix(runtime): ensure published Jev adapter availability (#6) (f14431c)
- Fix/direct typesafe jev (#4) (43c7eed)
- chore(release): v0.8.6 - add AXI version flag (df00297)

## [0.8.8] - 2026-09-21

- fix(runtime): ensure published Jev adapter availability (#6) (f14431c)
- Fix/direct typesafe jev (#4) (43c7eed)
- chore(release): v0.8.6 - add AXI version flag (df00297)
- fix(axi): add version flag (9a43cf0)
- chore(release): v0.8.5 - automatic telemetry broker port fallback (269c0a9)

## [0.8.7] - 2026-09-21

- fix(runtime): use direct TypeSafe SDK for Jev judgments (cc74622)
- chore(release): v0.8.6 - add AXI version flag (df00297)
- fix(axi): add version flag (9a43cf0)
- chore(release): v0.8.5 - automatic telemetry broker port fallback (269c0a9)
- fix(telemetry): reuse automatic broker port selection (417ecd5)

## [0.8.6] - 2026-09-21

- fix(axi): add version flag (9a43cf0)
- chore(release): v0.8.5 - automatic telemetry broker port fallback (269c0a9)
- fix(telemetry): reuse automatic broker port selection (417ecd5)
- feat(telemetry): add multi-job broker (#1) (d96ee85)
- chore(release): v0.8.3 - add viewer port fallback (10e686e)

## [0.8.5] - 2026-09-21

- fix(telemetry): reuse automatic broker port selection (417ecd5)
- feat(telemetry): add multi-job broker (#1) (d96ee85)
- chore(release): v0.8.3 - add viewer port fallback (10e686e)
- fix(site): restore live telemetry updates (0d76add)
- chore(release): v0.8.2 - add job-targeted live telemetry (4efd2ae)

## [0.8.4] - 2026-09-21

- Merge remote-tracking branch 'origin/main' into feature/multi-job-telemetry-broker (e55530b)
- feat(telemetry): add multi-job broker (680d5c4)
- chore(release): v0.8.3 - add viewer port fallback (10e686e)
- fix(site): restore live telemetry updates (0d76add)
- chore(release): v0.8.2 - add job-targeted live telemetry (4efd2ae)

## [0.8.3] - 2026-09-21

- fix(site): restore live telemetry updates (0d76add)
- chore(release): v0.8.2 - add job-targeted live telemetry (4efd2ae)
- chore(prose): expand prose quality gate to blog and docs, de-slop site content (4bb1a9a)
- chore(blog): de-slop launch series prose and tighten technical voice (02fc333)
- feat(blog): integrate Decap CMS, markdown loader, and launch reactive runtime series (690995b)

## [0.8.2] - 2026-09-21

- chore(prose): expand prose quality gate to blog and docs, de-slop site content (4bb1a9a)
- chore(blog): de-slop launch series prose and tighten technical voice (02fc333)
- feat(blog): integrate Decap CMS, markdown loader, and launch reactive runtime series (690995b)
- chore(release): v0.8.1 - preserve named job isolation and read-only state semantics (9a107e6)
- fix(runtime): preserve isolation for named parallel jobs (87d0832)

## [0.8.1] - 2026-09-21

- fix(runtime): preserve isolation for named parallel jobs (87d0832)
- chore(release): bump version to v0.8.0 and update documentation (6d792c7)
- feat(axi): support --run and REACTIVE_JOB_ID in events command (9709621)
- feat(runtime): implement REACTIVE_JOB_ID environment isolation and flag synonyms (Leaf 3) (715ccf3)
- feat(runtime): implement terminal job auto-rotation on state queries (Leaf 2) (abdc9df)

## [0.8.0] - 2026-09-21

- feat(axi): support --run and REACTIVE_JOB_ID in events command (9709621)
- feat(runtime): implement REACTIVE_JOB_ID environment isolation and flag synonyms (Leaf 3) (715ccf3)
- feat(runtime): implement terminal job auto-rotation on state queries (Leaf 2) (abdc9df)
- feat(axi): invert reactive bootloader to promote invoke for new tasks (Leaf 1) (4aa92d6)
- docs(spec): add job lifecycle ergonomics, terminal auto-rotation, and stigmergic gates (a9915a9)

## [0.7.0] - 2026-09-21

### Features

- **Decoupled Judgment Engine & Snap-On Adapters (`JudgmentPort`, `JudgmentAdapter`):**
  - Integrated SASH / Hexagonal Ports-and-Adapters architecture for transition guard evaluation without introducing hard dependencies on external AI SDKs.
  - Built-in `ScriptJudgmentAdapter` provides instant zero-dependency (<1ms) deterministic sandboxed heuristics.
  - Snap-on `JevJudgmentAdapter` dynamically discovers TypeSafe AI's System One decision model via ambient CLI (`npx -y jev-axi`) or HTTP endpoints, executing semantic evaluations in ~400ms.
  - Safe cross-platform state serialization via temporary JSON files prevents shell quoting corruption and stdin-pipe hanging on Windows.

- **Circuit Breaker Resilience & Fallback Routing:**
  - `CircuitBreaker` wrapper safeguards against external judgment API latency, network partitioning, or outages (trips after configurable failure thresholds with automatic cooldown recovery).
  - Transition contracts support `fallback_target`: if a judgment adapter fails, is unavailable, or times out, the FSM transitions directly to a designated mitigation state (e.g. `BLOCKED` or `MANUAL_REVIEW`) and emits a `GUARD_FALLBACK_TRIGGERED` event.

- **Semantic Model Capability Tiers:**
  - Manifests (`skill.yaml`) now support per-state `model` capability tier declarations (`tier: fast | balanced | reasoning | decision`) with optional `preferred_provider` and `cost_budget`.
  - Injects a structured `<model_contract>` into prompt slices to allow orchestrators or parent agents to route state turns to optimal model architectures (e.g., Claude Haiku vs Sonnet vs Opus, Gemini Flash vs Pro, Codex/o3).
  - Full backward compatibility: all tier declarations and judgment blocks are completely optional.

- **Developer Experience & Scaffolding:**
  - Updated `skill-manager` with model capability tier selection and semantic judgment verification questions in RED phase discovery.
  - Added runnable interactive demo `pnpm --filter @reactive-skills/runtime demo:judgment`.

## [0.6.0] - 2026-09-20

- docs: add project context and architecture documentation files (18e2a78)
- docs: add Reactive Skills Architecture overview to AGENTS.md (f064203)
- chore(release): v0.5.4 - -- (9b4c347)
- fix(axi): isolate jobs and default bootloaders to AXI (8264acc)
- feat(site): refactor hero to tactical workbench and fix simulation controls (40c340e)

## [0.5.4] - 2026-09-20

- fix(axi): isolate jobs and default bootloaders to AXI (8264acc)
- feat(site): refactor hero to tactical workbench and fix simulation controls (40c340e)
- fix(site): update api-contract mermaid chart syntax (a71334b)
- fix(site): add fallback Mermaid generation from skill states and restore tdd-refactor statechart (5fddc7e)
- docs: add customer-facing Syncing Skills guide and cross-references (cb6214d)

## [0.5.3] - 2026-09-18

- chore(release): v0.5.2 - Fix global skill workspace resolution, handle stale state, and add reactive_reset MCP tool (966c130)
- fix(axi,runtime): resolve workspace correctly for global skills, handle stale state, and add reactive_reset MCP tool (c527380)
- chore(release): v0.5.1 - Fix check-docs invariant: follow AGENTS.md reference to repository-map.md (2790cf8)
- feat: add context scoping with per-state scope and delta tracking (028d383)
- chore: groom AGENTS.md into terse references (c6f17da)

## [0.5.2] - 2026-09-17

- fix(axi,runtime): resolve workspace correctly for global skills, handle stale state, and add reactive_reset MCP tool (c527380)
- chore(release): v0.5.1 - Fix check-docs invariant: follow AGENTS.md reference to repository-map.md (2790cf8)
- feat: add context scoping with per-state scope and delta tracking (028d383)
- chore: groom AGENTS.md into terse references (c6f17da)
- refactor(docs): reorganize documentation and move performance standards to context (947975e)

## [0.5.2] - 2026-09-17

- fix(axi,runtime): resolve workspace correctly for global skills, handle stale state, and add reactive_reset MCP tool (c527380)
- chore(release): v0.5.1 - Fix check-docs invariant: follow AGENTS.md reference to repository-map.md (2790cf8)
- feat: add context scoping with per-state scope and delta tracking (028d383)
- chore: groom AGENTS.md into terse references (c6f17da)
- refactor(docs): reorganize documentation and move performance standards to context (947975e)

## [0.4.5] - 2026-09-14

- feat(sync): add Windows NTFS Directory Junction linking and POSIX symlink engine for zero-drift live skill sync
- feat(sync): support multi-source authoring discovery via ~/.agents/sources.json and --all-sources flag
- feat(sync): add tilde (~) path expansion and intelligent current-working-directory fallback for third-party authors
- feat(sync): add --link, --copy, and repeatable --source / --target CLI flags

## [0.4.2] - 2026-09-14

- feat(runtime): add in-engine telemetry, template caching, and performance budget verification (7dfae37)
- feat(telemetry): record real-time transition_duration_ms, slice_duration_ms, and slice_tokens_est in STATE_TRANSITION events
- feat(fsm): L1 Handlebars compiled template delegate cache for sub-millisecond prompt slicing
- feat(alarms): emit PERF_DEGRADATION event on slice (>10ms) or transition (>25ms) threshold breaches
- test(perf): add automated Vitest test suite enforcing P0 (<5ms) and P1 (<25ms) latency budgets

## [0.4.1] - 2026-09-14

- feat(runtime,axi): add mcp job tools, template jobId context, and flexible jobs cli arguments (2b31451)
- feat(mcp): add reactive_switch_job and reactive_archive_job tools with active job indicators
- feat(projections): expose jobId directly in ProjectionContext for Handlebars templates
- feat(axi): support bidirectional argument ordering in jobs command (jobs list <skill> and jobs <skill> list)
- docs: introduce PERFORMANCE-STANDARDS.md for P0-P3 latency budgets, caching tiers, and CRAP score limits

## [0.4.0] - 2026-09-14

- feat(axi): implement native validate command for skill manifest and statechart verification (3b75a21)
- docs: add v0.3.0 release highlights to READMEs and bundle changelog in package files (732f72b)
- chore: release v0.3.0 (ae379ca)
- feat(core): implement job management, isolated run storage, dual-write projections, and AXI jobs suite (c76c6cb)
- chore: release v0.2.0 (bb33cfc)

## [0.3.0] - 2026-09-13

- feat(core): implement job management, isolated run storage, dual-write projections, and AXI jobs suite (c76c6cb)

## [2.0.0] - 2026-09-01

- feat: implement SQLite event store engine, state snapshotting, and JSONL log rotation with supporting documentation (6912493)
- feat: implement skill-scoped SQLite event storage and migration infrastructure (b28fb19)
- feat: implement core event-store with SQLite persistence, FSM engine, and projection tracking. (5926118)
- feat: implement reactive skill core with FSM engine, event-sourced SQLite storage, and Zod-validated manifest schemas (b542c0a)
- feat: add CLI tool for reactive skill management, project documentation, and state inspection workflows (39830d0)

## [1.0.3] - 2026-08-31

- refactor(core): migrate to clean semantic state filenames and convention-over-configuration resolution (8180b1b)
- feat(hitl): add pre-implementation collaboration gate with 3 interaction modes (direct build, brainstorm, plan review) (0cd22b7)
- fix(core): resolve P2 memory leak - add bounded in-memory sliding buffer with SQLite backing (7fefae5)
- fix(core): resolve all Principal Engineer review findings - state rehydration, lifecycle signal queue, VM sandbox, and dual-write durability (791753e)
- feat(mcp): add reactive_migrate tool to MCP server suite (e35779c)

## [1.0.2] - 2026-08-31

- chore(release): add automated multi-file semver bumping script and changelog generator (d0f9abd)
- feat(docs): add automated doc invariant checker script and synchronize all project docs (280a95d)
- feat(core): upgrade to v2 with Event Modeling 4-slice CQRS, statechart topology validation, and retroactive migration (c9801ed)
- docs: clarify workspace layout, file destination paths, and greenfield/brownfield execution (1c79455)
- docs: add Model Context Protocol (MCP) server documentation to README, architecture, and AGENTS (f2e638b)
# Changelog

## [1.0.1] - 2026-08-31

- feat(docs): add automated doc invariant checker script and synchronize all project docs (280a95d)
- feat(core): upgrade to v2 with Event Modeling 4-slice CQRS, statechart topology validation, and retroactive migration (c9801ed)
- docs: clarify workspace layout, file destination paths, and greenfield/brownfield execution (1c79455)
- docs: add Model Context Protocol (MCP) server documentation to README, architecture, and AGENTS (f2e638b)
- feat(mcp): build universal reactive-mcp-server with 6 tools and live resources (9a01807)

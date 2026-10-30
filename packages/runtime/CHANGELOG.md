
## [Unreleased]

### Breaking changes

- **Workspace-relative MCP receipt paths:** Receipt `projectionsWritten` entries from `reactive_emit_signal` and `reactive_respond_human` are now paths relative to the MCP server's workspace (the `workspace` that `reactive_capabilities` reports), for example `.docs/jobs/default/summary.md`, instead of absolute paths. Resolve them against that workspace, or pass `receipt_paths: "absolute"` to keep absolute paths; that option remains for one release. Saved receipts in the ledger keep absolute paths, so a keyed retry returns the form the retry requests. Capability: `receipt.relative_paths`. A path outside the workspace stays absolute.

| Tool | Option | Default | Other values |
|---|---|---|---|
| `reactive_emit_signal`, `reactive_respond_human` | `receipt_paths` | `relative` | `absolute` (previous receipt paths, one release) |

### New features

- **Runtime-executed states (experimental):** A manifest that requires the new `state.runtime_actions` capability can declare `runtime_action` on a leaf state: a command with literal arguments and a timeout, a workspace path check, a JSON Schema subset check of a recorded value, or a pure expression over context, with declared success and failure transitions. The runtime runs it without a model turn, records `RUNTIME_ACTION_STARTED` and `RUNTIME_ACTION_COMPLETED` evidence, and dispatches the outcome signal through ordinary signal handling. Pending actions resume from the ledger before a view is delivered; a recorded result is reused, and an action interrupted after it started runs again. `reactive-skills-axi vet` reports declared commands as `guard/runtime-command`. The shape may change; see [docs/runtime-actions.md](docs/runtime-actions.md) for the rules and the measured prototype.

### Changes

- **Shorter bootloader:** Two pairs of overlapping bootloader sentences are merged (the AXI `--output compact-v1` guidance, and the note that `npx` only launches AXI). No instruction was removed.

## [0.21.0] - 2026-10-30

- This 0.x minor release includes breaking changes; see the [release notes and upgrade checklist](https://github.com/Reactive-Skills/reactive-skills/blob/main/docs/releases/v0.21.0.md).

### Breaking changes

- **Lean MCP defaults:** `reactive_emit_signal` and `reactive_respond_human` now return the continuation envelope `{receipt, replayed, result_view, view}` with a `delta-v1` view when `return_view` is omitted, and `reactive_state` and active-state `reactive_context_prepare` return the complete `compact-v1` view when `output` is omitted. Read receipt fields under `receipt`, or pass `return_view: "none"` and `output: "legacy"` to keep the previous shapes; both legacy options remain for one release. In strict mode the default emit and human response now count their returned view as the state delivery, as opted-in continuation already did; pass `return_view: "none"` to keep the previous accounting.

| Tool | Option | Default | Other values |
|---|---|---|---|
| `reactive_emit_signal`, `reactive_respond_human` | `return_view` | `delta-v1` | `compact-v1` (complete view, unchanged), `none` (legacy receipt, one release) |
| `reactive_emit_signal`, `reactive_respond_human` | `since_seq` | last view seq this session delivered for the run; complete view when there is none | any earlier view `seq` |
| `reactive_state` | `output` | `compact-v1` | `legacy` (`formattedXml`, `scopedContext`, `contextDelta`; one release) |
| `reactive_state` | `since_seq` | omitted: complete view | a view `seq`: `delta-v1` view |
| `reactive_context_prepare` | `output` | `compact-v1` | `legacy` (one release) |

### New features

- **Ledger-anchored delta views:** A `delta-v1` view repeats the rendered instructions, tools and transition contracts, but sends only the scoped context the ledger committed after the anchored view sequence, or that the anchored view's scope did not expose. Values the triggering submission supplied are named in `context_accepted` instead of being echoed. The recovery policy is sent only in the complete view. Capability: `state.delta_v1`.
- **Complete views on resume:** `reactive_state` without `since_seq`, a retried or recovered submission, a new MCP session after a crash, and a job switch all receive the complete view rebuilt from the ledger. Omitted context can be fetched on request with `reactive_state` (`include_full_context: true`) or `reactive_query_events`.
- **Automatic evidence references:** Inline string values at manifest-declared text evidence fields of at least 300 UTF-8 bytes are registered and submitted as evidence references by MCP and AXI emit, with the same committed payload as an explicit path binding. The default comes from a matched measurement; `REACTIVE_AUTO_EVIDENCE_MIN_BYTES` overrides it or turns it off with `off`.
- **Shorter MCP tool descriptions:** `tools/list` descriptions are shorter; tool names and input schemas are unchanged.

## [0.20.0] - 2026-10-29

- This 0.x minor release includes breaking changes; see the [release notes and upgrade checklist](https://github.com/Reactive-Skills/reactive-skills/blob/main/docs/releases/v0.20.0.md).

### Breaking changes

- **AXI is CLI-only:** The AXI package no longer declares `main: "dist/index.js"` or `types: "dist/index.d.ts"`, which pointed to files it did not build or pack; use its `reactive-skills-axi` / `axi` commands for CLI and MCP startup, and migrate programmatic integrations to the `@reactive-skills/runtime` SDK rather than importing an AXI root library entry.
- **Default MCP state delivery:** External MCP clients reading `reactive_state` must migrate from `{promptSlice, formattedXml, context, scopedContext, ...}` to `{formattedXml, scopedContext, ...}`; read the prompt from `formattedXml` and pass `include_full_context: true` only when the full recorded `context` is needed, which restores `context` but never `promptSlice` ([change](https://github.com/Reactive-Skills/reactive-skills/pull/99)).
- **Context preparation clients:** The active-state result inside `reactive_context_prepare.context` uses the same compact legacy response and removes `promptSlice`; consume its `formattedXml` and `scopedContext`, or explicitly fetch `reactive_state` with `include_full_context: true` if unscoped recorded context is required ([change](https://github.com/Reactive-Skills/reactive-skills/pull/99)).
- **Negotiated compact state format:** Clients selecting `output: "compact-v1"` in MCP or `--output compact-v1` in AXI must map legacy `activeState` / `formattedXml` / `scopedContext` / `allowedTools` to `state` / `prompt` / `context` / `tools`, and consume `format`, `run_id`, `seq`, ordered `contracts`, `policy` and conditional gate/refusal/model/strict metadata; check `state.compact_v1` before opting in, omit the output option to retain each transport's legacy format, and note that MCP `include_full_context: true` replaces compact `context` with the full recorded context rather than adding a second context field ([change](https://github.com/Reactive-Skills/reactive-skills/pull/106)).
- **Strict state-fetch accounting:** MCP state/context-preparation and development CLI clients that relied on every repeat fetch counting as an idle turn now receive up to two uncounted repeat fetches of the same delivered view by default; set each applicable state's `max_view_refetches: 0` to retain counting on every fetch, or configure an explicit allowance and update counter/event assertions to accept `STATE_VIEW_REFETCHED`, while AXI strict-turn accounting remains unchanged ([change](https://github.com/Reactive-Skills/reactive-skills/pull/106)).
- **Legacy ledger recovery:** Applications reopening ledgers written before accepted context patches were recorded can no longer reconstruct unrecorded hook assignments by rerunning the current manifest's `on_enter` / `on_exit` assignments during replay; recovery now applies recorded accepted updates only, so preserve the ledger and its latest valid snapshot before upgrading, verify recovered context on a copy, and start a new run with explicitly supplied context if a snapshotless old ledger lacks required hook values, since this release has no replay opt-out or automatic backfill for missing history ([change](https://github.com/Reactive-Skills/reactive-skills/pull/109)).
- **Opt-in MCP continuation envelope:** Consumers selecting `return_view: "compact-v1"` on `reactive_emit_signal` or `reactive_respond_human` receive `{receipt, replayed, result_view, view}` instead of a bare receipt; negotiate `state.continuation_v1`, move receipt reads under `receipt`, consume the complete current `view`, compare it with the original `result_view` anchor on retries, and omit `return_view` to retain legacy receipts ([change](https://github.com/Reactive-Skills/reactive-skills/pull/110)).
- **SDK keyed replay results:** Consumers of `FSMEngine.handleSignal` that validate exact result shapes must accept optional `replayed: true` on duplicate keyed submissions, with the field absent on fresh evaluations; treat that marker as an existing submission rather than new work, and let continuation clients handle `receipt.result_unavailable: true` with `result_view: null` when an original result was not saved instead of resubmitting under a new key ([change](https://github.com/Reactive-Skills/reactive-skills/pull/110)).
- **Authored payload contracts:** Skill authors adding `payload_contract` change compact transition guidance and legacy XML exit conditions from inline guard source to typed field requirements such as `exit_code:number=0` plus an `inspect guard` pointer, and structurally invalid payloads can refuse before the existing guard runs; require `state.payload_contracts`, supply the declared fields/types/constants, use targeted inspection for exact guard source, and omit `payload_contract` to retain inline conditions for expression guards, while opaque function guards now include inspection guidance ([change](https://github.com/Reactive-Skills/reactive-skills/pull/112)).
- **Targeted guard inspection:** MCP clients passing both `state` and `signal` to `reactive_inspect`, and AXI clients passing `inspect --state <owner> --signal <signal>`, receive one owning transition with optional `guard_source` instead of whole-skill output; update parsers to the targeted shape, provide both selectors together, or omit both to retain whole-skill inspection ([change](https://github.com/Reactive-Skills/reactive-skills/pull/112)).
- **Skill synchronization downgrade refusal:** Source-sync users replacing an installed skill with an older per-skill version must now deliberately pass `--allow-downgrade`; omit it to keep the downgrade refusal, and use `--ref` or a configured `ref` to select a specific source revision ([sync contract](https://github.com/Reactive-Skills/reactive-skills/blob/main/README.md)).

### New features

- **Complete state views and continuation:** Shared SDK/MCP/AXI views retain the rendered prompt, current scoped context, ordered leaf-to-ancestor contracts and active gates, with refetch guidance for resume and transcript compaction; [continuation responses](https://github.com/Reactive-Skills/reactive-skills/blob/main/docs/mcp-continuation.md) include the settled view after lifecycle signals, child invocation and projections, with keyed retry receipts that remain separate from the current view ([state views](https://github.com/Reactive-Skills/reactive-skills/pull/106), [MCP continuation](https://github.com/Reactive-Skills/reactive-skills/pull/110)).
- **Immutable local evidence:** The SDK registry stores run-scoped verified evidence, with explicit AXI/MCP import and read tools and optional reference submission through declared payload fields; negotiate `evidence.local_registry` / `evidence.reference_submission`, retain artifacts with replayable ledgers and snapshots, and keep existing inline payloads when references are unnecessary ([registry](https://github.com/Reactive-Skills/reactive-skills/pull/102), [AXI/MCP tools](https://github.com/Reactive-Skills/reactive-skills/pull/108)).
- **Judgment deadlines:** Opt into `total_timeout_ms` and `judgment.total_deadline` to bound asynchronous selection and the fallback cascade, with optional `retry_policy.max_attempts_per_adapter`, cooperative cancellation and per-attempt accounting; omitting the deadline retains legacy cascade behavior, and custom adapters must observe cancellation to stop their own external work ([change](https://github.com/Reactive-Skills/reactive-skills/pull/103)).
- **Judgment input selection:** Opt into `payload_paths`, `required_context_paths` and declarative payload preconditions with required capability `judgment.payload_selection`, inspect selected input without contacting an adapter, and refuse missing or invalid required evidence locally before judgment; legacy judgments retain their input and evaluation order ([change](https://github.com/Reactive-Skills/reactive-skills/pull/107)).
- **Payload guidance and inspection:** Optional typed fields, primitive constants, relationships, evidence-source guidance and refusal hints assist payload construction, while SDK/MCP/AXI targeted inspection reads the exact owning transition and contained module source without opening a run or executing guard code; structural checks supplement the existing guards and do not prove arbitrary guard equivalence ([change](https://github.com/Reactive-Skills/reactive-skills/pull/112)).
- **Other changes since v0.19.0:** Source synchronization supports git refs and provenance, setup pins generated MCP entries to the installed scoped AXI package version, and the site includes revised onboarding, a run-tape landing page, registry presentation and Mods documentation.

### Fixes

- **Accepted-context replay:** Initialization and transition events record effective ordered context patches, so new ledgers recover accepted lifecycle and signal assignments without reexecuting hooks, including when snapshot persistence was interrupted; refused and unhandled candidate updates do not become accepted context ([change](https://github.com/Reactive-Skills/reactive-skills/pull/109)).
- **Bounded AXI receipt reads:** State, invoke and emit use run-scoped indexed causation lookups, retain explicit event-ID/history access, and guide compact clients to consume returned views and refetch for recovery ([change](https://github.com/Reactive-Skills/reactive-skills/pull/111)).
- **Concurrent ledger mirroring and retries:** JSONL projection locking preserves an incompletely written owner record, and competing keyed signal submissions reuse the committed submission without a second guard evaluation or transition ([change](https://github.com/Reactive-Skills/reactive-skills/pull/110)).

### Performance notes

- **Ledger writes and opens:** Appends mirror only new canonical SQLite events to JSONL, while store opens verify persistent JSONL checkpoints rather than always performing full reconciliation; damaged or uncertified mirrors still require reconciliation, so cold verification, repair and explicit history reads remain separate costs ([append changes](https://github.com/Reactive-Skills/reactive-skills/pull/101), [open verification](https://github.com/Reactive-Skills/reactive-skills/pull/105)).
- **Honest latency accounting:** `transition_total_ms` includes transition persistence, snapshotting and projections before queued lifecycle signals drain, and existing `transition_duration_ms` keeps its narrower meaning, while `JudgmentResult.latencyMs` now measures the entire cascade including unevaluable outcomes; update dashboards that treated those fields as interchangeable or assumed refused judgments cost zero ([transition timing](https://github.com/Reactive-Skills/reactive-skills/pull/101), [judgment timing](https://github.com/Reactive-Skills/reactive-skills/pull/103)).
- **Transport estimates:** Core `slice_tokens_est` uses UTF-8 XML bytes and MCP state delivery estimates the complete serialized response text at four UTF-8 bytes per token, including escaping and metadata; these are heuristics rather than tokenizer counts and exclude JSON-RPC framing and tool definitions ([change](https://github.com/Reactive-Skills/reactive-skills/pull/99)).
- **Offline measurement:** A pinned public fixture reports actual transport bytes, calls, ledger/artifact costs and cold AXI execution without external model calls; fixture results do not establish provider latency, token savings or general end-to-end savings, and moving a state prompt into a continuation still transmits its bytes ([fixture](https://github.com/Reactive-Skills/reactive-skills/pull/104)).
- **Payload-contract costs:** The short pinned TDD guard limits initial byte reduction and optional guard inspection adds request/response bytes, so authored contracts provide typed guidance without a universal savings claim; see the [measured scope and costs](https://github.com/Reactive-Skills/reactive-skills/blob/main/docs/payload-contracts.md#cost-measurement).

## [0.19.0] - 2026-10-06

- feat(axi): add `reactive-skills-axi vet <skill|dir>`, backed by a shared static rule set in the runtime for code, skill text, and supply chain; trust model documented in `docs/vetting.md` and `SECURITY.md` (#85, part of #33; the trust record and hardened mode remain open)
- feat(runtime): add the static vetting rule set and source collector exported from the runtime index (#85, part of #33)
- feat(axi): `validate` checks each `guardFunction` file's module format without importing it; runtime guard load failures name the file and the fix (#81, #10)
- fix(axi): `invoke` rejects a wrapped `contextUpdates` payload with the expected flat shape, and `invoke` and `emit` usage text documents each payload shape (#84, #44)
- fix(axi): every command prints usage for `--help` and `-h` without running (#74, #42)
- fix(axi): `jobs` and `reset` resolve runs by skill path, directory name, or manifest name; `reset --job` reports `NOT_FOUND` for an unknown run; the approve and reset hints print a reference the CLI can resolve (#75, #45, part of #65; the `decidedBy` on unevaluable results and replay after approval items remain open)
- feat(runtime): judgments accept `context_paths` and `include_payload` to scope what the Jev adapter sees; new `judgment.context_paths` capability; `GUARD_EVALUATED` records `contextSent` (#80, #24)
- fix(runtime): migrate legacy mixed stores and fail cleanly with `EVENT_STORE_OPEN_FAILED`, the store path, and a recovery command when a store cannot be opened (#82, #43)
- fix(site): canonical, sitemap, and robots URLs use https://reactive-skills.com (#71, refs #62; the deploy workflow change in the Pages repository is still needed)
- fix(site): make registry generator output identical across operating systems (#72, #57)
- fix(site): repair site lint, and fix the registry page title, unused blog index variable, and the cwd-dependent em dash test (#73, #54, #56, #59)
- fix(site): quickstart opens with a published skill and matches current CLI output; Node engine floor raised to 22.13.0 (#76, #61)
- fix(site): arrow-key, Home, and End navigation for the hero command tabs, and a long-form blog prose variant (#77, #55, #63)
- docs(site): add a skill trust note to the quickstart install step (#78, refs #33, #34)
- docs(roadmap): move #66 (unattended runs) out of R3b to unscheduled work (#83)

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

## [0.8.0] - 2026-09-21

### Features

- **Job Lifecycle Terminal Auto-Rotation (`isJobTerminal`, `rotateIfTerminal`):**
  - Querying `axi state <skill>` or `reactive_state` without an explicit `--job` on a completed run automatically archives the completed job and boots into a fresh isolated run (`INIT`) with a newly generated sortable ID.
  - Eliminates the dead-pointer trap where agents were halted with `Current job is terminal`.
  - Preserves historical inspection when `--job <completed-id>` is explicitly specified.

- **Environment-Scoped Job Isolation (`process.env.REACTIVE_JOB_ID`):**
  - Added support for `process.env.REACTIVE_JOB_ID` in `JobManager.getActiveJobId` and `args.ts`.
  - Parallel subagents and CI workers can run concurrent tasks on the same skill without mutating or colliding on the shared `.reactive/skills/<skill>/active_job` file.

- **Bootloader Contract Inversion:**
  - Universal reactive bootloader (`<!-- REACTIVE BOOTLOADER -->`) updated to promote `axi invoke <skill>` for starting new tasks and `axi state <skill>` for resuming active tasks.

- **CLI Flag Synonyms & Ergonomics:**
  - Added `--run` and `--run-id` as first-class synonyms for `--job` across `invoke`, `state`, `emit`, `events`, and `reset`.

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

### Breaking Changes

- **removed: `ReactiveRuntimeHooks` class** (`runtime-hooks.ts`) — The Claude Code-specific in-harness hook layer (`onBeforeAgentTurn`, `onAfterToolExecution`, `onHumanResponse`, `auditToolExecution`) has been removed. Reactive Skills is LLM-agnostic; the AXI CLI (`axi state` / `axi emit`) and MCP stdio paths are the canonical integration modes. Signal emission is explicit — agents read the `transition_contracts` in the prompt slice and call `axi emit <skill> <SIGNAL>` directly.
- Removed export `export * from './core/runtime-hooks.js'` from `@reactive-skills/runtime` public API.

### Migration

Replace any `ReactiveRuntimeHooks.onBeforeAgentTurn(engine)` usage with `axi state <skill>` (or `reactive_state` via MCP).  
Replace any `ReactiveRuntimeHooks.onAfterToolExecution(engine, { tool, result })` usage with explicit `axi emit <skill> <SIGNAL> '{"exit_code":0}'` calls driven by the transition contracts in the prompt slice.

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

## [0.5.1] - 2026-09-17

- feat: add context scoping with per-state scope and delta tracking (028d383)
- chore: groom AGENTS.md into terse references (c6f17da)
- refactor(docs): reorganize documentation and move performance standards to context (947975e)
- feat(site): automate changelog generation from runtime CHANGELOG.md and sync product-manager to registry (7e635ba)
- docs: update v0.4.5 hero banners and enforce release banner invariant in check-docs.js and AGENTS.md (b76cdae)

## [0.5.0] - 2026-09-17

- chore: groom AGENTS.md into terse references (c6f17da)
- refactor(docs): reorganize documentation and move performance standards to context (947975e)
- feat(site): automate changelog generation from runtime CHANGELOG.md and sync product-manager to registry (7e635ba)
- docs: update v0.4.5 hero banners and enforce release banner invariant in check-docs.js and AGENTS.md (b76cdae)
- chore(release): v0.4.5 - junction linking sync engine and multi-source resolution (59c1f3d)

## [0.4.5] - 2026-09-14

- feat(sync): add Windows NTFS Directory Junction linking and POSIX symlink engine for zero-drift live skill sync
- feat(sync): support multi-source authoring discovery via ~/.agents/sources.json and --all-sources flag
- feat(sync): add tilde (~) path expansion and intelligent current-working-directory fallback for third-party authors
- feat(sync): add --link, --copy, and repeatable --source / --target CLI flags
- test(sync): comprehensive 35-test unit suite covering junction linking, fallback copy, and multi-source discovery

## [0.4.4] - 2026-09-14

- fix(ci): calibrate perf budget for virtualized CI runners & automate GitHub Releases (e2dd853)
- chore(release): bump version to 0.4.3 (2f89b7d)
- feat(telemetry): embed standalone live web dashboard at GET / (4ffb3a9)
- docs: add comprehensive job management documentation across readmes (e1a626a)
- docs: add practical telemetry inspection and metrics querying guide (ef37fb6)

## [0.4.3] - 2026-09-14

- feat(telemetry): embed standalone live web dashboard at GET / (4ffb3a9)
- docs: add comprehensive job management documentation across readmes (e1a626a)
- docs: add practical telemetry inspection and metrics querying guide (ef37fb6)
- chore: release v0.4.2 (28c16b9)
- feat(runtime): add in-engine telemetry, template caching, and performance budget verification (7dfae37)

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

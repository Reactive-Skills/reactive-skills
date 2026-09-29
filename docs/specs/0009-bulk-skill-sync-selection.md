# Specification: Bulk Skill Sync Selection

Status: In Progress.

Target: `@reactive-skills/runtime` and `reactive-skills-axi`.

Scope: `docs/scope/bulk-skill-sync.md`.

Verification: `docs/specs/0009-bulk-skill-sync-selection.verify.md`.

ADR needed: No.

## 1. Intent

Allow one sync invocation to select several named skills with concise comma-separated `--skill` values or repeated `--skill` flags, then synchronize them to each configured or default target.

Retain the existing all-skills default, repeated-flag syntax, and AXI single-skill positional alias.

## 2. Current Behavior

`reactive-skills-axi sync` already synchronizes all discovered skills when no skill is selected.

The AXI command adapts one positional skill name to `--skill`.

The runtime parser and engine already support repeated `--skill` flags and multi-skill selection.

The parser currently treats each `--skill` value as one literal skill name, so a comma-separated value is not expanded into multiple selections.

The engine already filters synchronization to the requested names, validates unknown names before writes, and uses the complete discovered source set for orphan reporting.

A comma-separated `--skill` value currently reaches the engine as one literal name and therefore fails as unknown unless a source skill has that exact name.

## 3. Command Contract

1. `reactive-skills-axi sync` with no skill selector continues to synchronize all discovered skills.

2. `reactive-skills-axi sync <skill-name>` remains the backward-compatible single-skill form.

3. `reactive-skills-axi sync --skill <name>,<name>` selects each comma-separated skill in one invocation.

4. `reactive-skills-axi sync --skill <name> --skill <name>` remains supported.

5. Comma-separated and repeated values may be combined, for example `--skill alpha,beta --skill gamma`.

6. Whitespace around comma-separated names is trimmed; an empty name in a list is a usage error and exits nonzero before target operations.

7. The positional skill alias and one or more `--skill` flags are mutually exclusive.

8. Mixing the positional skill alias with `--skill` returns a validation error, exits nonzero, and stops before target operations begin.

9. A `--skill` flag without a following skill name returns a usage error, exits nonzero, and does not fall back to all-skills sync.

10. Any unknown selected name is included in the error report, exits nonzero, and prevents all target writes for that invocation.

11. Repeating a skill name does not cause duplicate sync results for that skill.

12. Runtime source and target positional arguments keep their existing meaning.

13. `--source`, `--target`, `--all-sources`, `--dry-run`, `--link`, `--copy`, `--no-backup`, and `--json` keep their existing behavior with selected skills.

14. `--source`, `--target`, and `--physical-target` accept comma-separated directory paths and repeated flags.

15. Whitespace around comma-separated directory paths is trimmed, and empty path entries return a usage error before filesystem writes.

16. Explicit `--source` values replace configured sources unless `--all-sources` is supplied; explicit `--target` values replace configured satellites.

17. `--physical-target` adds satellite directories that receive physical copies, while other selected satellites keep the configured link behavior.

18. `--central` accepts one directory path and overrides the configured central path for that invocation.

## 4. Selection and Validation

The parser collects every value supplied to `--skill`, splits each value on commas, trims surrounding whitespace from each name, and combines the resulting names.

Any empty name produced by a missing value or comma-separated list is a usage error; the command must not interpret it as an unfiltered all-skills request.

The source of selectable names is the set of skill directory names returned by the existing discovery rules across the selected source directories.

An existing discovered directory remains a selected skill even when it lacks both `SKILL.md` and `skill.yaml`; it retains the existing `skipped_invalid` result.

A requested name absent from the discovered source names is unknown.

If any requested name is unknown, return a report that identifies each unknown name before creating or changing any target directory, and set the CLI exit status to nonzero.

Unknown-name validation applies to the full requested set, so one unknown name prevents partial synchronization of the known names in that request.

Duplicate requested names collapse to one selected skill.

When the same skill name exists in multiple source directories, retain the existing first-source-wins behavior.

### Directory List Parsing

Each `--source`, `--target`, and `--physical-target` value may contain comma-separated directory paths.

Repeated flags append paths in the order supplied.

Trim whitespace around each path and reject any empty member before creating or changing filesystem paths.

`--source` values replace the configured source list unless `--all-sources` is present.

`--target` values replace the configured satellite list.

`--physical-target` adds directories to the physical-copy satellite list.

`--central` remains a single path value and overrides only the central directory for that invocation.

## 5. Orphan Reporting

The selected skill set controls which skills are synchronized.

The complete discovered source-name set across all selected source directories controls whether destination entries are orphans.

Selecting a subset must not cause unselected source skills to appear as destination orphans.

## 6. Result and Failure Behavior

The combined sync report retains the existing per-skill and per-target outcome entries.

When a backup is created, its separate `backed_up` entry remains before the final `mirrored` or `linked` result.

The `skillsFound`, `skillsValid`, and `skillsInvalid` counts describe the selected skill set.

Existing best-effort handling for operational per-skill or per-target failures remains in effect.

An unknown-name error is a preflight failure and produces no target results or writes.

Missing `--skill` values are usage failures and return nonzero status without running the sync engine.

Unknown selections and missing `--skill` values return nonzero CLI status while preserving human-readable errors or JSON report output.

Other operational per-skill or per-target errors keep their existing best-effort exit behavior.

The command does not add rollback across separate skills or targets.

## 7. Acceptance Criteria

1. `--skill alpha,beta` selects both requested discovered skills, with each skill synchronized once per target.

2. Repeated flags and mixed comma-separated/repeated values select every requested discovered skill once per target.

3. The no-selector form still selects all discovered skills.

4. The AXI positional single-skill form still selects the named skill.

5. Whitespace surrounding CSV names is ignored, and empty CSV members fail with nonzero status before target operations.

6. A positional skill selector combined with `--skill` returns a validation error and exits nonzero before target operations.

7. Any unknown requested name is reported before target directories are created or changed, known requested names are not partially synchronized, and the CLI exits nonzero.

8. A missing `--skill` value exits nonzero and never falls back to all-skills sync.

9. A discovered but invalid skill continues to produce the existing invalid-skill result rather than being treated as unknown.

10. A filtered run does not report unselected source skills as destination orphans.

11. Dry-run, link mode, copy mode, source selection, target selection, backups, and JSON reporting remain compatible with CSV, repeated, and mixed selectors.

12. Runtime parser and engine tests cover CSV expansion, whitespace trimming, empty-member rejection, batch selection, de-duplication, unknown-name preflight, orphan reporting, and existing all and single selection behavior.

13. Runtime and AXI CLI tests verify nonzero status for unknown, empty, and missing selections while retaining useful error or JSON output.

14. AXI tests cover CSV and repeated flags, mixed-selector rejection, and the positional compatibility form.

15. Runtime help and customer documentation show the CSV and repeated `--skill` syntax and explain selector compatibility.

16. Runtime and customer documentation show comma-separated and repeated `--source`, `--target`, and `--physical-target` paths.

17. Tests cover path whitespace trimming, repeated path options, and empty path-member rejection before writes.

18. Customer documentation explains the configured `central` path and the one-run `--central` override.

19. The workspace build, required runtime suite, and AXI suite pass.

## 8. Non-Requirements

Do not add a separate `--all` flag because the no-selector behavior already synchronizes all discovered skills.

Do not interpret multiple free-form positionals as multiple skill names.

Do not change per-skill atomic copy behavior or add cross-skill rollback.

Do not change skill registry release or versioning behavior.

## 9. Ordered Build Plan

1. Extend `packages/runtime/src/sync/cli.ts` to split comma-separated skill names and source, target, and physical-target paths, trim values, and reject missing or empty entries.

2. Add runtime CLI tests for CSV, repeated, mixed, whitespace, empty-member, and existing missing-value behavior.

3. Update runtime help in `packages/runtime/src/sync/cli.ts`, AXI usage help in `apps/axi/src/cli/index.ts`, examples in `apps/axi/README.md`, and this specification's verification notes.

4. Run the documented build and test commands, then perform independent review and documentation checks.

## 10. Value Sources

Requested skill names come from comma-separated or repeated CLI `--skill` values or the legacy AXI positional alias.

Available skill names and validity come from `discoverSkills` in `packages/runtime/src/sync/engine.ts` using the selected source directories.

Source directories come from comma-separated or repeated `--source` flags, `--all-sources`, source configuration, and default resolution in `packages/runtime/src/sync/cli.ts`.

Linked satellite directories come from comma-separated or repeated `--target` flags, configured satellites, or the existing `defaultTargets` function.

Physical-copy satellite directories come from comma-separated or repeated `--physical-target` flags and the configured `physicalSatellites` list.

Per-skill and per-target outcomes come from the existing `SyncReport` structure in `packages/runtime/src/sync/types.ts`.

CLI syntax and legacy positional behavior come from `apps/axi/src/commands/sync.ts` and `apps/axi/README.md`; CSV values are split in the runtime parser.

## 11. Design Decisions

### Skill Selector

Decision: add concise comma-separated values such as `--skill alpha,beta`, while retaining repeatable `--skill <name>` flags and the existing one-name AXI positional alias. This follows the user's stated preference to avoid extra typing for consumers.

Runner-up: require one repeated `--skill` flag per name, which is more verbose for consumers.

Split each flag value on commas, trim surrounding whitespace, and reject empty members to avoid silently changing the requested selection.

Do not accept multiple positional skill names because runtime positionals already identify source and target directories.

Keep the existing one-name AXI positional alias and reject using it with explicit `--skill` flags.

### Path Lists

Decision: accept comma-separated and repeated `--source`, `--target`, and `--physical-target` values to reduce typing while preserving path order.

Trim whitespace around each path and reject empty members before filesystem writes.

Keep `--central` as a single path because it identifies one physical registry directory.

### Unknown Names

Decision: reject the complete selection before target writes when any requested name is unknown, as confirmed by the user.

Runner-up: synchronize known names and report unknown names, which can leave a requested batch only partly applied.

### Orphan Reporting

Use every discovered source name for orphan comparison, even when synchronization is filtered to a subset.

This preserves the meaning of an orphan as a destination entry with no corresponding source skill.

### Architecture Record

Use this feature specification as the decision record.

A separate ADR is unnecessary because this CLI syntax change adds no new architecture, dependency, or persistent data model.

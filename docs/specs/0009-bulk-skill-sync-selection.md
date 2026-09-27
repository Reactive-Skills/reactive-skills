# Specification: Bulk Skill Sync Selection

Status: Implemented.

Target: `@reactive-skills/runtime` and `reactive-skills-axi`.

Scope: `docs/scope/bulk-skill-sync.md`.

Verification: `docs/specs/0009-bulk-skill-sync-selection.verify.md`.

ADR needed: No.

## 1. Intent

Allow one sync invocation to select several named skills and synchronize them to each configured or default target.

Retain the existing all-skills default and the AXI single-skill positional alias.

## 2. Current Behavior

`reactive-skills-axi sync` already synchronizes all discovered skills when no skill is selected.

The AXI command adapts one positional skill name to `--skill`.

The runtime parser stores only one `targetSkill`, so repeated `--skill` flags overwrite prior selections.

The engine filters source discovery to that one name.

Filtered discovery also limits the source names used for orphan reporting, which can incorrectly report unselected source skills as destination orphans.

An unknown skill selection currently produces no selected entries and does not clearly identify the invalid name.

## 3. Command Contract

1. `reactive-skills-axi sync` with no skill selector continues to synchronize all discovered skills.

2. `reactive-skills-axi sync <skill-name>` remains the backward-compatible single-skill form.

3. `reactive-skills-axi sync --skill <name> --skill <name>` selects each named skill in one invocation.

4. The positional skill alias and one or more `--skill` flags are mutually exclusive.

5. Mixing the positional skill alias with `--skill` returns a validation error, exits nonzero, and stops before target operations begin.

6. A `--skill` flag without a following skill name returns a usage error, exits nonzero, and does not fall back to all-skills sync.

7. Any unknown selected name is included in the error report, exits nonzero, and prevents all target writes for that invocation.

8. Repeating the same `--skill` name does not cause duplicate sync results for that skill.

9. Runtime source and target positional arguments keep their existing meaning.

10. `--source`, `--target`, `--all-sources`, `--dry-run`, `--link`, `--copy`, `--no-backup`, and `--json` keep their existing behavior with selected skills.

## 4. Selection and Validation

The parser collects every value supplied to a repeated `--skill` flag.

The source of selectable names is the set of skill directory names returned by the existing discovery rules across the selected source directories.

An existing discovered directory remains a selected skill even when it lacks both `SKILL.md` and `skill.yaml`; it retains the existing `skipped_invalid` result.

A requested name absent from the discovered source names is unknown.

If any requested name is unknown, return a report that identifies each unknown name before creating or changing any target directory, and set the CLI exit status to nonzero.

Unknown-name validation applies to the full requested set, so one unknown name prevents partial synchronization of the known names in that request.

Duplicate requested names collapse to one selected skill.

When the same skill name exists in multiple source directories, retain the existing first-source-wins behavior.

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

1. Repeated `--skill` flags select every requested discovered skill, with each skill synchronized once per target even when its flag repeats.

2. The no-selector form still selects all discovered skills.

3. The AXI positional single-skill form still selects the named skill.

4. A positional skill selector combined with `--skill` returns a validation error and exits nonzero before target operations.

5. Any unknown requested name is reported before target directories are created or changed, known requested names are not partially synchronized, and the CLI exits nonzero.

6. A missing `--skill` value exits nonzero and never falls back to all-skills sync.

7. A discovered but invalid skill continues to produce the existing invalid-skill result rather than being treated as unknown.

8. A filtered run does not report unselected source skills as destination orphans.

9. Dry-run, link mode, copy mode, source selection, target selection, backups, and JSON reporting remain compatible with repeated skill selection.

10. Runtime parser and engine tests cover batch selection, de-duplication, unknown-name preflight, orphan reporting, and existing all and single selection behavior.

11. Runtime and AXI CLI tests verify nonzero status for unknown and missing selections while retaining useful error or JSON output.

12. AXI tests cover repeated flags, mixed-selector rejection, and the positional compatibility form.

13. Runtime help and AXI documentation show the repeated `--skill` syntax and explain selector compatibility.

14. The workspace build, required runtime suite, and AXI suite pass.

## 8. Non-Requirements

Do not add a separate `--all` flag because the no-selector behavior already synchronizes all discovered skills.

Do not interpret multiple free-form positionals as multiple skill names.

Do not change per-skill atomic copy behavior or add cross-skill rollback.

Do not change skill registry release or versioning behavior.

## 9. Ordered Build Plan

1. Extend `packages/runtime/src/sync/cli.ts` and `packages/runtime/src/sync/types.ts` to collect repeated skill names and reject a missing `--skill` value.

2. Refactor `packages/runtime/src/sync/engine.ts` so discovery retains the full available-name set while synchronization uses only the requested skills.

3. Validate the full selection before target directory creation, then return a clear report and nonzero CLI status for unknown names.

4. Calculate destination orphans against all discovered source names.

5. Update `apps/axi/src/commands/sync.ts` to preserve the legacy positional alias, pass repeated flags through, and reject mixed selectors.

6. Add runtime tests in `packages/runtime/tests/sync/cli.test.ts` and `packages/runtime/tests/sync/engine.test.ts`, plus AXI tests in `apps/axi/tests/commands/sync.test.ts`.

7. Update runtime help in `packages/runtime/src/sync/cli.ts`, AXI usage help in `apps/axi/src/cli/index.ts`, and examples in `apps/axi/README.md`.

8. Propagate usage and selection failures through the runtime and AXI executable exit status while preserving report output.

9. Run the documented build and test commands, then perform independent review and documentation checks.

## 10. Value Sources

Requested skill names come from the repeated CLI `--skill` values or the legacy AXI positional alias.

Available skill names and validity come from `discoverSkills` in `packages/runtime/src/sync/engine.ts` using the selected source directories.

Source directories come from the existing `--source`, `--all-sources`, source configuration, and default resolution in `packages/runtime/src/sync/cli.ts`.

Target directories come from repeated `--target` flags or the existing `defaultTargets` function.

Per-skill and per-target outcomes come from the existing `SyncReport` structure in `packages/runtime/src/sync/types.ts`.

CLI syntax and legacy positional behavior come from `apps/axi/src/commands/sync.ts` and `apps/axi/README.md`.

## 11. Design Decisions

### Skill Selector

Decision: use repeatable `--skill <name>` flags, as confirmed by the user.

Runner-up: a comma-separated `--skills` value, which is less composable with normal command-line parsing and shell usage.

Do not accept multiple positional skill names because runtime positionals already identify source and target directories.

Keep the existing one-name AXI positional alias and reject using it with explicit `--skill` flags.

### Unknown Names

Decision: reject the complete selection before target writes when any requested name is unknown, as confirmed by the user.

Runner-up: synchronize known names and report unknown names, which can leave a requested batch only partly applied.

### Orphan Reporting

Use every discovered source name for orphan comparison, even when synchronization is filtered to a subset.

This preserves the meaning of an orphan as a destination entry with no corresponding source skill.

### Architecture Record

Use this feature specification as the decision record.

A separate ADR is unnecessary because this change adds no new architecture, dependency, or persistent data model.

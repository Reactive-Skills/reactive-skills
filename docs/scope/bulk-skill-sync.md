# Bulk Skill Sync Selection

Status: Implemented and verified for release candidate.

## Intent

Allow one `reactive-skills-axi sync` invocation to select and synchronize several named skills across the configured or default targets.
Preserve the existing no-argument behavior, which synchronizes all discovered skills, and the existing single-skill positional form.

## Done When

- `--skill alpha,beta` selects each requested skill once, and repeated flags remain supported.
- Combined repeated and comma-separated selectors work in one invocation; whitespace around comma-separated names is ignored.
- Empty comma-separated entries and unknown requested skill names fail before target directories are changed.
- `--source`, `--target`, and `--physical-target` accept comma-separated paths and repeated flags.
- Whitespace around comma-separated paths is ignored, and empty entries fail before filesystem writes.
- An unknown requested skill name is reported before target directories are changed.
- Unknown names and missing `--skill` values exit nonzero while retaining useful error or JSON output.
- Filtered sync reports do not classify unselected source skills as destination orphans.
- Existing no-argument all-skills sync and single-skill positional sync continue to work.
- Dry-run, link or copy mode, source selection, target selection, and backups continue to work with CSV and repeated skill selection.
- Runtime and AXI tests cover selection, compatibility, error handling, and reporting.
- CLI help and customer documentation show comma-separated and repeated skill and path syntax.
- Customer documentation explains the configured and one-run central directory options.

## Ordered Work

1. Confirm the selected-skill command contract and compatibility behavior.
2. Extend the runtime parser to split comma-separated skill names and directory paths, trim whitespace, reject empty entries, and preserve repeated flags.
3. Add runtime tests for comma-separated, mixed, and invalid values while retaining existing engine and CLI behavior.
4. Update runtime help, AXI command help, customer READMEs, and the sync specification and verification notes.
5. Run the required build and test commands, then complete independent review and documentation checks.

## Constraints

- Support concise `--skill alpha,beta` selection and retain repeatable `--skill <name>` flags.
- Trim whitespace around comma-separated names and reject empty entries such as `alpha,,beta`.
- Trim whitespace around comma-separated paths and reject empty entries such as `--target one,,two`.
- Keep `sync` with no skill filter as the all-skills operation.
- Keep `sync <skill-name>` as the backward-compatible single-skill form.
- Do not reinterpret multiple free-form positional tokens, since the runtime reserves positional arguments for source and target paths.
- Keep per-skill and per-target results in one combined sync report.
- Keep `--central` as a single path override and retain the config-file `central` setting for persistent changes.
- Do not add a bulk rollback across independent skill and target operations.

## Delivery

- Delivery approach: Vertical Slice.
- Workflow tier: GA.

# Bulk Skill Sync Selection

Status: Complete.

## Intent

Allow one `reactive-skills-axi sync` invocation to select and synchronize several named skills across the configured or default targets.
Preserve the existing no-argument behavior, which synchronizes all discovered skills, and the existing single-skill positional form.

## Done When

- Repeated `--skill` flags select each requested skill once and synchronize each selected skill to every configured target.
- An unknown requested skill name is reported before target directories are changed.
- Unknown names and missing `--skill` values exit nonzero while retaining useful error or JSON output.
- Filtered sync reports do not classify unselected source skills as destination orphans.
- Existing no-argument all-skills sync and single-skill positional sync continue to work.
- Dry-run, link or copy mode, source selection, target selection, and backups continue to work with repeated skill selection.
- Runtime and AXI tests cover selection, compatibility, error handling, and reporting.
- CLI help and the AXI README show the repeated `--skill` syntax.

## Ordered Work

1. Confirm the selected-skill command contract and compatibility behavior.
2. Extend the runtime sync parser and options to collect repeated skill names.
3. Update the sync engine to select the requested set, deduplicate names, reject unknown selections before writes, and preserve accurate orphan reporting.
4. Propagate missing-value and unknown-selection failures to nonzero runtime and AXI CLI exit statuses without losing report output.
5. Update the AXI adapter so repeated `--skill` flags reach the runtime while the existing positional single-skill alias remains supported.
6. Add runtime parser and engine tests, plus AXI adapter tests for batch, legacy, and rejected selections.
7. Update runtime help, AXI command help, and the AXI README examples.
8. Run the required build and test commands, then complete independent review and documentation checks.

## Constraints

- Use repeatable `--skill <name>` flags for explicit multi-skill selection.
- Keep `sync` with no skill filter as the all-skills operation.
- Keep `sync <skill-name>` as the backward-compatible single-skill form.
- Do not reinterpret multiple free-form positional tokens, since the runtime reserves positional arguments for source and target paths.
- Keep per-skill and per-target results in one combined sync report.
- Do not add a bulk rollback across independent skill and target operations.

## Delivery

- Delivery approach: Vertical Slice.
- Workflow tier: GA.

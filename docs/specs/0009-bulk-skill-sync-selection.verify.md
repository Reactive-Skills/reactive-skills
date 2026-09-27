# Manual Verification: Bulk Skill Sync Selection

Use an isolated source directory containing valid `alpha`, `beta`, and `gamma` skills, plus a separate empty target directory.

Run all commands with the built `reactive-skills-axi` executable or the workspace CLI equivalent.

## Batch Selection

Run `reactive-skills-axi sync --source <source> --target <target> --skill alpha --skill beta --json`.

Confirm the process exits with status `0`.

Confirm the report contains `alpha` and `beta` results and no `gamma` result.

Repeat `--skill alpha` twice and confirm `alpha` is synchronized once per target.

## Unknown Selection Preflight

Use a target path that does not yet exist.

Run `reactive-skills-axi sync --source <source> --target <target> --skill alpha --skill missing --json`.

Confirm the process exits with a nonzero status.

Confirm the JSON report identifies `missing` and has no synchronization results.

Confirm the target path remains absent.

## Missing Selector Value

Use a target path that does not yet exist.

Run `reactive-skills-axi sync --source <source> --target <target> --skill --json`.

Confirm the process exits with a nonzero status and reports that `--skill` requires a skill name.

Confirm no all-skills synchronization occurs and the target path remains absent.

## Mixed Selectors and Compatibility

Run `reactive-skills-axi sync alpha --skill beta`.

Confirm the process exits with a nonzero validation status before changing the target.

Run `reactive-skills-axi sync alpha --source <source> --target <target>`.

Confirm the legacy positional form synchronizes only `alpha`.

Run `reactive-skills-axi sync --source <source> --target <target>`.

Confirm the no-selector form synchronizes all discovered skills.

## Orphan Reporting

Create a destination entry named `gamma` that corresponds to a discovered source skill.

Run a filtered sync that selects only `alpha`.

Confirm `gamma` is not reported as an orphan.

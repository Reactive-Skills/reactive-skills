# Manual Verification: Bulk Skill Sync Selection

Use an isolated source directory containing valid `alpha`, `beta`, and `gamma` skills, plus a separate empty target directory.

Run all commands with the built `reactive-skills-axi` executable or the workspace CLI equivalent.

## Batch Selection

Run `reactive-skills-axi sync --source <source> --target <target> --skill alpha,beta --json`.

Confirm the process exits with status `0`.

Confirm the report contains `alpha` and `beta` results and no `gamma` result.

Run `reactive-skills-axi sync --source <source> --target <target> --skill "alpha, beta" --skill gamma --json`.

Confirm the report contains `alpha`, `beta`, and `gamma` results and no other skills.

Run the same command with repeated flags: `--skill alpha --skill beta`.

Confirm the existing repeated-flag syntax still works.

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

Run with an empty member, for example `--skill alpha,,beta`.

Confirm the command exits nonzero with an empty-name error and the target path remains absent.

## Mixed Selectors and Compatibility

Run `reactive-skills-axi sync alpha --skill beta`.

Confirm the process exits with a nonzero validation status before changing the target.

Run `reactive-skills-axi sync alpha --source <source> --target <target>`.

Confirm the legacy positional form synchronizes only `alpha`.

Run `reactive-skills-axi sync --source <source> --target <target>`.

Confirm the no-selector form synchronizes all discovered skills.

## Directory Lists and Help

Run `reactive-skills-axi sync --help`.

Confirm help shows comma-separated and repeatable `--source`, `--target`, and `--physical-target` options, the `--central` option, and examples using them.

Use isolated source, target, and config paths for the remaining checks.

Run `reactive-skills-axi sync --config <config> --source "<source>, <source-two>" --source <source-three> --target "<target>, <target-two>" --physical-target "<physical>, <physical-two>" --physical-target <physical-three> --show-config`.

Confirm the JSON output lists all source paths in order, lists both target paths as satellites, and lists both physical paths as physical satellites.

Run `reactive-skills-axi sync --config <config> --central <new-central> --show-config`.

Confirm the JSON output uses `<new-central>` and that the config file is unchanged.

Run `reactive-skills-axi sync --config <config> --source "<source>,," --target <target> --dry-run`.

Confirm the command exits nonzero with an empty-path error and creates or changes no source, central, or target directory.

## Orphan Reporting

Create a destination entry named `gamma` that corresponds to a discovered source skill.

Run a filtered sync that selects only `alpha`.

Confirm `gamma` is not reported as an orphan.

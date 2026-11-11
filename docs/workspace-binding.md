# AXI workspace binding

Bind the workspace when an agent starts a skill, especially when the skill is globally installed and the project is below the agent's launch directory.
The workspace owns the `.reactive` ledger, run metadata, evidence and generated `.docs` projections.

```bash
reactive-skills-axi invoke my-skill --job feature-a --workspace ./projects/example
reactive-skills-axi state my-skill --job feature-a
reactive-skills-axi emit my-skill ADVANCE --job feature-a
```

`--workspace` accepts an existing directory and resolves relative paths against the caller's directory.
It takes precedence over `WORKSPACE_DIR`, which accepts the same directory syntax.
The CLI resolves symlinks and records the canonical absolute path as `workspaceRoot` in each new job's `job.json`.
Without an explicit choice, the first run retains the local skill workspace or current-directory default.
Check the reported `workspace_root` before proceeding when that default may be a launch directory above the project.

`context.workspace_root` is descriptive only.
Neither an invoke payload nor a later context update changes the runtime workspace.
Use `--workspace` or `WORKSPACE_DIR` to select storage explicitly.

## Later commands

The CLI applies the same selection to `invoke`, `state`, `emit`, `events`, `jobs`, `reset`, `evidence`, `approve`, `rebuild-sqlite`, `view`, `watch` and `dashboard`.
With no explicit root, it considers known workspace roots and ancestor stores before opening a runtime engine.
A store containing the caller's directory, or the caller default, wins over other known stores, and the diagnostics then report `other_workspace_stores` when other stores also hold the job.
Another known store is selected only when the caller is inside no candidate store; a named job selects the store that holds it, and multiple candidates require `--workspace` or `WORKSPACE_DIR`.
Multiple stores that all contain the caller's directory also require a workspace choice.
`invoke` for a job that no store holds, or with no job reference, starts or resumes in the caller's store or default and never in another project's store.
An omitted skill follows the same preference across known workspaces, or an explicit root selects it.
The workspace-wide `dashboard` lists the jobs of every known workspace that holds skill stores (stores containing the caller first, then ancestors and recorded roots), so runs started from different project directories appear in one catalog, each with its workspace root.
An explicit `--workspace` or `WORKSPACE_DIR` limits it to that single store.
A store is known once a skill-targeted CLI run (for example `invoke`, `state`, `emit` or `jobs` for a skill that store holds) has found or created a skill store in it and recorded the root, or when it is an ancestor of the caller's directory.
`dashboard --workspace <directory>` is a single-store view and records nothing, so a store that is neither recorded nor an ancestor stays out of a plain `dashboard` until a skill-targeted command records it with `--workspace`; a register or scan command is a separate follow-up.
This discovery does not recursively search project descendants or read event history.

After a CLI operation finds or creates a skill store, it registers the root under `${XDG_STATE_HOME}/reactive-skills/workspaces`, or `~/.local/state/reactive-skills/workspaces` when `XDG_STATE_HOME` is unset.
Each hash-named JSON file contains one canonical workspace path, allowing later processes in parent, sibling or unrelated directories to find it.
The catalog is a discovery hint; job metadata and the selected store remain authoritative.
Deleted workspace paths are ignored, and corrupt catalog entries fail closed unless a workspace is supplied explicitly.
Copied or moved stores whose recorded root differs from their location are refused; this change does not migrate stores.

Jobs created before workspace binding remain usable without `workspaceRoot`.
An ancestor store or explicit workspace selects their existing location, and subsequent reads and updates preserve their metadata and history.
If a legacy store is outside the caller's ancestors and has never been registered, select it once with `--workspace`.
Resetting a legacy or registered store outside the caller's directory also requires `--workspace`.
The historical skill-parent store location is also considered for compatibility.

Named `state` and ordinary `emit` calls refuse unknown jobs rather than creating a fresh run at the initial state.
Use `invoke` to start a named run.
Explicit evidence import, including folded import-and-emit, retains its existing run-registration behavior within the selected workspace.
Competing stores still require a workspace choice for evidence operations.
This fixes the subdirectory resume behavior reported in issue 26 for known jobs and prevents ordinary named emits from silently bootstrapping unknown runs.

`reset` and `reset --purge` act only on a store that contains the caller's directory or on an explicit `--workspace` or `WORKSPACE_DIR` root.
When the only candidate is another known store, they fail and name that store with the `--workspace` flag to pass; `state`, `events`, `jobs`, `view` and `emit` can still select it with the `caller_directory_differs` warning.
`reset --purge` deletes only the selected workspace's skill store.
It does not remove another store beside the installed skill.

## Diagnostics

Legacy text includes `workspace_root`, `workspace_source`, `WORKSPACE_DIR` and `workspace_warning` fields.
Compact JSON includes the same fields under `workspace`.
For long-running telemetry commands, `--once` returns workspace diagnostics with the listener summary.
Evidence JSON receipts retain their first-line format and include additive workspace diagnostics.
When the caller's physical directory differs from the selected root, `workspace_warning` is `caller_directory_differs`, including when the caller is a subdirectory.
Job listings also show each recorded workspace root, falling back to the selected root for legacy jobs.

Use an explicit root to resolve ambiguity between stores that are all outside the caller's directory, or that all contain it.
This contract applies to the AXI executable.
SDK and MCP callers continue to supply their runtime `workspaceDir` explicitly; direct command-handler helpers retain their legacy fallback behavior.

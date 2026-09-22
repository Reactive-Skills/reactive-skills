# Manual Verification: Synthesis Run Preservation

These checks validate the approved continuation behavior against a real synthesis skill installation.

1. Start a fresh synthesis run with `reactive-skills-axi invoke synthesis --job preservation-parent`.

2. Confirm that the fresh run starts in `INIT` and contains the declared default context.

3. Advance the parent run far enough to persist a mission, glossary entry, baseline finding, and decision.

4. Start a child run with `reactive-skills-axi invoke synthesis --job preservation-child --parent preservation-parent --payload '{"mission":"Updated continuation mission"}'`.

5. Confirm that the child starts in `INIT`, preserves the parent's glossary, baseline finding, and decision, and uses the new mission value.

6. Confirm that the parent and child have different run IDs and separate archived run directories.

7. Confirm that the active root projection reflects only the selected active run and does not concatenate unrelated Markdown documents.

8. Attempt `reactive-skills-axi invoke synthesis --job orphan-child --parent missing-parent` and confirm that it fails before creating a child job.

9. Re-run the parent and child inspection commands and confirm that persisted context remains available after process restart.

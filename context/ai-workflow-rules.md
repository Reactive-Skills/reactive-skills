# AI Workflow Rules: Reactive Skills Architecture (RSA)

---

## 1. Incremental Scoping & Stop Conditions
- Execute changes in small, verified atomic slices.
- Never refactor unrelated files outside the target feature scope.
- Always run `npm test` after modifying code in `src/` or `skills/`.

---

## 2. Protected Files & Directories
- `.reactive/skills/<skill>/events.jsonl`: Append-only ledger. Never manually delete or rewrite lines during a live run.
- Archived `.reactive/skills/<skill>/events-*.jsonl` segments are append-only history and must remain available for replay.
- `package.json` / `tsconfig.json`: Modify only when adding verified dependencies or compiler settings.
- `context/`: Keep synchronized with all architectural decisions and project progress.

---

## 3. Handling Ambiguity
- When requirements for a new skill are ambiguous, do not invent transitions. Follow the Socratic interview methodology to define states and transitions explicitly.
- Extract: (1) Workflow goal, (2) State taxonomy, (3) Transition signals, (4) Invariant guards, (5) Deliverable sinks.

---

## 4. Verification Checklist Before Marking Work Complete
- [ ] Run `npm run build` to ensure zero TypeScript compiler errors.
- [ ] Run `npm test` and verify $100\%$ pass rate across all Vitest suites.
- [ ] Ensure all modified/created files are referenced in `context/progress-tracker.md`.
- [ ] Update `README.md` or `AGENTS.md` if public APIs or CLI commands were added/changed.

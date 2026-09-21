# Gate: Leaf 1 — Bootloader Contract Inversion

**Slice:** 3 (Job Lifecycle Ergonomics & Terminal Auto-Rotation)  
**Leaf:** 1  
**Spec:** `docs/specs/job-lifecycle-and-terminal-rotation.md`  
**Description:** Update the universal reactive bootloader in `apps/axi/src/bootloader.ts` and `packages/runtime/src/core/migration.ts` so agents default to `invoke` for starting new tasks and `state` for resuming in-progress tasks.

## Targeted Files
- `apps/axi/src/bootloader.ts`
- `packages/runtime/src/core/migration.ts`
- Associated tests in `apps/axi/tests/` and `packages/runtime/tests/`

## Expected Bootloader Format
```markdown
<!-- REACTIVE BOOTLOADER -->
> **REACTIVE SKILL: STRICT RUNTIME EXECUTION**
> This skill is an event-driven state machine. Manual execution is forbidden.
>
> **DEFAULT EXECUTION: AXI CLI**
> AXI is the default runtime path, even when MCP tools are present.
> - To start a new task: Run `reactive-skills-axi invoke <skill> [--payload JSON]`
> - To resume an active task: Run `reactive-skills-axi state <skill>`
> - To advance state: Run `reactive-skills-axi emit <skill> <signal>`
>
> **FALLBACK EXECUTION: MCP**
> Use `reactive_state` and `reactive_emit_signal` only when shell access to AXI is unavailable.
>
> **STRICT INVARIANT**
> Do not manually author `.docs/` deliverables or guess next states.
> The runtime governs all transitions and projections.
<!-- END REACTIVE BOOTLOADER -->
```

## Verification Gates
- [x] G1: `createReactiveBootloader` in `apps/axi/src/bootloader.ts` contains `To start a new task: Run \`reactive-skills-axi invoke`
  CHECK: git grep "To start a new task: Run" apps/axi/src/bootloader.ts
  EVIDENCE: passed
- [x] G2: `createReactiveBootloader` in `packages/runtime/src/core/migration.ts` matches the updated contract
  CHECK: git grep "To start a new task: Run" packages/runtime/src/core/migration.ts
  EVIDENCE: passed
- [x] G3: `apps/axi/tests/commands/init.test.ts` passes
  CHECK: npx vitest run apps/axi/tests/commands/init.test.ts
  EVIDENCE: passed (3 passed out of 3 tests)
- [x] G4: `packages/runtime/tests/migration.test.ts` passes
  CHECK: npx vitest run packages/runtime/tests/migration.test.ts
  EVIDENCE: passed (4 passed out of 4 tests)

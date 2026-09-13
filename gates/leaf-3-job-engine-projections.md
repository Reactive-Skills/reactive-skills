# Gate: Leaf 3 — FSMEngine & Dual-Write Projections

**Slice:** 1 (Core Job Isolation & Dual-Write Projections)  
**Leaf:** 3  
**Engine:** `/tdd`  
**Description:** Implement `FSMEngine` job resolution and `ProjectionEngine` dual-write mirroring (job archive + canonical root).

## Verification Gates

- [x] G1: `FSMEngine` options accept `jobId` and rehydrate state strictly from the targeted job
  CHECK: pnpm vitest run packages/runtime/tests/job-engine-projections.test.ts -t "fsm rehydration by job"
  EXPECT: passed
  EVIDENCE: passed (1 test passed in 47ms)

- [x] G2: `ProjectionEngine` writes deliverable to historical archive at `.docs/<skill>/jobs/<jobId>/`
  CHECK: pnpm vitest run packages/runtime/tests/job-engine-projections.test.ts -t "archive directory projection"
  EXPECT: passed
  EVIDENCE: passed (1 test passed in 34ms)

- [x] G3: Active job dual-writes deliverables to canonical root declared in `skill.yaml`
  CHECK: pnpm vitest run packages/runtime/tests/job-engine-projections.test.ts -t "canonical root mirror"
  EXPECT: passed
  EVIDENCE: passed (1 test passed in 31ms)

- [x] G4: Inactive/secondary job does NOT overwrite canonical root deliverables
  CHECK: pnpm vitest run packages/runtime/tests/job-engine-projections.test.ts -t "inactive job does not overwrite root"
  EXPECT: passed
  EVIDENCE: passed (1 test passed in 32ms)

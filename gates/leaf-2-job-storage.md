# Gate: Leaf 2 — Job Storage & Concurrency Locks

**Slice:** 1 (Core Job Isolation & Dual-Write Projections)  
**Leaf:** 2  
**Engine:** `/implement-spec`  
**Description:** Implement job-scoped `EventStore` path resolution (`.reactive/skills/<skill>/jobs/<jobId>/`), job lockfile mutex, and legacy fallback.

## Verification Gates

- [x] G1: `EventStore` resolves job-scoped directory when `jobId` is supplied
  CHECK: pnpm vitest run packages/runtime/tests/job-storage.test.ts -t "job-scoped paths"
  EXPECT: passed
  EVIDENCE: passed (1 test passed)

- [x] G2: `EventStore` gracefully falls back to root when existing legacy event store has no `jobs/` directory
  CHECK: pnpm vitest run packages/runtime/tests/job-storage.test.ts -t "legacy store fallback"
  EXPECT: passed
  EVIDENCE: passed (1 test passed)

- [x] G3: Mutex file lock prevents two instances from writing to the same job concurrently
  CHECK: pnpm vitest run packages/runtime/tests/job-storage.test.ts -t "concurrency lock contention"
  EXPECT: passed
  EVIDENCE: passed (1 test passed)

- [x] G4: Two distinct jobs can execute concurrently in the same workspace without lock contention
  CHECK: pnpm vitest run packages/runtime/tests/job-storage.test.ts -t "parallel independent jobs"
  EXPECT: passed
  EVIDENCE: passed (1 test passed)

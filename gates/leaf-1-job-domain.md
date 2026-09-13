# Gate: Leaf 1 — Job Domain & Metadata

**Slice:** 1 (Core Job Isolation & Dual-Write Projections)  
**Leaf:** 1  
**Engine:** `/tdd`  
**Description:** Define `JobMetadata` schema, ID slug normalization, active pointer resolution, and core job decider logic.

## Verification Gates

- [x] G1: `JobMetadata` schema and TypeScript types exported in runtime types
  CHECK: npx tsx -e "import { JobMetadataSchema } from './packages/runtime/src/core/types.ts'; console.log(typeof JobMetadataSchema.parse);"
  EXPECT: function
  EVIDENCE: passed (output: function)

- [x] G2: Job ID slug normalization converts arbitrary names to safe filesystem slugs
  CHECK: npx tsx -e "import { normalizeJobSlug } from './packages/runtime/src/core/job-manager.ts'; console.log(normalizeJobSlug('Auth Slice v1.0'));"
  EXPECT: auth-slice-v1-0
  EVIDENCE: passed (output: auth-slice-v1-0)

- [x] G3: Active job pointer resolver falls back to 'default' when no pointer exists
  CHECK: pnpm vitest run packages/runtime/tests/job-domain.test.ts -t "active pointer fallback"
  EXPECT: passed
  EVIDENCE: passed (1 test passed)

- [x] G4: Full job domain Vitest suite passes
  CHECK: pnpm vitest run packages/runtime/tests/job-domain.test.ts
  EXPECT: passed
  EVIDENCE: passed (9 passed out of 9 tests)

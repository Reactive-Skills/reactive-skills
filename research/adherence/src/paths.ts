import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = path.resolve(HARNESS_ROOT, '../..');
/** Public tdd-refactor files pinned by the transport benchmark (provenance.json holds their Git blob hashes). */
export const PINNED_TDD_DIR = path.join(REPO_ROOT, 'packages/runtime/scripts/transport-benchmark/fixtures/tdd-refactor');
export const PINNED_TDD_PROVENANCE = path.join(REPO_ROOT, 'packages/runtime/scripts/transport-benchmark/fixtures/provenance.json');
export const AXI_BIN = path.join(REPO_ROOT, 'apps/axi/dist/cli/index.js');
export const FIXTURES = path.join(HARNESS_ROOT, 'fixtures');
export const RESULTS = path.join(HARNESS_ROOT, 'results');

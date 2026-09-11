import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createGeneratedDocsContentSource } from '../apps/site/src/Features/Docs/docs-generated-content';
import { DocSlug } from '../apps/site/src/Features/Docs/docs-contract';

const repoRoot = process.cwd();
const source = createGeneratedDocsContentSource(repoRoot);
const slugs: DocSlug[] = ['overview', 'quickstart', 'concepts', 'mcp', 'axi'];

const payload = {
  generatedAt: new Date().toISOString(),
  sourceName: source.sourceName,
  slugs,
  pages: slugs.map(slug => ({ slug, page: source.getPage(slug) })),
};

// Deterministic snapshot strips timestamp from hash material.
const deterministicPayload = {
  sourceName: payload.sourceName,
  slugs: payload.slugs,
  pages: payload.pages,
};

const deterministicJson = JSON.stringify(deterministicPayload, null, 2);
const digest = crypto.createHash('sha256').update(deterministicJson).digest('hex');

const output = {
  ...payload,
  digest,
};

const outDir = path.join(repoRoot, '.docs', 'generated');
fs.mkdirSync(outDir, { recursive: true });

const outPath = path.join(outDir, 'reference-docs.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');

console.log(JSON.stringify({ outPath, digest, pages: slugs.length }));

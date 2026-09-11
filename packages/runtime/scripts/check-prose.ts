import fs from 'node:fs';
import path from 'node:path';
import { assessTextQuality } from './prose-quality-gate.js';

const filesToCheck = [
  'README.md',
  'CONTRIBUTING.md',
];

const root = fs.existsSync(path.join(process.cwd(), 'README.md'))
  ? process.cwd()
  : path.resolve(process.cwd(), '../..');
const issues: string[] = [];

for (const rel of filesToCheck) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) continue;

  const text = fs.readFileSync(full, 'utf8');
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(value => value.trim())
    .filter(value => value.length > 0);

  for (const paragraph of paragraphs) {
    const result = assessTextQuality(paragraph);
    if (!result.ok) {
      issues.push(`${rel}: ${result.issues.join(' ')}`);
    }
  }
}

if (issues.length > 0) {
  console.error('❌ Prose quality gate failed:');
  for (const issue of issues) {
    console.error(`  • ${issue}`);
  }
  process.exit(1);
}

console.log('✅ Prose quality gate passed for all public-facing content.');

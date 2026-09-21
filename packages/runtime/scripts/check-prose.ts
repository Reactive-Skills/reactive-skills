import fs from 'node:fs';
import path from 'node:path';
import { assessTextQuality } from './prose-quality-gate.js';

const root = fs.existsSync(path.join(process.cwd(), 'README.md'))
  ? process.cwd()
  : path.resolve(process.cwd(), '../..');

const filesToCheck = [
  'README.md',
  'CONTRIBUTING.md',
];

// Add blog posts
const blogDir = path.join(root, 'content/blog');
if (fs.existsSync(blogDir)) {
  for (const f of fs.readdirSync(blogDir).filter((x) => x.endsWith('.md'))) {
    filesToCheck.push(path.join('content/blog', f));
  }
}

// Add site docs
const siteDocsDir = path.join(root, 'apps/site/src/infrastructure/content/docs');
if (fs.existsSync(siteDocsDir)) {
  for (const f of fs.readdirSync(siteDocsDir).filter((x) => x.endsWith('.js'))) {
    filesToCheck.push(path.join('apps/site/src/infrastructure/content/docs', f));
  }
}

const issues: string[] = [];

for (const rel of filesToCheck) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) continue;

  const content = fs.readFileSync(full, 'utf8');

  if (rel.endsWith('.js')) {
    // Extract string literals from text properties in doc definitions
    const textPropRegex = /text:\s*(['"`])([\s\S]*?)\1/g;
    let match;
    while ((match = textPropRegex.exec(content)) !== null) {
      const text = match[2].trim();
      const result = assessTextQuality(text);
      if (!result.ok) {
        issues.push(`${rel}: ${result.issues.join(' ')} (text: "${text.slice(0, 60)}...")`);
      }
    }
  } else {
    const paragraphs = content
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
}

if (issues.length > 0) {
  console.error('❌ Prose quality gate failed:');
  for (const issue of issues) {
    console.error(`  • ${issue}`);
  }
  process.exit(1);
}

console.log('✅ Prose quality gate passed for all public-facing content.');

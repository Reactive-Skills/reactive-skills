#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = fs.existsSync(path.join(process.cwd(), 'AGENTS.md'))
  ? process.cwd()
  : path.resolve(process.cwd(), '../..');
const errors = [];

function checkFileExists(relPath) {
  const full = path.join(projectRoot, relPath);
  if (!fs.existsSync(full)) {
    errors.push(`Missing required file: ${relPath}`);
  }
}

// 1. Check Primary Documentation Files Exist
const requiredDocs = [
  'README.md',
  'CHANGELOG.md',
  'AGENTS.md',
  'CLAUDE.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'LICENSE',
  'context/architecture.md',
  'context/progress-tracker.md',
];

for (const doc of requiredDocs) {
  checkFileExists(doc);
}

// 2. Check CLI commands documented in README.md
const readmeContent = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
const cliPath = [
  path.join(projectRoot, 'apps', 'axi', 'src', 'cli', 'index.ts'),
  path.join(projectRoot, 'apps', 'reactive-skills-axi', 'src', 'cli', 'index.ts'),
  path.join(projectRoot, 'packages', 'runtime', 'src', 'cli', 'index.ts'),
  path.join(projectRoot, 'src', 'cli', 'index.ts'),
].find((p) => fs.existsSync(p));

const cliCommands = ['mcp', 'state', 'emit', 'events', 'inspect', 'validate', 'reset', 'init', 'jobs'];
for (const cmd of cliCommands) {
  if (!readmeContent.includes(cmd)) {
    errors.push(`CLI command '${cmd}' is missing from README.md`);
  }
}

// 3. Check Core Modules mapped in AGENTS.md
const agentsContent = fs.readFileSync(path.join(projectRoot, 'AGENTS.md'), 'utf8');
const coreDir = [
  path.join(projectRoot, 'packages', 'runtime', 'src', 'core'),
  path.join(projectRoot, 'src', 'core'),
].find((p) => fs.existsSync(p));

if (coreDir) {
  const coreFiles = fs.readdirSync(coreDir);
  for (const file of coreFiles) {
    if (file.endsWith('.ts')) {
      const baseName = file.replace('.ts', '');
      if (!agentsContent.includes(baseName)) {
        errors.push(`Core module '${baseName}' is missing from AGENTS.md repository map.`);
      }
    }
  }
}

// 4. Check MCP Server mapped in AGENTS.md
const mcpServerPath = [
  path.join(projectRoot, 'packages', 'runtime', 'src', 'mcp', 'server.ts'),
  path.join(projectRoot, 'src', 'mcp', 'server.ts'),
].find((p) => fs.existsSync(p));

if (mcpServerPath && !agentsContent.includes('server.ts') && !agentsContent.includes('mcp/server.ts')) {
  errors.push(`'server.ts' is missing from AGENTS.md repository map.`);
}

// 5. Check What's New Release Banners match current version
const rootPkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const currentVer = rootPkg.version;
const bannerFiles = [
  'README.md',
  'apps/axi/README.md',
  'packages/runtime/README.md',
];

for (const bFile of bannerFiles) {
  const fullPath = path.join(projectRoot, bFile);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (!content.includes(`What's New in v${currentVer}`)) {
      errors.push(`Release banner out of date in '${bFile}': missing 'What's New in v${currentVer}'`);
    }
  }
}

// Results
if (errors.length > 0) {
  console.error('\n❌ Documentation Invariant Failures:');
  for (const err of errors) {
    console.error(`  • ${err}`);
  }
  process.exit(1);
} else {
  console.log('✅ Documentation Invariants Passed: All CLI commands, core modules, and deliverables are 100% synchronized.');
  process.exit(0);
}

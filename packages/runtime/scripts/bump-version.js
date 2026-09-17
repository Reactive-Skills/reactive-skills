#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const projectRoot = process.cwd();
const type = process.argv[2] || 'patch';

// 1. Read current version from package.json
const pkgPath = path.join(projectRoot, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version || '1.0.0';

const [major, minor, patch] = currentVersion.split('.').map(Number);
let nextVersion = '';

if (type === 'major') {
  nextVersion = `${major + 1}.0.0`;
} else if (type === 'minor') {
  nextVersion = `${major}.${minor + 1}.0`;
} else if (type === 'patch') {
  nextVersion = `${major}.${minor}.${patch + 1}`;
} else if (/^\d+\.\d+\.\d+/.test(type)) {
  nextVersion = type;
} else {
  console.error(`Invalid bump type: ${type}. Must be 'patch', 'minor', 'major', or a semver string (e.g. 1.2.0).`);
  process.exit(1);
}

console.log(`\n🚀 Bumping version: ${currentVersion} ──► ${nextVersion}\n`);

const filesUpdated = [];

// 2. Update package.json across the workspace
const repoRoot = path.resolve(projectRoot, '../..');
const packageJsonPaths = [
  pkgPath,
  path.join(repoRoot, 'package.json'),
  path.join(repoRoot, 'apps', 'axi', 'package.json'),
  path.join(repoRoot, 'apps', 'site', 'package.json'),
];

for (const p of packageJsonPaths) {
  if (fs.existsSync(p)) {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    data.version = nextVersion;
    fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
    filesUpdated.push(path.relative(projectRoot, p));
  }
}

// 3. Update package-lock.json if present
const pkgLockPath = path.join(projectRoot, 'package-lock.json');
if (fs.existsSync(pkgLockPath)) {
  try {
    const pkgLock = JSON.parse(fs.readFileSync(pkgLockPath, 'utf8'));
    pkgLock.version = nextVersion;
    if (pkgLock.packages && pkgLock.packages['']) {
      pkgLock.packages[''].version = nextVersion;
    }
    fs.writeFileSync(pkgLockPath, JSON.stringify(pkgLock, null, 2) + '\n', 'utf8');
    filesUpdated.push('package-lock.json');
  } catch (err) {
    console.warn(`Could not update package-lock.json: ${err.message}`);
  }
}

// 4. Update all skills/*/skill.yaml files (both in package and workspace root)
const skillsDirs = [
  path.join(projectRoot, 'skills'),
  path.join(repoRoot, 'skills'),
];

for (const sDir of skillsDirs) {
  if (fs.existsSync(sDir)) {
    const skillFolders = fs.readdirSync(sDir, { withFileTypes: true });
    for (const dirent of skillFolders) {
      if (dirent.isDirectory() && !dirent.name.startsWith('_')) {
        const skillYamlPath = path.join(sDir, dirent.name, 'skill.yaml');
        if (fs.existsSync(skillYamlPath)) {
          let content = fs.readFileSync(skillYamlPath, 'utf8');
          if (/^version:\s*/m.test(content)) {
            content = content.replace(/^version:\s*["'][^"']+["']/gm, `version: "${nextVersion}"`);
            content = content.replace(/^version:\s*([0-9.]+)/gm, `version: "${nextVersion}"`);
          } else {
            content = content.replace(/^name:\s*["']?([^"'\n]+)["']?/m, `name: "$1"\nversion: "${nextVersion}"`);
          }
          fs.writeFileSync(skillYamlPath, content, 'utf8');
          filesUpdated.push(path.relative(projectRoot, skillYamlPath));
        }
      }
    }
  }
}

// 5. Update CHANGELOG.md
const dateStr = new Date().toISOString().split('T')[0];
let recentCommits = '';
try {
  recentCommits = execSync('git log -n 5 --pretty=format:"- %s (%h)"', { encoding: 'utf8' }).trim();
} catch {
  recentCommits = '- Incremental updates and improvements';
}

const changelogEntry = `\n## [${nextVersion}] - ${dateStr}\n\n${recentCommits}\n`;
const changelogPaths = [
  path.join(projectRoot, 'CHANGELOG.md'),
  path.join(repoRoot, 'apps', 'axi', 'CHANGELOG.md'),
];

for (const cp of changelogPaths) {
  if (fs.existsSync(cp)) {
    const existing = fs.readFileSync(cp, 'utf8');
    fs.writeFileSync(cp, changelogEntry + existing, 'utf8');
  } else {
    fs.writeFileSync(cp, `# Changelog\n${changelogEntry}`, 'utf8');
  }
  filesUpdated.push(path.relative(projectRoot, cp));
}


// 6. Synchronize changelog to root and documentation site
console.log('\n📄 Synchronizing CHANGELOG to root and documentation site...');
try {
  const syncChangelogScript = path.join(repoRoot, 'scripts', 'sync-changelog.js');
  if (fs.existsSync(syncChangelogScript)) {
    execSync(`node "${syncChangelogScript}"`, { stdio: 'inherit' });
    filesUpdated.push(path.relative(projectRoot, path.join(repoRoot, 'CHANGELOG.md')));
    filesUpdated.push(path.relative(projectRoot, path.join(repoRoot, 'apps', 'site', 'src', 'infrastructure', 'content', 'docs', 'changelog.js')));
  }
} catch (err) {
  console.warn(`Could not sync site changelog: ${err.message}`);
}

// 7. Build and Pack fresh .tgz bundle
console.log('\n📦 Compiling TypeScript & Packing fresh .tgz bundle...');
try {
  // Clean old .tgz files
  const existingTgz = fs.readdirSync(projectRoot).filter(f => f.endsWith('.tgz'));
  for (const tgz of existingTgz) {
    fs.unlinkSync(path.join(projectRoot, tgz));
  }

  execSync('npm run build', { stdio: 'inherit' });
  const packOutput = execSync('npm pack', { encoding: 'utf8' }).trim();
  filesUpdated.push(packOutput);
  console.log(`📦 Generated tarball: ${packOutput}`);
} catch (err) {
  console.error(`Build/pack failed: ${err.message}`);
}

console.log('\n✅ Synchronized version across:');
for (const f of filesUpdated) {
  console.log(`  • ${f}`);
}

console.log(`\n🎉 Bump and packaging to ${nextVersion} complete!`);

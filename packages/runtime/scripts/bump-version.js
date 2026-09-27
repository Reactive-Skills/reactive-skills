#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';

const projectRoot = process.cwd();
const requestedBump = process.argv[2] || 'patch';
const packagePath = path.join(projectRoot, 'package.json');
const runtimePackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const currentVersion = runtimePackage.version;
const stableSemVer = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

if (typeof currentVersion !== 'string' || !stableSemVer.test(currentVersion)) {
  throw new Error(`Invalid current package version ${JSON.stringify(currentVersion)}; expected MAJOR.MINOR.PATCH.`);
}

const [major, minor, patch] = currentVersion.split('.').map(BigInt);
let nextVersion;

if (requestedBump === 'major') {
  nextVersion = `${major + 1n}.0.0`;
} else if (requestedBump === 'minor') {
  nextVersion = `${major}.${minor + 1n}.0`;
} else if (requestedBump === 'patch') {
  nextVersion = `${major}.${minor}.${patch + 1n}`;
} else if (stableSemVer.test(requestedBump)) {
  nextVersion = requestedBump;
} else {
  throw new Error(`Invalid bump type ${JSON.stringify(requestedBump)}. Use patch, minor, major, or an exact stable version such as 1.2.0.`);
}

const nextVersionParts = nextVersion.split('.').map(BigInt);
const currentVersionParts = [major, minor, patch];
const versionAdvance = nextVersionParts.findIndex((part, index) => part !== currentVersionParts[index]);
if (versionAdvance === -1 || nextVersionParts[versionAdvance] < currentVersionParts[versionAdvance]) {
  throw new Error(`Requested version ${nextVersion} must be greater than current version ${currentVersion}.`);
}

const repoRoot = path.resolve(projectRoot, '../..');
const previousTag = `v${currentVersion}`;
const matchingTag = execFileSync('git', ['tag', '--list', previousTag], {
  cwd: repoRoot,
  encoding: 'utf8',
}).trim();

if (matchingTag !== previousTag) {
  throw new Error(`Required previous release tag ${previousTag} was not found; refusing to prepare a release.`);
}

const recentCommits = execFileSync('git', [
  'log',
  `${previousTag}..HEAD`,
  '--pretty=format:- %s (%h)',
], {
  cwd: repoRoot,
  encoding: 'utf8',
}).trim();

if (!recentCommits) {
  throw new Error(`No commits found since ${previousTag}; refusing to prepare an empty release.`);
}

const packageJsonPaths = [
  packagePath,
  path.join(repoRoot, 'package.json'),
  path.join(repoRoot, 'apps', 'axi', 'package.json'),
  path.join(repoRoot, 'apps', 'site', 'package.json'),
];
const packageManifests = packageJsonPaths.map((manifestPath) => {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Required workspace package manifest is missing: ${path.relative(repoRoot, manifestPath)}.`);
  }

  return {
    path: manifestPath,
    manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
  };
});

console.log(`\nBumping version: ${currentVersion} -> ${nextVersion}\n`);

const filesUpdated = [];

for (const entry of packageManifests) {
  entry.manifest.version = nextVersion;
  fs.writeFileSync(entry.path, `${JSON.stringify(entry.manifest, null, 2)}\n`, 'utf8');
  filesUpdated.push(path.relative(projectRoot, entry.path));
}

const packageLockPath = path.join(projectRoot, 'package-lock.json');
if (fs.existsSync(packageLockPath)) {
  const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
  packageLock.version = nextVersion;
  if (packageLock.packages && packageLock.packages['']) {
    packageLock.packages[''].version = nextVersion;
  }
  fs.writeFileSync(packageLockPath, `${JSON.stringify(packageLock, null, 2)}\n`, 'utf8');
  filesUpdated.push('package-lock.json');
}

const date = new Date().toISOString().split('T')[0];
const changelogEntry = `\n## [${nextVersion}] - ${date}\n\n${recentCommits}\n`;
const changelogPaths = [
  path.join(projectRoot, 'CHANGELOG.md'),
  path.join(repoRoot, 'apps', 'axi', 'CHANGELOG.md'),
];

for (const changelogPath of changelogPaths) {
  const existing = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, 'utf8') : '# Changelog\n';
  fs.writeFileSync(changelogPath, `${changelogEntry}${existing}`, 'utf8');
  filesUpdated.push(path.relative(projectRoot, changelogPath));
}

const syncChangelogScript = path.join(repoRoot, 'scripts', 'sync-changelog.js');
if (!fs.existsSync(syncChangelogScript)) {
  throw new Error(`Required changelog synchronization script is missing: ${syncChangelogScript}.`);
}

console.log('\nSynchronizing changelog to root and documentation site...');
execFileSync(process.execPath, [syncChangelogScript], { cwd: repoRoot, stdio: 'inherit' });
filesUpdated.push(path.relative(projectRoot, path.join(repoRoot, 'CHANGELOG.md')));
filesUpdated.push(path.relative(projectRoot, path.join(repoRoot, 'apps', 'site', 'src', 'infrastructure', 'content', 'docs', 'changelog.js')));

console.log('\nBuilding and packing the new runtime archive...');
execSync('pnpm run build', { cwd: projectRoot, stdio: 'inherit' });
const packOutput = execSync('npm pack', { cwd: projectRoot, encoding: 'utf8' }).trim();
filesUpdated.push(packOutput);
console.log(`Generated tarball: ${packOutput}`);

console.log('\nSynchronized version across:');
for (const file of filesUpdated) {
  console.log(`  - ${file}`);
}

console.log(`\nBump and packaging to ${nextVersion} complete!`);

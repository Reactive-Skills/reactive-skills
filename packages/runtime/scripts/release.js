#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const projectRoot = process.cwd();
const type = process.argv[2] || 'patch';
const headline = process.argv[3] || '';
const repoRoot = path.resolve(projectRoot, '../..');

// 1. Bump version (handles package.json, changelog, build, pack)
console.log('📋 Step 1: Bumping version...');
execSync(`node "${path.join(projectRoot, 'scripts', 'bump-version.js')}" ${type}`, { stdio: 'inherit' });

// 2. Read new version
const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const nextVersion = pkg.version;

// 3. Update README hero banners across 3 files
console.log(`\n📋 Step 2: Updating README banners to v${nextVersion}...`);
const bannerFiles = [
  path.join(repoRoot, 'README.md'),
  path.join(repoRoot, 'apps', 'axi', 'README.md'),
  path.join(projectRoot, 'README.md'),
];

for (const bannerFile of bannerFiles) {
  if (!fs.existsSync(bannerFile)) continue;
  let content = fs.readFileSync(bannerFile, 'utf8');

  // Replace the version number in the hero banner
  content = content.replace(
    /What's New in v\d+\.\d+\.\d+/,
    `What's New in v${nextVersion}`
  );

  // Replace release notes URL
  content = content.replace(
    /releases\/tag\/v\d+\.\d+\.\d+/g,
    `releases/tag/v${nextVersion}`
  );

  // If headline provided, update the banner content
  if (headline) {
    const isRoot = bannerFile === path.join(repoRoot, 'README.md');

    if (isRoot) {
      // Multi-line banner: replace the first bullet after version line
      const firstBulletRegex = new RegExp(
        `(What's New in v${nextVersion}:\\*\\*\\r?\\n)(> - .*?\\r?\\n)`,
        's'
      );
      if (firstBulletRegex.test(content)) {
        content = content.replace(
          firstBulletRegex,
          `$1> - ${headline}\n`
        );
      } else {
        // No bullet found, insert one after version line
        content = content.replace(
          new RegExp(`(What's New in v${nextVersion}:\\*\\*\\r?\\n)`),
          `$1> - ${headline}\n`
        );
      }
    } else {
      // Single-line banner: replace text between version and [Read Full]
      content = content.replace(
        new RegExp(`(What's New in v${nextVersion}:)\\s*.+?(?=\\s*\\[Read Full)`, 's'),
        `$1 ${headline} `
      );
    }
  }

  fs.writeFileSync(bannerFile, content, 'utf8');
  console.log(`  ✓ Updated ${path.relative(repoRoot, bannerFile)}`);
}

// 4a. Sync changelog to root + site
console.log(`\n📋 Step 2.5: Syncing changelog to root CHANGELOG.md and site docs...`);
execSync(`node "${path.join(repoRoot, 'scripts', 'sync-changelog.js')}"`, { stdio: 'inherit', cwd: repoRoot });

// 4b. Commit & tag
console.log(`\n📋 Step 3: Committing and tagging v${nextVersion}...`);
execSync('git add -A', { stdio: 'inherit' });

const commitMsg = headline
  ? `chore(release): v${nextVersion} - ${headline}`
  : `chore(release): v${nextVersion}`;
execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });

// Create or replace annotated tag
try {
  execSync(`git tag -d v${nextVersion}`, { stdio: 'inherit' });
} catch {
  // Tag doesn't exist yet, that's fine
}
execSync(`git tag -a v${nextVersion} -m "${nextVersion} - ${headline || ''}"`, { stdio: 'inherit' });

// 5. Push
console.log('\n📋 Step 4: Pushing to remote...');
execSync('git push origin main', { stdio: 'inherit' });
execSync(`git push origin v${nextVersion}`, { stdio: 'inherit' });

console.log(`\n🎉 Release v${nextVersion} complete!`);
console.log('GitHub Release will be auto-created by CI/CD on tag push.');

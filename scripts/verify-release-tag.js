#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stableSemVer = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const workspaceManifestPaths = [
  'package.json',
  'packages/runtime/package.json',
  'apps/axi/package.json',
  'apps/site/package.json',
];

export function validateReleaseTag(tag, packages) {
  const match = typeof tag === 'string' ? /^v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/.exec(tag) : null;
  if (!match || !stableSemVer.test(match[1])) {
    throw new Error(`Invalid release tag ${JSON.stringify(tag)}; expected vMAJOR.MINOR.PATCH.`);
  }

  if (
    !Array.isArray(packages)
    || packages.length !== workspaceManifestPaths.length
    || packages.some((entry, index) => entry.path !== workspaceManifestPaths[index])
  ) {
    throw new Error('Release validation requires the root, runtime, AXI, and site package manifests.');
  }

  const version = match[1];
  const mismatches = packages.filter((entry) => entry.version !== version);
  if (mismatches.length > 0) {
    const details = mismatches.map((entry) => `${entry.path}=${JSON.stringify(entry.version)}`).join(', ');
    throw new Error(`Release tag ${tag} does not match workspace package version ${version}: ${details}.`);
  }

  return version;
}

function readWorkspacePackages() {
  return workspaceManifestPaths.map((relativePath) => {
    const manifestPath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Required workspace package manifest is missing: ${relativePath}.`);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return { path: relativePath, version: manifest.version };
  });
}

function main() {
  try {
    const version = validateReleaseTag(process.env.RELEASE_TAG, readWorkspacePackages());
    console.log(`Release tag ${process.env.RELEASE_TAG} matches all workspace package versions (${version}).`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

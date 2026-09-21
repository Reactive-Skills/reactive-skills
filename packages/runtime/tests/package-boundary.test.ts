import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = path.join(packageRoot, 'package.json');

describe('Runtime package boundary', () => {
  it('ships the TypeSafe SDK as a production dependency', () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    };

    expect(packageJson.dependencies?.['@typesafe-ai/sdk']).toBe('^0.6.0');
    expect(packageJson.peerDependencies?.['@typesafe-ai/sdk']).toBeUndefined();
    expect(packageJson.peerDependenciesMeta?.['@typesafe-ai/sdk']).toBeUndefined();
  });
});

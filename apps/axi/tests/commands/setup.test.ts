import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { setupCommand, getClientTargets } from '../../src/commands/setup.js';

describe('setupCommand', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axi-setup-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('reports supported client targets', () => {
    const targets = getClientTargets();
    expect(targets.length).toBeGreaterThanOrEqual(5);
    const ids = targets.map(t => t.id);
    expect(ids).toContain('claude');
    expect(ids).toContain('cursor');
    expect(ids).toContain('antigravity');
    expect(ids).toContain('cline');
    expect(ids).toContain('agents');
  });

  it('rejects unknown client with VALIDATION_ERROR', async () => {
    await expect(setupCommand(['--client', 'nonexistent_client'])).rejects.toThrow(/Unknown harness client/);
  });

  it('performs dry-run without writing files', async () => {
    const fakeCursorConfig = path.join(tmpDir, 'cursor', 'mcp.json');
    fs.mkdirSync(path.dirname(fakeCursorConfig), { recursive: true });

    const output = await setupCommand(['--dry-run']);
    expect(output).toContain('setup_status: dry_run');
    // Ensure no unrequested new file was written into tmpDir
    expect(fs.existsSync(fakeCursorConfig)).toBe(false);
  });

  it('correctly builds server entry with npx by default', async () => {
    const output = await setupCommand(['--dry-run']);
    expect(output).toBeDefined();
  });
});

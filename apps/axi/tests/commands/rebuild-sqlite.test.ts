import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('rebuildSqliteCommand', () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    vi.restoreAllMocks();
    tmpDir = path.resolve(process.cwd(), '.tmp-rebuild-sqlite-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns error when skill name is missing', async () => {
    const { rebuildSqliteCommand } = await import('../../src/commands/rebuild-sqlite.js');
    const result = await rebuildSqliteCommand([]);
    expect(result).toContain('VALIDATION_ERROR');
    expect(result).toContain('Missing skill name');
  });

  it('returns error when skill path does not exist', async () => {
    const { rebuildSqliteCommand } = await import('../../src/commands/rebuild-sqlite.js');
    const result = await rebuildSqliteCommand(['nonexistent-skill']);
    expect(result).toContain('NOT_FOUND');
    expect(result).toContain('not found in any known location');
  });

  it('returns no_state_to_rebuild when reactive dir is missing', async () => {
    const skillDir = path.join(process.cwd(), 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: test-skill\n', 'utf8');
    const { rebuildSqliteCommand } = await import('../../src/commands/rebuild-sqlite.js');
    const result = await rebuildSqliteCommand(['test-skill']);
    expect(result).toContain('no_state_to_rebuild');
  });

  it('rebuilds SQLite from JSONL and reports event count', async () => {
    const skillDir = path.join(process.cwd(), 'skills', 'test-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), 'name: test-skill\n', 'utf8');

    // Write events via JSONL-only store first. The command resolves skillPath to
    // <cwd>/skills/test-skill and treats path.dirname(skillPath) as the
    // workspace root, so the EventStore must use the same workspaceDir.
    const workspaceDir = path.join(process.cwd(), 'skills');
    const { EventStore } = await import('@reactive-skills/runtime');
    const store = new EventStore({
      workspaceDir,
      skillId: 'test-skill',
      enableSqlite: false,
    });
    store.append('STEP_ONE', { value: 1 });
    store.append('STEP_TWO', { value: 2 });
    store.close();

    const { rebuildSqliteCommand } = await import('../../src/commands/rebuild-sqlite.js');
    const result = await rebuildSqliteCommand(['test-skill']);
    expect(result).toContain('success');
    expect(result).toContain('events_restored');
    expect(result).toContain('"2"');

    // Verify SQLite was actually rebuilt
    const store2 = new EventStore({
      workspaceDir,
      skillId: 'test-skill',
      enableSqlite: true,
    });
    expect(store2.getAll()).toHaveLength(2);
    store2.close();
  });
});
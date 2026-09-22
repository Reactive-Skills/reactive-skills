import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('initCommand', () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    vi.restoreAllMocks();
    tmpDir = path.resolve(process.cwd(), '.tmp-init-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns error output with VALIDATION_ERROR when name is missing', async () => {
    const { initCommand } = await import('../../src/commands/init.js');
    const result = await initCommand([]);
    expect(result).toContain('VALIDATION_ERROR');
    expect(result).toContain('Missing skill name');
  });

  it('creates the skill directory and files', async () => {
    const { initCommand } = await import('../../src/commands/init.js');
    const result = await initCommand(['test-skill']);
    expect(result).toContain('ok: created skill test-skill');

    const skillDir = path.join(process.cwd(), 'skills', 'test-skill');
    expect(fs.existsSync(skillDir)).toBe(true);
    expect(fs.existsSync(path.join(skillDir, 'skill.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(skillDir, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(skillDir, 'STATECHART.md'))).toBe(true);
    const statechartContent = fs.readFileSync(path.join(skillDir, 'STATECHART.md'), 'utf8');
    expect(statechartContent).toContain('stateDiagram-v2');
    expect(fs.existsSync(path.join(skillDir, 'states'))).toBe(true);
    expect(fs.existsSync(path.join(skillDir, 'states', 'init.md'))).toBe(true);
    expect(fs.existsSync(path.join(skillDir, 'states', 'setup_mcp.md'))).toBe(true);
    expect(fs.existsSync(path.join(skillDir, 'states', 'start.md'))).toBe(true);
    expect(fs.existsSync(path.join(skillDir, 'states', 'done.md'))).toBe(true);

    const skillMdContent = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
    expect(skillMdContent).toContain('REACTIVE BOOTLOADER');
    expect(skillMdContent).toContain('reactive-skills-axi state');
    expect(skillMdContent).toContain('LOCAL-FIRST RUNTIME SELECTION');
    expect(skillMdContent).toContain('reactive_capabilities');
    expect(skillMdContent).toContain('npx` is only its zero-install launcher');

    const initContent = fs.readFileSync(path.join(skillDir, 'states', 'init.md'), 'utf8');
    expect(initContent).toContain('reactive_capabilities');
    expect(initContent).toContain('runtime_requirements');

    const bypassContent = fs.readFileSync(path.join(skillDir, 'states', 'bypass_detected.md'), 'utf8');
    expect(bypassContent).toContain('selected runtime `state`');

    const yamlContent = fs.readFileSync(path.join(skillDir, 'skill.yaml'), 'utf8');
    expect(yamlContent).toMatch(/schema_version:\s*['"]?2\.1\.0['"]?/);

    expect(fs.existsSync(path.join(skillDir, 'skill-release.json'))).toBe(true);
    const releaseData = JSON.parse(fs.readFileSync(path.join(skillDir, 'skill-release.json'), 'utf8'));
    expect(releaseData.schemaVersion).toBe(1);
    expect(releaseData.reactiveSchemaVersion).toBe('2.1.0');
  });

  it('returns ALREADY_EXISTS error when directory exists', async () => {
    const { initCommand } = await import('../../src/commands/init.js');
    const existingDir = path.join(process.cwd(), 'skills', 'existing-skill');
    fs.mkdirSync(existingDir, { recursive: true });
    const result = await initCommand(['existing-skill']);
    expect(result).toContain('ALREADY_EXISTS');
    expect(result).toContain('Skill already exists: existing-skill');
  });
});

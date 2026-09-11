import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ProjectMigrator } from '../src/core/migration.js';

describe('ProjectMigrator (Retroactive Project Upgrader)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reactive-migrate-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should generate missing GLOSSARY.md and PROGRESS.md in existing project', () => {
    const result = ProjectMigrator.migrate(tempDir);

    expect(result.migrated).toBe(true);
    expect(result.schemaVersion).toBe('reactive/v2');
    expect(fs.existsSync(path.join(tempDir, '.docs', 'GLOSSARY.md'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.docs', 'PROGRESS.md'))).toBe(true);
  });

  it('should be idempotent and not overwrite existing glossary', () => {
    const docsDir = path.join(tempDir, '.docs');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'GLOSSARY.md'), '# Custom Glossary\n', 'utf8');

    const result = ProjectMigrator.migrate(tempDir);
    const content = fs.readFileSync(path.join(docsDir, 'GLOSSARY.md'), 'utf8');

    expect(content).toBe('# Custom Glossary\n');
    expect(result.filesUpdated.length).toBe(1); // Only generated PROGRESS.md
  });

  it('should preserve legacy workspace event stores without guessing skill ownership', () => {
    const reactiveDir = path.join(tempDir, '.reactive');
    fs.mkdirSync(reactiveDir, { recursive: true });
    fs.writeFileSync(path.join(reactiveDir, 'events.jsonl'), '{"type":"STATE_TRANSITION"}\n', 'utf8');

    const result = ProjectMigrator.migrate(tempDir);

    expect(result.notes.some(note => note.includes('preserved'))).toBe(true);
    expect(fs.existsSync(path.join(reactiveDir, 'events.jsonl'))).toBe(true);
  });

  it('should migrate skill package with bootloader and INIT state', () => {
    const skillDir = path.join(tempDir, 'my-skill');
    fs.mkdirSync(path.join(skillDir, 'states'), { recursive: true });

    const initialYaml = `schema_version: "reactive/v1"\nname: "my-skill"\ninitial_state: "PROCESS"\nstates:\n  PROCESS:\n    description: "Doing work"\n`;
    fs.writeFileSync(path.join(skillDir, 'skill.yaml'), initialYaml, 'utf8');

    const initialMd = `---\nname: my-skill\ntype: reactive\n---\n# My Skill\nSome content here.\n`;
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), initialMd, 'utf8');

    const result = ProjectMigrator.migrateSkill(skillDir);

    expect(result.migrated).toBe(true);
    expect(result.filesUpdated.length).toBeGreaterThanOrEqual(3);

    // SKILL.md has bootloader
    const updatedMd = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
    expect(updatedMd).toContain('REACTIVE BOOTLOADER');
    expect(updatedMd).toContain('STRICT RUNTIME EXECUTION');
    expect(updatedMd).toContain('reactive_state');

    // skill.yaml has INIT and SETUP_MCP and schema_version 2.1.0
    const updatedYaml = fs.readFileSync(path.join(skillDir, 'skill.yaml'), 'utf8');
    expect(updatedYaml).toContain('INIT:');
    expect(updatedYaml).toContain('SETUP_MCP:');
    expect(updatedYaml).toContain('initial_state: INIT');
    expect(updatedYaml).toMatch(/schema_version:\s*['"]?2\.1\.0['"]?/);

    // States files created
    expect(fs.existsSync(path.join(skillDir, 'states', 'init.md'))).toBe(true);
    expect(fs.existsSync(path.join(skillDir, 'states', 'setup_mcp.md'))).toBe(true);

    // skill-release.json created
    const releasePath = path.join(skillDir, 'skill-release.json');
    expect(fs.existsSync(releasePath)).toBe(true);
    const releaseData = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
    expect(releaseData.schemaVersion).toBe(1);
    expect(releaseData.reactiveSchemaVersion).toBe('2.1.0');

    // Idempotency: second run does not duplicate
    const secondResult = ProjectMigrator.migrateSkill(skillDir);
    expect(secondResult.migrated).toBe(false);
  });
});

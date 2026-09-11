import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { LegacySkillAdapter } from '../src/core/legacy-adapter.js';
import { FSMEngine } from '../src/core/fsm-engine.js';
import { EventStore } from '../src/core/event-store.js';

describe('Legacy Skill Adapter & Converter', () => {
  const legacyDir = path.resolve(process.cwd(), 'skills', '_test_legacy_skill');

  beforeEach(() => {
    if (!fs.existsSync(legacyDir)) {
      fs.mkdirSync(legacyDir, { recursive: true });
    }

    const sampleSkillMd = `---
name: clean-code-sample
description: Applies clean code rules for naming and modular functions
---

# Clean Code Guidelines

1. Meaningful names: Use intention-revealing names.
2. Small functions: Functions should do one thing.
3. Don't repeat yourself: Avoid duplication.
`;

    fs.writeFileSync(path.join(legacyDir, 'SKILL.md'), sampleSkillMd, 'utf8');
  });

  it('should parse legacy SKILL.md metadata and frontmatter', () => {
    const meta = LegacySkillAdapter.parseSkillMd(path.join(legacyDir, 'SKILL.md'));
    expect(meta.name).toBe('clean-code-sample');
    expect(meta.description).toContain('clean code rules');
    expect(meta.rawMarkdown).toContain('Meaningful names');
  });

  it('should generate in-memory Reactive SkillManifest from plain SKILL.md', () => {
    const manifest = LegacySkillAdapter.wrapAsReactiveManifest(path.join(legacyDir, 'SKILL.md'));
    expect(manifest.name).toBe('clean-code-sample');
    expect(manifest.initial_state).toBe('EXECUTION');
    expect(manifest.states.DISCOVERY).toBeDefined();
    expect(manifest.states.EXECUTION).toBeDefined();
    expect(manifest.states.VERIFICATION).toBeDefined();
  });

  it('should upgrade legacy directory into a full modular Reactive Skill package', () => {
    const upgradedDir = LegacySkillAdapter.upgradeToModular(legacyDir);
    expect(fs.existsSync(path.join(upgradedDir, 'skill.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(upgradedDir, 'states', '02_execution.md'))).toBe(true);
    expect(fs.existsSync(path.join(upgradedDir, 'templates', 'summary.md.hbs'))).toBe(true);

    // Boot it with FSMEngine to confirm valid execution!
    const engine = new FSMEngine({ skillDir: upgradedDir, eventStore: new EventStore({ inMemory: true }) });
    expect(engine.getCurrentState()).toBe('EXECUTION');
    const prompt = engine.generatePromptSlice();
    expect(prompt.rawPrompt).toContain('Meaningful names');
  });
});

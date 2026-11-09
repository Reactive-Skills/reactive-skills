import { describe, expect, it } from 'vitest';
import {
  createReactiveBootloaderReference,
  ensureReactiveBootloaderReference,
  getReactiveBootloader,
} from '../src/core/bootloader.js';

describe('central reactive bootloader', () => {
  it.each([
    ['direct', (name: string) => createReactiveBootloaderReference(name)],
    ['plain document', (name: string) => ensureReactiveBootloaderReference('# Skill', name)],
    ['frontmatter', (name: string) => ensureReactiveBootloaderReference('---\nname: sample\n---\n\n# Skill', name)],
    ['replaced block', (name: string) => ensureReactiveBootloaderReference('<!-- REACTIVE BOOTLOADER -->\nobsolete\n<!-- END REACTIVE BOOTLOADER -->', name)],
  ])('requires retrieval or a diagnosed stop for every %s stub', (_path, generate) => {
    const stub = generate('example-skill');

    expect(stub).toContain('`reactive_bootloader`');
    expect(stub).toContain('`skill_name: "example-skill"`');
    expect(stub).toContain('`reactive-skills-axi bootloader example-skill --json`');
    expect(stub).toContain('`npx -y @reactive-skills/axi bootloader example-skill --json`');
    expect(stub).toMatch(/read all.*alternatives.*first.*works/i);
    expect(stub).toMatch(/no installation.*Node\.js >=22\.13\.0/i);
    expect(stub).toMatch(/must not skip.*too heavy.*not installed/i);
    expect(stub).toMatch(/none.*(?:stop|halt).*tell the user.*(?:prerequisite|failure)/i);
    expect(stub).toMatch(/do not proceed without (?:using )?(?:the|this) skill/i);
    expect(stub).not.toMatch(/(?:retrieval.*unavailable|none.*(?:run|work)).*(?:continue|proceed with\b)/i);
    expect(stub).not.toContain('continue with the directly requested runtime path');
  });

  it('explains progressive disclosure before runtime policy and keeps routing fallback within the skill', () => {
    const instructions = getReactiveBootloader('example-skill').instructions;
    const start = instructions.slice(0, instructions.indexOf('**REACTIVE SKILL:'));

    expect(start).toMatch(/start here/i);
    expect(start).toMatch(/reference.*(?:do not|don't) need to read.*up front/i);
    expect(start).toMatch(/one state at a time.*current state/i);
    expect(start).toMatch(/policy.*only when.*(?:situation|applies)/i);
    expect(instructions).toMatch(/route is `none`.*Jev is unavailable.*wrapper fails/);
    expect(instructions).toContain('invoke or resume this skill through the selected runtime');
    expect(instructions).not.toContain('continue the directly requested runtime path');
  });

  it('returns versioned runtime instructions for a skill', () => {
    const payload = getReactiveBootloader('example-skill');

    expect(payload.skill).toBe('example-skill');
    expect(payload.bootloader_version).toBe('1.0.1');
    expect(payload.instructions).toContain('reactive_context_prepare');
    expect(payload.instructions).toContain('[{"id":"...","skill":"...","summary":"..."}]');
  });

  it('replaces copied bootloader blocks with the stable runtime reference', () => {
    const legacy = `---\nname: example-skill\n---\n\n<!-- REACTIVE BOOTLOADER -->\nold instructions\n<!-- END REACTIVE BOOTLOADER -->\n\n# Skill`;
    const updated = ensureReactiveBootloaderReference(legacy, 'example-skill');

    expect(updated).toContain(createReactiveBootloaderReference('example-skill'));
    expect(updated).not.toContain('old instructions');
    expect(updated).toContain('# Skill');
  });
});

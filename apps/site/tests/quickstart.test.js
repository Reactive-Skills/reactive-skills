import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { quickstart } from '@/infrastructure/content/docs/quickstart';

const readEngines = (relativePath) =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')).engines.node;

const NODE_FLOOR = '22.13';
const numberedSections = quickstart.sections.filter((section) => /^\d+\.\s/.test(section.heading));
const blocksOf = (section) => section.blocks || [];

describe('quickstart', () => {
  it('opens with installing and running a published skill', () => {
    const commands = blocksOf(numberedSections[0]).filter((block) => block.type === 'code').map((block) => block.example.command);
    expect(commands.some((command) => /^npx skills add Reactive-Skills\/skills --skill \S+ -g$/.test(command))).toBe(true);
    expect(commands.some((command) => /@reactive-skills\/axi invoke \S+/.test(command))).toBe(true);
  });

  it('warns about trusting skill guard code before the install command', () => {
    const blocks = blocksOf(numberedSections[0]);
    const noteIndex = blocks.findIndex((block) => block.type === 'callout' && /trust/i.test(block.title));
    const installIndex = blocks.findIndex((block) => block.type === 'code' && /^npx skills add /.test(block.example.command));
    expect(noteIndex).toBeGreaterThanOrEqual(0);
    expect(noteIndex).toBeLessThan(installIndex);
    const { text } = blocks[noteIndex];
    expect(text).toContain('SECURITY.md');
    expect(text).toMatch(/guard/);
    expect(text).toMatch(/does not sandbox/);
    expect(text).not.toMatch(/(?<!not )(sandboxed|vetted)\b/);
  });

  it('states the Node floor declared by both package engines', () => {
    expect(readEngines('../../axi/package.json')).toBe(`>=${NODE_FLOOR}.0`);
    expect(readEngines('../../../packages/runtime/package.json')).toBe(`>=${NODE_FLOOR}.0`);
    const prereqText = blocksOf(quickstart.sections.find((section) => section.id === 'prereqs'))
      .map((block) => block.text || block.example?.explanation || '')
      .join(' ');
    expect(prereqText).toContain(`Node.js ${NODE_FLOOR} or newer`);
  });
});

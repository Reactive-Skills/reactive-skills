import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { quickstart } from '@/infrastructure/content/docs/quickstart';

const readEngines = (relativePath) =>
  JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')).engines.node;

const NODE_FLOOR = '22.13';
const numberedSections = quickstart.sections.filter((section) => /^\d+\.\s/.test(section.heading));
const blocksOf = (section) => section.blocks || [];
const codeExamples = quickstart.sections.flatMap(blocksOf).filter((block) => block.type === 'code').map((block) => block.example);

describe('quickstart', () => {
  it('opens with installing and running a published skill', () => {
    const commands = blocksOf(numberedSections[0]).filter((block) => block.type === 'code').map((block) => block.example.command);
    expect(commands.some((command) => /^npx skills add Reactive-Skills\/skills --skill \S+ -g$/.test(command))).toBe(true);
    expect(commands.some((command) => /@reactive-skills\/axi invoke \S+/.test(command))).toBe(true);
  });

  it('states the Node floor declared by both package engines', () => {
    expect(readEngines('../../axi/package.json')).toBe(`>=${NODE_FLOOR}.0`);
    expect(readEngines('../../../packages/runtime/package.json')).toBe(`>=${NODE_FLOOR}.0`);
    const prereqText = blocksOf(quickstart.sections.find((section) => section.id === 'prereqs'))
      .map((block) => block.text || block.example?.explanation || '')
      .join(' ');
    expect(prereqText).toContain(`Node.js ${NODE_FLOOR} or newer`);
  });

  it('passes the events limit positionally, as the CLI parses it', () => {
    const eventsCommands = codeExamples.map((example) => example.command).filter((command) => /\/axi events /.test(command));
    expect(eventsCommands.length).toBeGreaterThan(0);
    for (const command of eventsCommands) {
      expect(command).toMatch(/\/axi events \d+ \S+$/);
    }
  });

  it('shows the states that init scaffolds for my-feature-flow', () => {
    const outputs = codeExamples.filter((example) => example.command.includes('my-feature-flow')).map((example) => example.expectedOutput || '');
    for (const output of outputs) {
      expect(output).not.toMatch(/INTAKE|RED_SPEC/);
    }
    expect(outputs.join('\n')).toContain('previous_state: INIT\n  current_state: START');
  });
});

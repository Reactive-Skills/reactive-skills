import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import HomePage from '@/app/page';
import { SkillDetailView } from '@/features/registry/SkillDetailView';
import { getRegistryContentSource } from '@/infrastructure/container';
import { quickstart } from '@/infrastructure/content/docs/quickstart';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
// Manual operation belongs in docs. Scan authored UI and content, including conditional
// copy that static rendering misses. Technical state names and illustrative demos are fine;
// these patterns target visitor instructions and runnable runtime commands only.
const DOCS_ALLOWLIST = ['app/docs/', 'features/docs/', 'infrastructure/content/docs/'];
const MANUAL_SECTIONS = ['run-it-yourself', 'runtime-selection', 'scaffold', 'inspect', 'emit', 'events'];
const MANUAL_INSTRUCTIONS = [
  /\brun\s+[`'"]?invoke\b/i,
  /\bstep through the state machine\b/i,
  /\bemit (?:a |the )?signal yourself\b/i,
  /\bthen emit (?:the |a )?signal\b/i,
  /\badvance the state machine\b/i,
  /\bdrive this state machine\b/i,
  /\bmanually trigger state transitions\b/i,
  /\bfrom your agent or terminal\b/i,
  /(?:@reactive-skills\/axi(?:@[\w.-]+)?|reactive-skills-axi|\baxi)\s+(?:invoke|emit|state|status|init)\b/i,
];
const filesUnder = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  return entry.isDirectory() ? filesUnder(path) : [path];
});
const violatesRule = (copy) => MANUAL_INSTRUCTIONS.some((pattern) => pattern.test(copy));

describe('agent-first public entry paths', () => {
  it.each([
    'Run invoke to start.',
    'Step through the state machine.',
    'Emit a signal yourself.',
    'Advance the state machine.',
    'npx -y @reactive-skills/axi invoke tdd-refactor',
  ])('rejects manual runtime instructions: %s', (copy) => {
    expect(violatesRule(copy)).toBe(true);
  });

  it('keeps manual runtime instructions inside the docs allowlist', () => {
    const roots = ['app', 'components/site', 'features', 'infrastructure/content/blog', 'infrastructure/content/mods', 'infrastructure/content/landing'];
    const offenders = roots.flatMap((root) => filesUnder(join(SRC, root)))
      .filter((path) => /\.(js|jsx|md)$/.test(path))
      .filter((path) => !DOCS_ALLOWLIST.some((prefix) => relative(SRC, path).startsWith(prefix)))
      .filter((path) => violatesRule(readFileSync(path, 'utf8')))
      .map((path) => relative(SRC, path));
    expect(offenders).toEqual([]);
  });

  it('offers use and create prompts immediately after the hero', () => {
    const html = renderToStaticMarkup(createElement(HomePage));
    expect(html).toContain('Create a skill with your agent');
    expect(html.replace(/<[^>]*>/g, '')).toContain('Use the tdd-refactor skill to');
    expect(html.indexOf('id="start"')).toBeLessThan(html.indexOf('id="runtime"'));
    expect(html).not.toContain('ONE COMMAND. CONNECT YOUR AGENT.');
  });

  it('offers a prompt and installation on every skill page without manual commands', () => {
    const registry = getRegistryContentSource();
    for (const { slug } of registry.listSkills()) {
      const skill = registry.getSkill(slug);
      const html = renderToStaticMarkup(createElement(SkillDetailView, { skill }));
      expect(html).toContain('Ask your agent');
      expect(html).toContain(`--skill ${skill.slug}`);
      expect(violatesRule(html)).toBe(false);
    }
  });

  it('puts both quickstart prompts before explicitly optional manual sections', () => {
    const manualIndex = quickstart.sections.findIndex((section) => section.id === 'run-it-yourself');
    expect(manualIndex).toBeGreaterThan(1);
    for (const id of ['use-published-skill', 'create-a-skill']) {
      const index = quickstart.sections.findIndex((section) => section.id === id);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(manualIndex);
      const copy = JSON.stringify(quickstart.sections[index]);
      expect(copy).toContain('You are done');
      expect(violatesRule(copy)).toBe(false);
    }
    for (const section of quickstart.sections) {
      if (MANUAL_SECTIONS.includes(section.id)) expect(section.heading).toMatch(/optional/i);
    }
    const manual = quickstart.sections.slice(manualIndex);
    expect(JSON.stringify(manual)).toContain('@reactive-skills/axi invoke');
    expect(JSON.stringify(manual)).toContain('@reactive-skills/axi emit');
  });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import HomePage from '@/app/page';
import RegistryPage from '@/app/registry/page';
import ModsPage from '@/app/mods/page';
import BlogPage from '@/app/blog/page';
import { BlogPostView } from '@/features/blog/BlogPostView';
import { SkillCatalog } from '@/features/registry/SkillCatalog';
import { SkillDetailView } from '@/features/registry/SkillDetailView';
import { LiveTelemetryDeck } from '@/features/telemetry/LiveTelemetryDeck';
import { getBlogContentSource, getRegistryContentSource } from '@/infrastructure/container';
import { quickstart } from '@/infrastructure/content/docs/quickstart';

// Screenshots are not copy, and static image imports need the Next bundler.
vi.mock('next/image', () => ({ default: () => null }));

// Manual operation belongs in docs and explicitly optional quickstart sections. Every other
// public surface is checked as rendered output; technical state names and demos are fine.
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
const render = (component, props = {}) => renderToStaticMarkup(createElement(component, props)).replaceAll('<!-- -->', '');
const violatesRule = (copy) => MANUAL_INSTRUCTIONS.some((pattern) => pattern.test(copy));

describe('agent-first public entry paths', () => {
  const registry = getRegistryContentSource();
  const blog = getBlogContentSource();

  it('keeps manual runtime instructions out of rendered non-docs surfaces', () => {
    const skill = registry.getSkill(registry.listSkills()[0].slug);
    const surfaces = {
      home: render(HomePage),
      registry: render(RegistryPage),
      emptySearch: render(SkillCatalog, { initialSkills: [], categories: [] }),
      liveTab: render(LiveTelemetryDeck, { skill }),
      mods: render(ModsPage),
      blog: render(BlogPage),
      ...Object.fromEntries(blog.listPosts().map(({ slug }) => [`blog/${slug}`, render(BlogPostView, { post: blog.getPost(slug) })])),
    };
    const offenders = Object.entries(surfaces).filter(([, html]) => violatesRule(html)).map(([name]) => name);
    expect(offenders).toEqual([]);
  });

  it('offers skill-manager from the empty registry search', () => {
    const html = render(SkillCatalog, { initialSkills: [], categories: [] });
    expect(html).toContain('/docs/quickstart#create-a-skill');
    expect(html).toContain('Ask your agent');
  });

  it('keeps the live tab gate response next to an agent prompt', () => {
    const skill = registry.getSkill(registry.listSkills()[0].slug);
    const html = render(LiveTelemetryDeck, { skill }).replace(/<[^>]*>/g, '');
    expect(html).toContain(`Use the ${skill.slug} skill to [describe your task].`);
    expect(html).toContain('Respond to a Paused Gate');
    expect(html).toContain('Send Response to Agent');
  });

  it('offers use and create prompts immediately after the hero', () => {
    const html = renderToStaticMarkup(createElement(HomePage));
    expect(html).toContain('Create a skill with your agent');
    expect(html.replace(/<[^>]*>/g, '')).toContain('Use the tdd-refactor skill to');
    expect(html.indexOf('id="start"')).toBeLessThan(html.indexOf('id="runtime"'));
    expect(html).not.toContain('ONE COMMAND. CONNECT YOUR AGENT.');
  });

  it('offers a prompt and installation on every skill page without manual commands', () => {
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

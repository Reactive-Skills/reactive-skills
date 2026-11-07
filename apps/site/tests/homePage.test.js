import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import HomePage from '@/app/page';
import { getRegistryContentSource } from '@/infrastructure/container';

describe('home page', () => {
  const markup = renderToStaticMarkup(createElement(HomePage)).replaceAll('<!-- -->', '');
  const registry = getRegistryContentSource();

  it('states the workflow and state counts of the build-time registry', () => {
    const { skillCount, stateCount } = registry.getStats();
    expect(markup).toContain(`${skillCount} workflows.`);
    expect(markup).toContain(`${stateCount} explicit states.`);
  });

  it('links every published workflow to its registry page', () => {
    const linked = new Set([...markup.matchAll(/href="\/registry\/([a-z0-9-]+)\/?"/g)].map((match) => match[1]));
    expect([...linked].sort()).toEqual(registry.listSkills().map((skill) => skill.slug).sort());
  });
});

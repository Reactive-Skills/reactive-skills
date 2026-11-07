import { existsSync } from 'node:fs';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { docPageList } from '@/infrastructure/content/docs';
import { DocPageView } from '@/features/docs/DocPageView';
import { CodeBlock } from '@/components/common/CodeBlock';

const escaped = (text) => renderToStaticMarkup(createElement(Fragment, null, text));

describe('docs page markup', () => {
  it.each(docPageList.map((page) => [page.slug, page]))('%s renders its eyebrow, first heading and page index', (_slug, page) => {
    const html = renderToStaticMarkup(createElement(DocPageView, { page }));
    expect(html).toContain(`>${escaped(page.category)}</p>`);
    expect(html).toMatch(new RegExp(`<h2[^>]*>${escaped(page.sections[0].heading).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h2>`));
    if (page.sections.length > 1) expect(html).toContain('aria-label="On this page"');
  });

  // A route-level loading.js wraps the page in a Suspense boundary, and the static export
  // then ships the skeleton first with the real docs hidden until JavaScript swaps them in.
  it.each(['../src/app', '../src/app/docs'])('%s has no loading fallback', (dir) => {
    for (const ext of ['js', 'jsx', 'tsx']) {
      expect(existsSync(new URL(`${dir}/loading.${ext}`, import.meta.url))).toBe(false);
    }
  });
});

describe('CodeBlock', () => {
  const render = (example) => renderToStaticMarkup(createElement(CodeBlock, { example }));

  it('prompts each shell line and keeps the prompt out of selection', () => {
    const html = render({ language: 'bash', command: 'a\nb' });
    expect(html.match(/select-none[^>]*aria-hidden="true">\$ </g)).toHaveLength(2);
  });

  it('shows no prompt for non-shell examples', () => {
    expect(render({ language: 'text', command: '/plugin install x' })).not.toContain('$ ');
  });
});

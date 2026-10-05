import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DocSections } from '@/features/docs/DocPageView';

const sections = [
  {
    id: 'intro',
    heading: 'Intro',
    blocks: [
      { type: 'text', text: 'Body copy.' },
      { type: 'list', items: ['First point'] },
    ],
  },
];

const PRE_BLOG_VARIANT_DOCS_MARKUP =
  '<div><section id="intro" class="scroll-mt-24 pt-8 first:pt-0"><h2 class="font-display text-xl font-semibold tracking-tight text-phino-text sm:text-2xl">Intro</h2><p class="my-4 text-[15px] leading-7 text-phino-text-muted">Body copy.</p><ul class="my-4 space-y-2"><li class="flex gap-2.5 text-[15px] leading-7 text-phino-text-muted"><span class="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-phino-signal" aria-hidden="true"></span><span>First point</span></li></ul></section></div>';

function render(variant) {
  return renderToStaticMarkup(createElement(DocSections, { sections, variant }));
}

describe('DocSections prose variants', () => {
  it('renders docs pages with the same markup as before the blog variant existed', () => {
    expect(render(undefined)).toBe(PRE_BLOG_VARIANT_DOCS_MARKUP);
    expect(render('docs')).toBe(PRE_BLOG_VARIANT_DOCS_MARKUP);
  });

  it('renders blog body text differently from docs', () => {
    expect(render('blog')).not.toBe(render(undefined));
  });
});

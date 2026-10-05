import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DocSections } from '@/features/docs/DocPageView';

const textBlock = { type: 'text', text: 'Body copy.' };
const listBlock = { type: 'list', items: ['First point'] };
const stepsBlock = { type: 'steps', steps: [{ title: 'Step one', text: 'Do the thing.' }] };

const sections = [
  {
    id: 'intro',
    heading: 'Intro',
    blocks: [textBlock, listBlock, stepsBlock],
  },
];

const PRE_BLOG_VARIANT_DOCS_MARKUP =
  '<div><section id="intro" class="scroll-mt-24 pt-8 first:pt-0"><h2 class="font-display text-xl font-semibold tracking-tight text-phino-text sm:text-2xl">Intro</h2><p class="my-4 text-[15px] leading-7 text-phino-text-muted">Body copy.</p><ul class="my-4 space-y-2"><li class="flex gap-2.5 text-[15px] leading-7 text-phino-text-muted"><span class="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-phino-signal" aria-hidden="true"></span><span>First point</span></li></ul><ol class="my-5 space-y-4"><li class="flex gap-3"><span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-phino-border bg-phino-surface-raised font-mono text-xs text-phino-text">1</span><div><p class="font-display text-sm font-semibold text-phino-text">Step one</p><p class="mt-0.5 text-sm leading-relaxed text-phino-text-muted">Do the thing.</p></div></li></ol></section></div>';

function render(variant, renderedSections = sections) {
  return renderToStaticMarkup(createElement(DocSections, { sections: renderedSections, variant }));
}

describe('DocSections prose variants', () => {
  it('renders docs pages with the same markup as before the blog variant existed', () => {
    expect(render(undefined)).toBe(PRE_BLOG_VARIANT_DOCS_MARKUP);
    expect(render('docs')).toBe(PRE_BLOG_VARIANT_DOCS_MARKUP);
  });

  it.each([
    ['text', textBlock],
    ['list', listBlock],
    ['steps', stepsBlock],
  ])('renders blog %s blocks differently from docs', (_type, block) => {
    const single = [{ id: 'only', heading: 'Only', blocks: [block] }];
    expect(render('blog', single)).not.toBe(render('docs', single));
  });
});

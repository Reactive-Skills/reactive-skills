import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { docPages, docPageList } from '@/infrastructure/content/docs';
import { navigation } from '@/infrastructure/content/navigation';
import { DocBlocks, DocPageView } from '@/features/docs/DocPageView';
import sitemap from '@/app/sitemap';
import { absoluteUrl } from '@/infrastructure/siteMetadata';

const href = '/docs/reference/guards-and-deliverables';
const reference = () => docPages['reference/guards-and-deliverables'];

describe('guards and deliverables reference', () => {
  it('registers the reference in content, navigation and sitemap', () => {
    expect(reference()?.title).toBe('Guards, judgments and deliverables reference');
    expect(docPageList).toContain(reference());
    expect(navigation.groups.find((group) => group.title === 'Reference').links)
      .toContainEqual({ title: 'Guards, judgments and deliverables', href });
    expect(sitemap()).toContainEqual({ url: absoluteUrl(href) });
  });

  it('keeps authoring anchors and links the short checks section to reference', () => {
    expect(docPages.authoring.sections.map((section) => section.id)).toEqual([
      'skill-manager', 'terminal-scaffolding', 'beyond-scaffold', 'package-structure',
      'two-paths', 'agent-guided', 'manifest-customization', 'prompt-slices',
      'guards-and-deliverables', 'judgment-thresholds', 'inspection-verification', 'distribute-sync',
    ]);
    const section = docPages.authoring.sections.find((item) => item.id === 'guards-and-deliverables');
    expect(section.heading).toBe('4. Checks and generated deliverables');
    expect(section.blocks.some((block) => block.type === 'list')).toBe(false);
    const html = renderToStaticMarkup(createElement(DocPageView, { page: docPages.authoring }));
    expect(html).toContain(`href="${href}"`);
    expect(html).toContain('<strong>Guards, judgments and deliverables reference</strong>');
    expect(html).toContain(`href="${href}#judgment-thresholds"`);
    for (const item of docPages.authoring.sections) expect(html).toContain(`id="${item.id}"`);
  });

  it('preserves named reference destinations and the threshold conversion table', () => {
    expect(reference()?.sections.map((section) => section.id)).toEqual([
      'exact-expressions', 'judgment-declaration-and-adapters', 'context-sent-to-a-model',
      'rejected-judgment-versus-unavailable-judge', 'a-person-decides-an-unevaluable-gate',
      'explicit-self-report-permission', 'model-capability-hints', 'custom-guard-modules',
      'useful-refusal-messages', 'contract-documents-versus-enforcement',
      'generated-deliverables', 'judgment-thresholds',
    ]);
    const thresholds = reference()?.sections.find((section) => section.id === 'judgment-thresholds');
    expect(thresholds?.blocks.find((block) => block.type === 'table').rows).toEqual([
      ['0.6', '0.80', '0.8'], ['0.7', '0.85', '0.85'], ['0.75 (default)', '0.875', '0.875'],
      ['0.85', '0.925', '0.925'], ['0.9', '0.95', '0.95'],
    ]);
    if (reference()) {
      const html = renderToStaticMarkup(createElement(DocPageView, { page: reference() }));
      for (const section of reference().sections) {
        expect(html).toContain(`id="${section.id}"`);
        expect(html).toContain(`href="#${section.id}"`);
      }
    }
  });
});

describe('docs inline links', () => {
  const render = (text) => renderToStaticMarkup(createElement(DocBlocks, { blocks: [{ type: 'text', text }] }));

  it('renders emphasized internal links in the current tab', () => {
    const html = render(`See **[Reference](${href}#exact-expressions)** and [Authoring](/docs/authoring).`);
    expect(html).toContain(`href="${href}#exact-expressions"`);
    expect(html).toContain('<strong>Reference</strong>');
    expect(html).toContain('href="/docs/authoring"');
    expect(html).not.toContain('target="_blank"');
  });

  it('keeps external links and inline code while leaving unsafe links as text', () => {
    const html = render('[Source](https://example.com/reference) `guard` [Unsafe](javascript:alert) [Network](//example.com)');
    expect(html).toContain('href="https://example.com/reference" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('>guard</code>');
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('href="//');
  });
});

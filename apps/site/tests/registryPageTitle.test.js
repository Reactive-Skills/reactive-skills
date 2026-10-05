import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RegistryPage, { metadata } from '@/app/registry/page';

describe('registry page', () => {
  it('uses the visible heading as the page title', () => {
    const markup = renderToStaticMarkup(createElement(RegistryPage));
    const heading = markup.match(/<h1\b[^>]*>([^<]+)<\/h1>/)?.[1];
    expect(heading).toBeDefined();
    expect(metadata.title).toBe(heading);
  });
});

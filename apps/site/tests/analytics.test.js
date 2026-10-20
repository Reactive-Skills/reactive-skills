import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import RootLayout from '@/app/layout';

vi.mock('@/app/providers', () => ({ Providers: ({ children }) => children }));
vi.mock('@/components/site/SiteHeader', () => ({ SiteHeader: () => null }));

describe('site analytics', () => {
  it('mounts one deferred page-view tracker with the production host and privacy controls', () => {
    const markup = renderToStaticMarkup(createElement(RootLayout, null, 'Page'));
    const trackers = markup.match(/<script\b[^>]*data-website-id[^>]*><\/script>/g) ?? [];

    expect(trackers).toHaveLength(1);
    const tag = trackers[0];
    expect(tag).toContain('src="https://umami-production-abb4.up.railway.app/script.js"');
    expect(tag).toContain('data-website-id="43a9ee28-b659-451f-b42d-6c07cc36c6f5"');
    expect(tag).toContain('data-domains="reactive-skills.com"');
    expect(tag).toContain('data-do-not-track="true"');
    expect(tag).toContain('defer=""');
    expect(tag).not.toMatch(/data-(?:host-url|distinct-id|tag|performance|umami-event)/);
    const sources = [...markup.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]);
    expect(sources).toEqual(['https://umami-production-abb4.up.railway.app/script.js']);
  });
});

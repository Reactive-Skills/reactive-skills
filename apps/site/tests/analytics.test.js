import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import RootLayout from '@/app/layout';
import PrivacyPage from '@/app/privacy/page';
import { ANALYTICS } from '@/lib/analytics';

vi.mock('@/app/providers', () => ({ Providers: ({ children }) => children }));
vi.mock('@/components/site/SiteHeader', () => ({ SiteHeader: () => null }));

// Every hostname that serves the public site, canonical first. A hostname missing from
// data-domains silently drops that host's page views, so it belongs in this table.
const SERVING_HOSTNAMES = ['reactive-skills.com', 'www.reactive-skills.com', 'reactive-skills.github.io'];

describe('site analytics', () => {
  const markup = renderToStaticMarkup(createElement(RootLayout, null, 'Page'));

  it('restricts page views to exactly the hostnames that serve the site', () => {
    expect(ANALYTICS.domains).toEqual(SERVING_HOSTNAMES);
  });

  it('mounts one deferred page-view tracker with the production host and privacy controls', () => {
    const trackers = markup.match(/<script\b[^>]*data-website-id[^>]*><\/script>/g) ?? [];

    expect(trackers).toHaveLength(1);
    const tag = trackers[0];
    expect(tag).toContain('src="https://umami-production-abb4.up.railway.app/script.js"');
    expect(tag).toContain('data-website-id="43a9ee28-b659-451f-b42d-6c07cc36c6f5"');
    expect(tag).toContain(`data-domains="${SERVING_HOSTNAMES.join(',')}"`);
    expect(tag).toContain('data-do-not-track="true"');
    expect(tag).toContain('defer=""');
    expect(tag).not.toMatch(/data-(?:host-url|distinct-id|tag|performance|umami-event)/);
    const sources = [...markup.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]);
    expect(sources).toEqual(['https://umami-production-abb4.up.railway.app/script.js']);
  });

  it('names every tracked hostname in the privacy disclosure', () => {
    const privacy = renderToStaticMarkup(createElement(PrivacyPage));

    for (const hostname of SERVING_HOSTNAMES) {
      expect(privacy).toContain(hostname);
    }
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

const ENV_KEYS = ['NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_ROOT_SITE', 'NEXT_PUBLIC_BASE_PATH', 'GITHUB_PAGES', 'CI'];

async function loadSiteMetadata(env) {
  for (const key of ENV_KEYS) vi.stubEnv(key, env[key]);
  vi.resetModules();
  return import('../src/infrastructure/siteMetadata.js');
}

describe('siteMetadata', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults the site origin to the custom domain the site is served from', async () => {
    const { siteOrigin, absoluteUrl } = await loadSiteMetadata({ NEXT_PUBLIC_ROOT_SITE: 'true' });
    expect(siteOrigin).toBe('https://reactive-skills.com');
    expect(absoluteUrl('/sitemap.xml')).toBe('https://reactive-skills.com/sitemap.xml');
  });

  it('honors NEXT_PUBLIC_SITE_URL when it is set', async () => {
    const { siteOrigin } = await loadSiteMetadata({
      NEXT_PUBLIC_SITE_URL: 'https://example.test',
      NEXT_PUBLIC_ROOT_SITE: 'true',
    });
    expect(siteOrigin).toBe('https://example.test');
  });

  it.each([
    ['local build', {}],
    ['CI build', { CI: 'true' }],
    ['GitHub Pages build', { GITHUB_PAGES: 'true', CI: 'true' }],
  ])('serves a %s from the site root without an explicit base path', async (_label, env) => {
    const { siteBasePath, absoluteUrl } = await loadSiteMetadata(env);
    expect(siteBasePath).toBe('');
    expect(absoluteUrl('/')).toBe('https://reactive-skills.com/');
    expect(absoluteUrl('/docs')).toBe('https://reactive-skills.com/docs/');
  });

  it('applies a base path only when NEXT_PUBLIC_BASE_PATH sets one', async () => {
    const { absoluteUrl } = await loadSiteMetadata({ NEXT_PUBLIC_BASE_PATH: '/preview' });
    expect(absoluteUrl('/docs')).toBe('https://reactive-skills.com/preview/docs/');
  });
});

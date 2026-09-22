const isGithubPages = process.env.GITHUB_PAGES === 'true' || process.env.CI === 'true';
const defaultSiteUrl = 'https://reactive-skills.github.io';
const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || defaultSiteUrl;
const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH;

export const siteOrigin = new URL(configuredSiteUrl).origin;

export const siteBasePath = (configuredBasePath ?? (isGithubPages ? '/reactive-skills' : ''))
  .replace(/^\/+/, '')
  .replace(/\/+$/, '');

export const siteBaseUrl = new URL(`${siteOrigin}/${siteBasePath}`.replace(/\/$/, '') + '/');

export function absoluteUrl(pathname = '/') {
  const normalizedPath = pathname === '/' ? '' : `/${pathname.replace(/^\/+/, '')}`;
  const url = `${siteOrigin}${siteBasePath ? `/${siteBasePath}` : ''}${normalizedPath}`;
  const isFileUrl = /\.[^/]+$/.test(normalizedPath) || normalizedPath === '/opengraph-image';
  return isFileUrl ? url : `${url}/`.replace(/([^:]\/)\/+$/, '$1');
}

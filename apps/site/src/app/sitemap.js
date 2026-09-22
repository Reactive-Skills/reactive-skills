import { getBlogContentSource, getDocsContentSource, getRegistryContentSource } from '@/infrastructure/container';
import { absoluteUrl } from '@/infrastructure/siteMetadata';

export const dynamic = 'force-static';

export default function sitemap() {
  const docs = getDocsContentSource();
  const registry = getRegistryContentSource();
  const blog = getBlogContentSource();

  const docsRoutes = docs
    .getNavigation()
    .groups
    .flatMap((group) => group.links)
    .map((link) => link.href)
    .filter((href) => href.startsWith('/docs'));

  const routes = new Set([
    '/',
    '/guide',
    '/registry',
    '/blog',
    ...docsRoutes,
    ...registry.listSkills().map((skill) => `/registry/${skill.slug}`),
    ...blog.listPosts().map((post) => `/blog/${post.slug}`),
  ]);

  return Array.from(routes).map((route) => ({
    url: absoluteUrl(route),
  }));
}

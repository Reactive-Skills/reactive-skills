import { absoluteUrl } from '@/infrastructure/siteMetadata';

export const dynamic = 'force-static';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}

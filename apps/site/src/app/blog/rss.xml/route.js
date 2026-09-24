import { getBlogContentSource } from '@/infrastructure/container';
import { absoluteUrl } from '@/infrastructure/siteMetadata';

export const dynamic = 'force-static';

export async function GET() {
  const content = getBlogContentSource();
  const posts = content.listPosts();

  const siteUrl = absoluteUrl('/');

  const rssItems = posts
    .map(
      (post) => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${siteUrl}blog/${post.slug}</link>
      <guid isPermaLink="true">${siteUrl}blog/${post.slug}</guid>
      <description><![CDATA[${post.summary}]]></description>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      <author>${post.author.name}</author>
      ${post.tags.map((t) => `<category>${t}</category>`).join('\n      ')}
    </item>`
    )
    .join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Reactive Skills Architecture Blog</title>
    <link>${siteUrl}blog</link>
    <description>Technical deep-dives into Hierarchical State Machines, deterministic guarding, sub-second micro-decisions, and event-sourced agent architectures.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}blog/rss.xml" rel="self" type="application/rss+xml"/>
    ${rssItems}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}

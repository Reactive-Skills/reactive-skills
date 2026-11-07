import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { DocSections } from '@/features/docs/DocPageView';
import { TableOfContents } from '@/features/docs/TableOfContents';
import { SeriesBanner } from './SeriesBanner';

/**
 * Blog post: back link, title block, series navigation, summary lead, body sections, topics,
 * previous and next posts, and a contents rail on wide screens.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render)
 * - Complexity: O(s) in the s body sections
 * - Cyclomatic Complexity (CC): target <=8
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=16
 */
export function BlogPostView({ post, nextPost, prevPost }) {
  return (
    <div className="container py-12 lg:py-20">
      <div className="xl:grid xl:grid-cols-[minmax(0,48rem)_240px] xl:justify-center xl:gap-16">
        <article className="mx-auto min-w-0 max-w-3xl xl:mx-0">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-phino-text-muted transition-colors hover:text-phino-text"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Blog</span>
          </Link>

          <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.2em] text-phino-signal-text">{post.category}</p>
          <h1 className="mt-4 font-display text-4xl font-medium leading-[1.1] tracking-tight text-phino-text [text-wrap:balance] sm:text-5xl">
            {post.title}
          </h1>

          {post.subtitle && (
            <p className="mt-4 text-lg text-phino-text-muted sm:text-xl">{post.subtitle}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-phino-border pt-4 font-mono text-xs text-phino-text-subtle">
            <span className="font-sans text-sm text-phino-text">{post.author.name}</span>
            <span aria-hidden="true">/</span>
            <time dateTime={post.publishedAt}>{post.publishedAt}</time>
            <span aria-hidden="true">/</span>
            <span>{post.readTime}</span>
          </div>

          {/* Series Banner if present */}
          {post.series && <SeriesBanner series={post.series} />}

          {/* Article Summary Lead */}
          <div className="my-10 border-l-2 border-phino-signal pl-5">
            <p className="text-lg leading-relaxed text-phino-text">
              {post.summary}
            </p>
          </div>

          {/* Main Body Sections */}
          <div>
            <DocSections sections={post.sections} variant="blog" />
          </div>

          {post.tags.length > 0 && (
            <ul className="mt-12 flex flex-wrap gap-2" aria-label="Topics">
              {post.tags.map((tag) => (
                <li key={tag} className="rounded border border-phino-border px-2 py-0.5 font-mono text-[11px] text-phino-text-subtle">
                  #{tag}
                </li>
              ))}
            </ul>
          )}

          {/* Post Footer Navigation */}
          <hr className="my-12 border-phino-border" />

          <div className="grid gap-4 sm:grid-cols-2">
            {prevPost ? (
              <Link
                href={`/blog/${prevPost.slug}`}
                className="group flex min-w-0 flex-col items-start gap-1.5 rounded-lg border border-phino-border p-5 transition-colors hover:border-phino-signal hover:bg-phino-surface"
              >
                <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-phino-text-subtle">
                  <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
                  Previous Article
                </span>
                <span className="font-display text-base text-phino-text transition-colors group-hover:text-phino-signal-text">
                  {prevPost.title}
                </span>
              </Link>
            ) : null}

            {nextPost ? (
              <Link
                href={`/blog/${nextPost.slug}`}
                className="group flex min-w-0 flex-col items-end gap-1.5 rounded-lg border border-phino-border p-5 text-right transition-colors hover:border-phino-signal hover:bg-phino-surface sm:col-start-2"
              >
                <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-phino-text-subtle">
                  Next Article
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
                <span className="font-display text-base text-phino-text transition-colors group-hover:text-phino-signal-text">
                  {nextPost.title}
                </span>
              </Link>
            ) : null}
          </div>
        </article>

        {/* Sidebar Table of Contents */}
        {post.sections && post.sections.length > 1 && (
          <aside className="hidden xl:block">
            <div className="sticky top-24 pt-4">
              <TableOfContents sections={post.sections} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

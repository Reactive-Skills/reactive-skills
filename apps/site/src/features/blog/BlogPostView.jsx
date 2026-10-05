import Link from 'next/link';
import { Calendar, Clock, ArrowLeft, ArrowRight } from 'lucide-react';
import { DocSections } from '@/features/docs/DocPageView';
import { TableOfContents } from '@/features/docs/TableOfContents';
import { SeriesBanner } from './SeriesBanner';

export function BlogPostView({ post, nextPost, prevPost }) {
  return (
    <div className="container py-10 sm:py-14">
      <div className="xl:grid xl:grid-cols-[minmax(0,48rem)_240px] xl:justify-center xl:gap-16">
        <article className="mx-auto min-w-0 max-w-3xl xl:mx-0">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-phino-text-muted transition-colors hover:text-phino-text"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Blog</span>
          </Link>

          <h1 className="mt-6 font-display text-3xl font-semibold leading-tight tracking-tight text-phino-text sm:text-4xl lg:text-5xl">
            {post.title}
          </h1>

          {post.subtitle && (
            <p className="mt-3 text-lg font-medium text-phino-text-muted sm:text-xl">{post.subtitle}</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-phino-text-subtle">
            <span className="font-medium text-phino-text">{post.author.name}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-mono">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              {post.publishedAt}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-mono">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {post.readTime}
            </span>
            <span aria-hidden="true">·</span>
            <span>{post.category}</span>
          </div>

          {/* Series Banner if present */}
          {post.series && <SeriesBanner series={post.series} />}

          {/* Article Summary Lead */}
          <div className="my-8 rounded-lg border-l-4 border-phino-signal bg-phino-surface-raised p-4">
            <p className="text-base leading-relaxed text-phino-text font-medium">
              {post.summary}
            </p>
          </div>

          {/* Main Body Sections */}
          <div className="prose prose-invert max-w-none">
            <DocSections sections={post.sections} variant="blog" />
          </div>

          {post.tags.length > 0 && (
            <ul className="mt-12 flex flex-wrap gap-2" aria-label="Topics">
              {post.tags.map((tag) => (
                <li key={tag} className="rounded border border-phino-border/60 bg-phino-surface-raised px-2 py-0.5 font-mono text-[11px] text-phino-text-subtle">
                  #{tag}
                </li>
              ))}
            </ul>
          )}

          {/* Post Footer Navigation */}
          <hr className="my-12 border-phino-border" />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {prevPost ? (
              <Link
                href={`/blog/${prevPost.slug}`}
                className="group flex flex-col items-start gap-1 rounded-lg border border-phino-border bg-phino-surface p-4 hover:border-phino-border-strong hover:bg-phino-surface-raised transition-colors max-w-sm"
              >
                <span className="inline-flex items-center gap-1 text-xs font-mono uppercase text-phino-text-subtle">
                  <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
                  Previous Article
                </span>
                <span className="text-sm font-semibold text-phino-text group-hover:text-phino-signal-text transition-colors line-clamp-1">
                  {prevPost.title}
                </span>
              </Link>
            ) : <div />}

            {nextPost ? (
              <Link
                href={`/blog/${nextPost.slug}`}
                className="group flex flex-col items-end gap-1 rounded-lg border border-phino-border bg-phino-surface p-4 hover:border-phino-border-strong hover:bg-phino-surface-raised transition-colors max-w-sm text-right"
              >
                <span className="inline-flex items-center gap-1 text-xs font-mono uppercase text-phino-text-subtle">
                  Next Article
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
                <span className="text-sm font-semibold text-phino-text group-hover:text-phino-signal-text transition-colors line-clamp-1">
                  {nextPost.title}
                </span>
              </Link>
            ) : <div />}
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

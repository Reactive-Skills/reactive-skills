'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BlogCard } from './BlogCard';
import { ArrowRight, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

const MIN_POSTS_FOR_TOPIC_FILTER = 8;

export function BlogIndexView({ posts, tags }) {
  const [selectedTag, setSelectedTag] = useState(null);

  const filteredPosts = selectedTag
    ? posts.filter((p) => p.tags.includes(selectedTag))
    : posts;

  const featuredPost = posts.find((p) => p.featured) || posts[0];
  const seriesStart = posts.find((post) => post.series?.part === 1) || null;
  const showTopicFilter = posts.length >= MIN_POSTS_FOR_TOPIC_FILTER && tags?.length > 0;

  return (
    <div className="container py-12 sm:py-16">
      {/* Header section */}
      <div className="max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-phino-signal-text">
          Engineering & Architecture
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-phino-text sm:text-5xl">
          The Reactive Skills Blog
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-phino-text-muted">
          How Reactive Skills works under the hood: state machines for agent workflows, evidence checks, and event-sourced run history.
        </p>
      </div>

      {seriesStart && (
        <Link
          href={`/blog/${seriesStart.slug}`}
          className="group mt-8 flex items-center justify-between gap-4 rounded-xl border border-phino-signal/40 bg-phino-surface-raised p-5 transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-phino-signal/40 bg-phino-signal/15 text-phino-signal-text">
              <Layers className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-phino-signal-text">
                {seriesStart.series.total}-part series
              </span>
              <h2 className="font-display text-lg font-semibold text-phino-text">{seriesStart.series.title}</h2>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-phino-signal-text">
            Start with Part 1 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </Link>
      )}

      {/* Tag filter chips */}
      {showTopicFilter && (
        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-phino-text-subtle mr-2">Filter by topic:</span>
          <button
            type="button"
            onClick={() => setSelectedTag(null)}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
              selectedTag === null
                ? 'bg-phino-text text-phino-canvas'
                : 'border border-phino-border bg-phino-surface text-phino-text-muted hover:border-phino-border-strong hover:text-phino-text'
            )}
          >
            All Articles ({posts.length})
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors font-mono',
                selectedTag === tag
                  ? 'bg-phino-text text-phino-canvas'
                  : 'border border-phino-border bg-phino-surface text-phino-text-muted hover:border-phino-border-strong hover:text-phino-text'
              )}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Post Grid */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {filteredPosts.map((post) => (
          <BlogCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}

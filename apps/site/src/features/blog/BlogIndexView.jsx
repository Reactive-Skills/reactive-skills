'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BlogCard } from './BlogCard';
import { ArrowRight, Layers } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';

const MIN_POSTS_FOR_TOPIC_FILTER = 8;

/**
 * Blog index: page header, series entry point, optional topic filter and the post list.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render; the topic filter is client state)
 * - Complexity: O(n) in the n posts
 * - Cyclomatic Complexity (CC): target <=5
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=10
 */
export function BlogIndexView({ posts, tags }) {
  const [selectedTag, setSelectedTag] = useState(null);

  const filteredPosts = selectedTag
    ? posts.filter((p) => p.tags.includes(selectedTag))
    : posts;

  const seriesStart = posts.find((post) => post.series?.part === 1) || null;
  const showTopicFilter = posts.length >= MIN_POSTS_FOR_TOPIC_FILTER && tags?.length > 0;

  const chip =
    'rounded-full border border-phino-border px-3.5 py-1 font-mono text-[11px] text-phino-text-muted transition-colors hover:text-phino-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus aria-pressed:border-phino-signal aria-pressed:bg-phino-signal aria-pressed:text-phino-signal-on';

  return (
    <div className="container py-12 lg:py-20">
      <PageHeader eyebrow="Blog" title="The Reactive Skills Blog">
        <p>How Reactive Skills works under the hood: state machines for agent workflows, evidence checks, and event-sourced run history.</p>
      </PageHeader>

      {seriesStart && (
        <Link
          href={`/blog/${seriesStart.slug}`}
          className="group mt-12 flex flex-col gap-3 rounded-lg border border-phino-border bg-phino-surface p-5 transition-colors hover:border-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus sm:flex-row sm:items-center sm:justify-between sm:gap-6"
        >
          <div className="flex items-start gap-3">
            <Layers className="mt-1 h-4 w-4 shrink-0 text-phino-signal-text" aria-hidden="true" />
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-phino-signal-text">
                {seriesStart.series.total}-part series
              </span>
              <h2 className="mt-1 font-display text-lg font-medium text-phino-text">{seriesStart.series.title}</h2>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 pl-7 text-sm text-phino-signal-text sm:pl-0">
            Start with Part 1 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </Link>
      )}

      {showTopicFilter && (
        <div className="mt-10 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by topic">
          <span className="mr-2 font-mono text-xs text-phino-text-subtle">Filter by topic:</span>
          <button type="button" aria-pressed={selectedTag === null} onClick={() => setSelectedTag(null)} className={chip}>
            All Articles ({posts.length})
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              type="button"
              aria-pressed={selectedTag === tag}
              onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
              className={chip}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <ol className="mt-12 border-t border-phino-border">
        {filteredPosts.map((post) => (
          <li key={post.slug}>
            <BlogCard post={post} />
          </li>
        ))}
      </ol>
    </div>
  );
}

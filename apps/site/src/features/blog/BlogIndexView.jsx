'use client';

import { useState } from 'react';
import { BlogCard } from './BlogCard';
import { Layers, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BlogIndexView({ posts, tags }) {
  const [selectedTag, setSelectedTag] = useState(null);

  const filteredPosts = selectedTag
    ? posts.filter((p) => p.tags.includes(selectedTag))
    : posts;

  const featuredPost = posts.find((p) => p.featured) || posts[0];

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
          Technical deep-dives into Hierarchical State Machines, deterministic guarding, sub-second micro-decisions, and event-sourced agent architectures.
        </p>
      </div>

      {/* Series Spotlight Banner */}
      <div className="mt-10 rounded-xl border border-phino-signal/40 bg-phino-surface-raised p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-phino-signal/40 bg-phino-signal/15 text-phino-signal-text">
              <Layers className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-phino-signal-text">
                Featured Launch Series
              </span>
              <h2 className="font-display text-lg font-semibold text-phino-text">
                The Reactive Agentic Runtime (2-Part Series)
              </h2>
              <p className="text-sm text-phino-text-muted mt-1">
                From passive monolithic prompts to Hierarchical State Machines and sub-second semantic micro-decisions with TypeSafe Jev.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tag filter chips */}
      {tags && tags.length > 0 && (
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

import Link from 'next/link';
import { ArrowRight, Clock, Calendar, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BlogCard({ post, className }) {
  return (
    <article
      className={cn(
        'group relative flex flex-col justify-between rounded-xl border p-6 transition-all duration-150',
        post.featured
          ? 'border-phino-signal/50 bg-gradient-to-b from-phino-surface via-phino-surface to-phino-surface-raised ring-1 ring-phino-signal/25 hover:border-phino-signal'
          : 'border-phino-border bg-phino-surface hover:border-phino-border-strong hover:bg-phino-surface-raised',
        className
      )}
    >
      <div>
        {/* Badges and metadata */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-phino-border bg-phino-canvas px-2.5 py-0.5 font-medium text-phino-text-muted">
              {post.category}
            </span>
            {post.series && (
              <span className="inline-flex items-center gap-1 rounded-md bg-phino-signal/15 px-2 py-0.5 font-semibold text-phino-signal-text border border-phino-signal/30 font-mono">
                <Layers className="h-3 w-3" aria-hidden="true" />
                Part {post.series.part}/{post.series.total}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-phino-text-subtle font-mono text-[11px]">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              {post.publishedAt}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {post.readTime}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="mt-4 font-display text-xl font-semibold tracking-tight text-phino-text group-hover:text-phino-signal-text transition-colors">
          <Link href={`/blog/${post.slug}`} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus rounded-md">
            <span className="absolute inset-0 rounded-xl" aria-hidden="true" />
            {post.title}
          </Link>
        </h3>

        {/* Subtitle / summary */}
        <p className="mt-2 text-sm leading-relaxed text-phino-text-muted line-clamp-3">
          {post.summary}
        </p>

        {/* Tags */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {post.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded bg-phino-surface-raised px-2 py-0.5 font-mono text-[11px] text-phino-text-subtle border border-phino-border/60"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Footer link */}
      <div className="mt-6 flex items-center justify-between border-t border-phino-border pt-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-phino-text">{post.author.name}</span>
          <span className="text-xs text-phino-text-subtle">({post.author.role})</span>
        </div>

        <span className="inline-flex items-center gap-1 text-xs font-semibold text-phino-signal-text group-hover:translate-x-0.5 transition-transform">
          Read article <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

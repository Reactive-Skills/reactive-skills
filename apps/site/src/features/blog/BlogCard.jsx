import Link from 'next/link';
import { ArrowRight, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * One post as a row of the blog index: date and read time, title, summary, topics and author.
 * The whole row links to the post.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render)
 * - Complexity: O(1) (at most four topic tags)
 * - Cyclomatic Complexity (CC): target <=3
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=6
 */
export function BlogCard({ post, className }) {
  return (
    <article
      className={cn(
        'group relative grid gap-3 border-b border-phino-border py-8 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-8 lg:grid-cols-[9rem_minmax(0,1fr)_17rem] lg:gap-x-12',
        className,
      )}
    >
      <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-phino-text-subtle sm:flex-col sm:pt-1.5">
        <time dateTime={post.publishedAt} className={post.featured ? 'text-phino-signal-text' : undefined}>{post.publishedAt}</time>
        <span>{post.readTime}</span>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em]">
          <span className="text-phino-signal-text">{post.category}</span>
          {post.series && (
            <span className="inline-flex items-center gap-1 normal-case tracking-normal text-phino-text-muted">
              <Layers className="h-3 w-3" aria-hidden="true" />
              Part {post.series.part}/{post.series.total}
            </span>
          )}
        </div>

        <h2 className="mt-3 font-display text-2xl font-medium tracking-tight text-phino-text transition-colors group-hover:text-phino-signal-text">
          <Link href={`/blog/${post.slug}`} className="rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus">
            <span className="absolute inset-0" aria-hidden="true" />
            {post.title}
          </Link>
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-phino-text-muted line-clamp-3">{post.summary}</p>
      </div>

      <div className="mt-2 flex min-w-0 flex-col gap-4 sm:col-start-2 lg:col-start-3 lg:mt-0 lg:pt-7">
        <ul className="flex flex-wrap gap-1.5" aria-label="Topics">
          {post.tags.slice(0, 4).map((tag) => (
            <li key={tag} className="rounded border border-phino-border px-2 py-0.5 font-mono text-[11px] text-phino-text-subtle">
              #{tag}
            </li>
          ))}
        </ul>
        <p className="text-xs text-phino-text-muted">
          <span className="text-phino-text">{post.author.name}</span> ({post.author.role})
        </p>
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-phino-signal-text transition-transform group-hover:translate-x-0.5" aria-hidden="true">
          Read article <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </article>
  );
}

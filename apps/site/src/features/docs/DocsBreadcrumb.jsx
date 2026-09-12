import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export function DocsBreadcrumb({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-phino-text-subtle">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.href || item.label} className="flex items-center gap-1.5">
              {item.href && !last ? (
                <Link href={item.href} className="transition-colors hover:text-phino-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus">{item.label}</Link>
              ) : (
                <span className="text-phino-text" aria-current="page">{item.label}</span>
              )}
              {!last ? <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

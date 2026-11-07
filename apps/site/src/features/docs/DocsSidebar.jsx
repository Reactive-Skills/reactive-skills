'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// Static export serves every docs URL with a trailing slash; nav hrefs are written without one.
const samePath = (pathname, href) => (pathname || '').replace(/\/$/, '') === href.replace(/\/$/, '');

/**
 * Grouped docs navigation for wide screens.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render; one pathname comparison per link on the client)
 * - Complexity: O(n) in the n navigation links
 * - Cyclomatic Complexity (CC): target <=3
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=6
 */
export function DocsSidebar({ navigation }) {
  const pathname = usePathname();
  const groups = navigation?.groups || [];

  return (
    <div>
      <Link
        href="/docs"
        className="font-mono text-xs uppercase tracking-[0.2em] text-phino-signal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
      >
        Documentation
      </Link>
      <nav aria-label="Documentation" className="mt-8 space-y-8">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-phino-text-subtle">{group.title}</p>
            <ul className="space-y-2">
              {group.links.map((link) => {
                const active = samePath(pathname, link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'block text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus',
                        active ? 'font-medium text-phino-signal-text' : 'text-phino-text-muted hover:text-phino-signal-text',
                      )}
                    >
                      {link.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}

/**
 * Horizontally scrolling docs links for narrow screens.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render; one pathname comparison per link on the client)
 * - Complexity: O(n) in the n navigation links
 * - Cyclomatic Complexity (CC): target <=3
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=6
 */
export function DocsMobileNav({ navigation }) {
  const pathname = usePathname();
  const links = (navigation?.groups || []).flatMap((g) => g.links);
  return (
    <nav aria-label="Documentation" className="-mx-6 overflow-x-auto border-b border-phino-border px-6 lg:hidden">
      <ul className="flex gap-1 py-2">
        {links.map((link) => {
          const active = samePath(pathname, link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-block whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus',
                  active ? 'bg-phino-signal-soft text-phino-signal-text' : 'text-phino-text-muted hover:bg-phino-surface-raised hover:text-phino-text',
                )}
              >
                {link.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

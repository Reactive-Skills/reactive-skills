'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function DocsSidebar({ navigation }) {
  const pathname = usePathname();
  const groups = navigation?.groups || [];

  return (
    <nav aria-label="Documentation" className="space-y-7">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-phino-text-subtle">{group.title}</p>
          <ul className="space-y-0.5 border-l border-phino-border">
            {group.links.map((link) => {
              const active = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      '-ml-px block border-l-2 py-1.5 pl-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus',
                      active
                        ? 'border-l-phino-signal font-medium text-phino-signal-text'
                        : 'border-l-transparent text-phino-text-muted hover:border-l-phino-border-strong hover:text-phino-text',
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
  );
}

export function DocsMobileNav({ navigation }) {
  const pathname = usePathname();
  const links = (navigation?.groups || []).flatMap((g) => g.links);
  return (
    <div className="-mx-6 overflow-x-auto border-b border-phino-border px-6 lg:hidden">
      <ul className="flex gap-1 py-2">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-block whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors',
                  active ? 'bg-phino-signal-soft text-phino-signal-text' : 'text-phino-text-muted hover:bg-phino-surface-raised hover:text-phino-text',
                )}
              >
                {link.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

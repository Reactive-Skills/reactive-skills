'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, ArrowUpRight } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetClose } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { title: 'Docs', href: '/docs' },
  { title: 'Registry', href: '/registry' },
  { title: 'Mods', href: '/mods' },
  { title: 'Blog', href: '/blog' },
  { title: 'Telemetry', href: '/telemetry' },
];

/**
 * Sticky site header: logo, primary navigation, theme switch, "Get started" and the mobile sheet.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render; client work is the active-link check and the sheet toggle)
 * - Complexity: O(n) in the n = 5 navigation items
 * - Cyclomatic Complexity (CC): target <=6
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=12
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

  return (
    <header className="sticky top-0 z-40 border-b border-phino-border bg-phino-canvas/85 backdrop-blur">
      <div className="container flex h-20 items-center justify-between gap-4">
        <Link href="/" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus',
                isActive(item.href) ? 'text-phino-signal-text' : 'text-phino-text-muted hover:text-phino-text',
              )}
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              {item.title}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/docs/quickstart"
            className="hidden h-9 items-center gap-2 rounded-md bg-phino-signal px-4 text-sm font-medium text-phino-signal-on shadow transition-colors hover:bg-phino-signal/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus focus-visible:ring-offset-2 focus-visible:ring-offset-phino-canvas sm:inline-flex"
          >
            Get started <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="inline-flex size-9 items-center justify-center rounded-md border border-phino-border bg-phino-surface-raised text-phino-text-muted transition-colors hover:border-phino-signal hover:text-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus md:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-4" aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 border-phino-border bg-phino-canvas">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="mb-6 mt-1"><Logo /></div>
              <nav className="flex flex-col gap-1" aria-label="Mobile">
                {NAV.map((item) => (
                  <SheetClose asChild key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive(item.href) ? 'bg-phino-surface-raised text-phino-signal-text' : 'text-phino-text-muted hover:bg-phino-surface-raised hover:text-phino-text',
                      )}
                    >
                      {item.title}
                    </Link>
                  </SheetClose>
                ))}
                <SheetClose asChild>
                  <Link href="/docs/quickstart" className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-phino-signal px-4 text-sm font-medium text-phino-signal-on hover:bg-phino-signal/90">
                    Get started <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

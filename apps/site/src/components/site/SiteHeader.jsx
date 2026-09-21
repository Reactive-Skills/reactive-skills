'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, ArrowRight } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetClose } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

const NAV = [
  { title: 'Quickstart', href: '/docs/quickstart' },
  { title: 'Concepts', href: '/docs/concepts' },
  { title: 'AXI', href: '/docs/axi' },
  { title: 'MCP', href: '/docs/mcp' },
  { title: 'Telemetry', href: '/telemetry' },
  { title: 'Registry', href: '/registry' },
  { title: 'Blog', href: '/blog' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href) => pathname === href || pathname.startsWith(href + '/');

  return (
    <header className="sticky top-0 z-40 border-b border-phino-border bg-phino-canvas backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus" aria-label="Reactive Skills home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus',
                isActive(item.href) ? 'text-phino-text' : 'text-phino-text-muted hover:text-phino-text',
              )}
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              {item.title}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/docs/quickstart"
            className="hidden items-center gap-1.5 rounded-md bg-phino-text px-3.5 py-2 text-sm font-semibold text-phino-canvas transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus focus-visible:ring-offset-2 focus-visible:ring-offset-phino-canvas sm:inline-flex"
          >
            Get started <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-phino-border bg-phino-surface-raised text-phino-text-muted transition-colors hover:text-phino-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus md:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-4.5 w-4.5" style={{ height: '1.1rem', width: '1.1rem' }} aria-hidden="true" />
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
                        isActive(item.href) ? 'bg-phino-surface-raised text-phino-text' : 'text-phino-text-muted hover:bg-phino-surface-raised hover:text-phino-text',
                      )}
                    >
                      {item.title}
                    </Link>
                  </SheetClose>
                ))}
                <SheetClose asChild>
                  <Link href="/docs/quickstart" className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-md bg-phino-text px-3.5 py-2.5 text-sm font-semibold text-phino-canvas">
                    Get started <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
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

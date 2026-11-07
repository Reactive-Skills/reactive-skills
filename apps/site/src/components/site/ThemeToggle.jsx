'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

const subscribe = () => () => {};

/**
 * Light/dark switch backed by next-themes (no flash: the theme class is set before paint).
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render; one click handler on the client)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=4
 * - Branch Coverage: target >=50%
 * - CRAP Score: target <=12
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // true on the client, false during SSR and hydration, so both renders match.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={mounted ? (isDark ? 'Switch to light mode' : 'Switch to dark mode') : 'Toggle theme'}
      className="inline-flex size-9 items-center justify-center rounded-md border border-phino-border bg-phino-surface-raised text-phino-text-muted transition-colors hover:border-phino-signal hover:text-phino-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-phino-focus"
    >
      {mounted && isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}

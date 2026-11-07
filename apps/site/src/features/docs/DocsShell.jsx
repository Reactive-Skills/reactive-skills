import { DocsSidebar, DocsMobileNav } from './DocsSidebar';

/**
 * Docs frame: grouped sidebar on wide screens, a scrolling link strip on narrow ones, page content beside it.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render; the sidebar highlights the current page on the client)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=1
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=2
 */
export function DocsShell({ navigation, children }) {
  return (
    <div className="container py-8 lg:py-16">
      <DocsMobileNav navigation={navigation} />
      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <DocsSidebar navigation={navigation} />
          </div>
        </aside>
        <div className="min-w-0 pt-8 lg:pt-0">{children}</div>
      </div>
    </div>
  );
}

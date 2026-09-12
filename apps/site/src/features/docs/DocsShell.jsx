import { DocsSidebar, DocsMobileNav } from './DocsSidebar';

export function DocsShell({ navigation, children }) {
  return (
    <div className="container py-8 lg:py-12">
      <DocsMobileNav navigation={navigation} />
      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <DocsSidebar navigation={navigation} />
          </div>
        </aside>
        <div className="min-w-0 pt-6 lg:pt-0">{children}</div>
      </div>
    </div>
  );
}

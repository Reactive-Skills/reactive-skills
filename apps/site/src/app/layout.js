import './globals.css';
import { Providers } from './providers';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';

export const metadata = {
  title: {
    default: 'Reactive Skills — an event-driven agent runtime',
    template: '%s · Reactive Skills',
  },
  description:
    'Reactive Skills turns passive agent skills into reactive Hierarchical State Machines — focused prompt slices, typed signals, deterministic guards, immutable event sourcing, MCP integration, and an AXI-oriented CLI.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: 'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);' }} />
      </head>
      <body className="font-sans">
        <Providers>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-phino-text focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-phino-canvas">
            Skip to content
          </a>
          <div className="relative flex min-h-screen flex-col">
            <SiteHeader />
            <main id="main" className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}

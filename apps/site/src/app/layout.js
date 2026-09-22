import './globals.css';
import { Providers } from './providers';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { absoluteUrl, siteBaseUrl } from '@/infrastructure/siteMetadata';

const siteTitle = 'Reactive Skills | Resumable Workflows for Coding Agents';
const siteDescription =
  'Reactive Skills turns passive agent instructions into workflows coding agents can follow, verify, and resume.';
const siteStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${absoluteUrl('/')}#organization`,
      name: 'Reactive Skills',
      url: absoluteUrl('/'),
      description: siteDescription,
    },
    {
      '@type': 'WebSite',
      '@id': `${absoluteUrl('/')}#website`,
      name: 'Reactive Skills',
      url: absoluteUrl('/'),
      publisher: { '@id': `${absoluteUrl('/')}#organization` },
    },
  ],
};

const baseMetadata = {
  metadataBase: siteBaseUrl,
  alternates: {
    canonical: absoluteUrl('/'),
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: absoluteUrl('/'),
    siteName: 'Reactive Skills',
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: absoluteUrl('/opengraph-image'),
        width: 1200,
        height: 630,
        alt: 'Reactive Skills: resumable workflows for coding agents',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
    images: [absoluteUrl('/opengraph-image')],
  },
  robots: {
    index: true,
    follow: true,
  },
  title: {
    default: 'Reactive Skills — an event-driven agent runtime',
    template: '%s · Reactive Skills',
  },
  description:
    'Reactive Skills turns passive agent skills into reactive Hierarchical State Machines — focused prompt slices, typed signals, deterministic guards, immutable event sourcing, MCP integration, and an AXI-oriented CLI.',
};

export const metadata = {
  ...baseMetadata,
  title: {
    default: siteTitle,
    template: '%s | Reactive Skills',
  },
  description: siteDescription,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteStructuredData) }} />
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

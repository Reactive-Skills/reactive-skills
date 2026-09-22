import { GuidePage } from '@/features/guide/GuidePage';
import { absoluteUrl } from '@/infrastructure/siteMetadata';

const guideTitle = 'Guide: Resumable Agent Workflows';
const guideDescription =
  'Learn how to turn passive AI agent instructions into workflows agents can follow, verify, and resume.';
const guideUrl = absoluteUrl('/guide');

export const metadata = {
  title: guideTitle,
  description: guideDescription,
  alternates: {
    canonical: guideUrl,
  },
  openGraph: {
    type: 'article',
    url: guideUrl,
    title: guideTitle,
    description: guideDescription,
    images: [absoluteUrl('/opengraph-image')],
  },
  twitter: {
    card: 'summary_large_image',
    title: guideTitle,
    description: guideDescription,
    images: [absoluteUrl('/opengraph-image')],
  },
};

export default function GuideRoute() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: guideTitle,
    description: guideDescription,
    url: guideUrl,
    inLanguage: 'en-US',
    isPartOf: { '@id': `${absoluteUrl('/')}#website` },
    about: {
      '@type': 'SoftwareApplication',
      name: 'Reactive Skills',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Cross-platform',
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <GuidePage />
    </>
  );
}

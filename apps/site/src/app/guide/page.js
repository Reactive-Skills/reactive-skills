import Link from 'next/link';
import { absoluteUrl } from '@/infrastructure/siteMetadata';

export const metadata = {
  title: 'Guide moved to the homepage',
  robots: { index: false, follow: true },
  alternates: { canonical: absoluteUrl('/') },
};

export default function GuideRedirect() {
  return (
    <div className="container py-20 text-center">
      <meta httpEquiv="refresh" content="0; url=../" />
      <p className="text-phino-text-muted">
        The guide now lives on the{' '}
        <Link href="/" className="font-semibold text-phino-signal-text underline underline-offset-4">
          homepage
        </Link>
        .
      </p>
    </div>
  );
}

import { absoluteUrl } from '@/infrastructure/siteMetadata';

export const metadata = {
  title: 'Privacy',
  description: 'How the Reactive Skills website uses page-view analytics and browser storage.',
  alternates: { canonical: absoluteUrl('/privacy') },
};

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl py-10 sm:py-12">
      <h1 className="font-display text-3xl font-bold text-phino-text sm:text-4xl">Privacy</h1>
      <p className="mt-3 leading-relaxed text-phino-text-muted">
        This page describes analytics and browser storage on the Reactive Skills public website.
      </p>

      <section aria-labelledby="site-analytics" className="mt-10 space-y-4 leading-relaxed text-phino-text-muted">
        <h2 id="site-analytics" className="font-display text-2xl font-semibold text-phino-text">Site analytics</h2>
        <p>
          Reactive Skills counts page views with self-hosted Umami, hosted on Railway.
          The tracker script loads from{' '}
          <span className="break-all">https://umami-production-abb4.up.railway.app/script.js</span>,
          so your browser contacts that host directly to load the script and send page-view data.
          Analytics are used to understand site traffic, not for advertising.
        </p>
        <p>
          Only visits to reactive-skills.com are counted.
          If your browser sends a Do Not Track signal, the tracker sends no analytics data,
          though your browser still requests the script.
        </p>
        <p>
          Each page view includes the page address (including its query string and fragment), referrer,
          page title, hostname, screen size and language.
          Umami also derives browser, operating system, device type and approximate location from request information.
          Hosting providers receive your IP address and routine request metadata when your browser contacts them.
        </p>
        <p>
          The tracker sets no cookies and writes nothing to your browser storage.
          This site enables page-view tracking only, with no custom events, identify calls,
          session recordings, heatmaps or performance tracking.
          Self-hosted Umami retains analytics data until it is deleted.
        </p>
        <p>
          Read more in the{' '}
          <a href="https://docs.umami.is/docs/faq" className="text-phino-signal-text underline">Umami documentation</a>.
        </p>
      </section>

      <section aria-labelledby="site-preferences" className="mt-10 space-y-4 leading-relaxed text-phino-text-muted">
        <h2 id="site-preferences" className="font-display text-2xl font-semibold text-phino-text">Site preferences</h2>
        <p>
          The site stores your theme preference in your browser so it can remember your choice.
          This preference is separate from analytics and is not sent to Umami.
        </p>
      </section>
    </div>
  );
}

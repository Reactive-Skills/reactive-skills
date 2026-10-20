import { ANALYTICS, TRACKER_SRC } from '@/lib/analytics';

// Mounted once in the root layout. Page views only; see docs/analytics.md.
export function Analytics() {
  return (
    <script
      defer
      src={TRACKER_SRC}
      data-website-id={ANALYTICS.websiteId}
      data-domains={ANALYTICS.domains.join(',')}
      data-do-not-track="true"
    />
  );
}

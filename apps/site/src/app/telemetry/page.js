import { MultiJobTelemetryDashboard } from '@/features/telemetry/MultiJobTelemetryDashboard';

export const metadata = {
  title: 'Telemetry Dashboard',
  description: 'Monitor multiple Reactive Skills jobs through one local telemetry broker.',
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Telemetry page shell around the client-side multi-job dashboard.
 *
 * # Performance & Risk Budget
 * - Tier: P3 (static render)
 * - Complexity: O(1)
 * - Cyclomatic Complexity (CC): target <=1
 * - Branch Coverage: target >=60%
 * - CRAP Score: target <=2
 */
export default function TelemetryPage() {
  return (
    <div className="container py-12 lg:py-20">
      <MultiJobTelemetryDashboard />
    </div>
  );
}

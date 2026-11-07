import { MultiJobTelemetryDashboard } from '@/features/telemetry/MultiJobTelemetryDashboard';

export const metadata = {
  title: 'Telemetry Dashboard',
  description: 'Monitor multiple Reactive Skills jobs through one local telemetry broker.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function TelemetryPage() {
  return (
    <div className="container py-12 lg:py-20">
      <MultiJobTelemetryDashboard />
    </div>
  );
}

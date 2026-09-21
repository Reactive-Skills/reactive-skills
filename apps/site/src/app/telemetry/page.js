import { MultiJobTelemetryDashboard } from '@/features/telemetry/MultiJobTelemetryDashboard';

export const metadata = {
  title: 'Telemetry Dashboard',
  description: 'Monitor multiple Reactive Skills jobs through one local telemetry broker.',
};

export default function TelemetryPage() {
  return (
    <main className="container py-10 lg:py-14">
      <MultiJobTelemetryDashboard />
    </main>
  );
}

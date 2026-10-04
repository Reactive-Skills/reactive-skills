import { getRegistryContentSource } from '@/infrastructure/container';
import { landingUseCases } from '@/infrastructure/content/landing/useCases';
import { resolveUseCases } from '@/lib/landing/resolveUseCases';
import { LandingPage } from '@/features/landing/LandingPage';

export default function HomePage() {
  const registry = getRegistryContentSource();
  return (
    <LandingPage
      stats={registry.getStats()}
      useCases={resolveUseCases(landingUseCases, registry.listSkills())}
    />
  );
}

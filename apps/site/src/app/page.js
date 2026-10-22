import { getRegistryContentSource } from '@/infrastructure/container';
import { landingUseCases } from '@/infrastructure/content/landing/useCases';
import { buildRegistryLog, buildRunTape } from '@/lib/landing/flightRecorder';
import { LandingPage } from '@/features/landing/LandingPage';

const TAPE_SKILL = 'tdd-refactor';
const TAPE_STATES = ['RED_SPEC', 'GREEN_CODE', 'REFACTOR', 'AUDIT_VERIFY', 'COMPLETED'];

export default function HomePage() {
  const registry = getRegistryContentSource();
  const tapeSkill = registry.getSkill(TAPE_SKILL);
  const skills = registry.listSkills().map((skill) => registry.getSkill(skill.slug));
  return (
    <LandingPage
      stats={registry.getStats()}
      tape={buildRunTape(tapeSkill, TAPE_STATES)}
      tapeSkillName={tapeSkill.name}
      registryRows={buildRegistryLog(skills, landingUseCases)}
    />
  );
}

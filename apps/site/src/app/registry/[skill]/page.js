import { notFound } from 'next/navigation';
import { getRegistryContentSource } from '@/infrastructure/container';
import { SkillDetailView } from '@/features/registry/SkillDetailView';

export async function generateStaticParams() {
  const registrySource = getRegistryContentSource();
  const skills = registrySource.listSkills();
  return skills.map((s) => ({
    skill: s.slug,
  }));
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.skill;
  const registrySource = getRegistryContentSource();
  const skill = registrySource.getSkill(slug);

  if (!skill) {
    return {
      title: 'Skill Not Found',
    };
  }

  return {
    title: `${skill.name} (${skill.version}) · Skill Registry`,
    description: skill.description,
  };
}

export default async function SkillPage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.skill;
  const registrySource = getRegistryContentSource();
  const skill = registrySource.getSkill(slug);

  if (!skill) {
    notFound();
  }

  return <SkillDetailView skill={skill} />;
}

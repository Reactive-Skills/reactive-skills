export function resolveUseCases(entries, skills) {
  const bySlug = new Map(skills.map((skill) => [skill.slug, skill]));
  return entries.map((entry) => {
    const skill = bySlug.get(entry.slug);
    if (!skill) throw new Error(`Landing use case "${entry.slug}" is not in the skill registry`);
    return { ...entry, name: skill.name, stateCount: skill.stateCount };
  });
}

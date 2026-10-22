// Landing-page data shaping for the run tape and the registry log.
import { resolveUseCases } from './resolveUseCases';

function transitionsOf(skill) {
  return skill.states.flatMap((state) => state.transitions.map((transition) => ({ ...transition, from: state.name })));
}

export function readableGuard(guard) {
  return guard.replace(/^(event\.)?payload\./, '').replace(/\s+/g, ' ').trim();
}

/** How a skill's transitions are checked: the kind label plus how many transitions carry a guard. */
export function describeChecks(skill) {
  const guards = transitionsOf(skill).map((transition) => transition.guard).filter(Boolean);
  if (guards.length === 0) return { kind: 'signal only', guardCount: 0 };
  const kind = guards.some((guard) => guard.includes('exit_code')) ? 'exit code' : 'payload guard';
  return { kind, guardCount: guards.length };
}

/**
 * One row per published skill. Curated landing entries come first, in their order, and keep
 * their outcome line; every other skill follows alphabetically with its registry description.
 */
export function buildRegistryLog(skills, useCases) {
  const curated = new Map(resolveUseCases(useCases, skills).map((entry, index) => [entry.slug, { ...entry, index }]));
  return skills
    .map((skill) => {
      const entry = curated.get(skill.slug);
      return {
        slug: skill.slug,
        name: skill.name,
        category: entry?.job ?? skill.category,
        note: entry?.outcome ?? skill.description,
        stateCount: skill.stateCount,
        version: skill.version,
        order: entry ? entry.index : useCases.length,
        ...describeChecks(skill),
      };
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export const LOG_SORT_KEYS = ['order', 'name', 'stateCount', 'guardCount'];

export function sortRegistryLog(rows, key, direction = 'asc') {
  if (!LOG_SORT_KEYS.includes(key)) throw new Error(`Unknown sort key "${key}"`);
  const sign = direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const delta = typeof a[key] === 'string' ? a[key].localeCompare(b[key]) : a[key] - b[key];
    return sign * delta || a.name.localeCompare(b.name);
  });
}

/**
 * The hero tape: the named states in run order, each with the check that lets the run leave it.
 * A transition out of a composite state's children (REFACTOR.*) counts as leaving the parent.
 */
export function buildRunTape(skill, stateNames) {
  const transitions = transitionsOf(skill);
  return stateNames.map((name, index) => {
    const state = skill.states.find((candidate) => candidate.name === name);
    if (!state) throw new Error(`State "${name}" is not in ${skill.slug}`);
    const next = stateNames[index + 1];
    const exit = next
      ? transitions.find((t) => (t.from === name || t.from.startsWith(`${name}.`)) && t.target === next)
      : null;
    if (next && !exit) throw new Error(`${skill.slug} has no transition from ${name} to ${next}`);
    return {
      name,
      description: state.description,
      signal: exit?.signal ?? null,
      check: exit ? (exit.guard ? readableGuard(exit.guard) : `signal ${exit.signal}`) : 'terminal',
    };
  });
}

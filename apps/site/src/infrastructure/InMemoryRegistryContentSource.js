import { IRegistryContentSource } from '@/contracts/RegistryContentSource';
import { registrySkills } from '@/infrastructure/content/registry/skills';

/**
 * In-memory implementation of the Skill Registry content boundary.
 *
 * @implements {IRegistryContentSource}
 */
export class InMemoryRegistryContentSource extends IRegistryContentSource {
  constructor(skills = registrySkills) {
    super();
    this._skills = skills;
  }

  listSkills(filter = {}) {
    let result = this._skills.map((s) => ({
      slug: s.slug,
      name: s.name,
      version: s.version,
      category: s.category,
      description: s.description,
      tags: s.tags,
      stateCount: s.stateCount,
      strictExecution: s.strictExecution,
      tools: s.tools,
      installCmd: s.installCmd,
      author: s.author,
    }));

    if (filter.category && filter.category !== 'All') {
      result = result.filter((s) => s.category.toLowerCase() === filter.category.toLowerCase());
    }

    if (filter.tag) {
      result = result.filter((s) => s.tags.includes(filter.tag.toLowerCase()));
    }

    if (filter.search) {
      const q = filter.search.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    return result;
  }

  getSkill(slug) {
    if (!slug) return null;
    const normalized = slug.toLowerCase().trim();
    return this._skills.find((s) => s.slug.toLowerCase() === normalized) || null;
  }

  getCategories() {
    const counts = {};
    for (const s of this._skills) {
      counts[s.category] = (counts[s.category] || 0) + 1;
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }
}

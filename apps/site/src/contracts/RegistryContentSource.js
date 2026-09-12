// Content boundary contract for the Reactive Skills Registry.
//
// Page components and consumers depend only on this abstract interface.
// Concrete implementations (such as InMemoryRegistryContentSource or future
// remote registry clients) are injected via the central container.

export const REGISTRY_CONTENT_SOURCE = Symbol('REGISTRY_CONTENT_SOURCE');

/**
 * @abstract
 */
export class IRegistryContentSource {
  /**
   * List all published reactive skills matching optional filter criteria.
   * @param {Object} [filter]
   * @param {string} [filter.category]
   * @param {string} [filter.search]
   * @param {string} [filter.tag]
   * @returns {import('@/contracts/types').RegistrySkillSummary[]}
   */
  listSkills(filter) {
    throw new Error('IRegistryContentSource.listSkills must be implemented');
  }

  /**
   * Retrieve full details and statechart topology for a single skill.
   * @param {string} slug
   * @returns {import('@/contracts/types').RegistrySkillDetail|null}
   */
  getSkill(slug) {
    throw new Error('IRegistryContentSource.getSkill must be implemented');
  }

  /**
   * List all available skill categories with counts.
   * @returns {{ name: string, count: number }[]}
   */
  getCategories() {
    throw new Error('IRegistryContentSource.getCategories must be implemented');
  }
}

// Content boundary contract for Reactive Skills mods.
//
// Page components depend only on this abstract interface. Concrete
// implementations (such as InMemoryModsContentSource) are injected via the
// central container.

export const MODS_CONTENT_SOURCE = Symbol('MODS_CONTENT_SOURCE');

/**
 * @typedef {Object} Mod
 * @property {string} slug
 * @property {string} name
 * @property {string} summary
 * @property {string} installCmd
 * @property {string} sourceUrl
 * @property {{ name: string, description: string }[]} features
 * @property {string[]} reads
 */

/**
 * @abstract
 */
export class IModsContentSource {
  /**
   * List all published mods.
   * @returns {Mod[]}
   */
  listMods() {
    throw new Error('IModsContentSource.listMods must be implemented');
  }

  /**
   * Retrieve one mod by slug.
   * @param {string} slug
   * @returns {Mod|null}
   */
  getMod(slug) {
    throw new Error('IModsContentSource.getMod must be implemented');
  }
}

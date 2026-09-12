// Documentation content boundary.
//
// This interface is intentionally swappable: the first version is backed by
// static in-memory content, but it can later load generated repository
// documentation without changing any page component. Page components depend
// only on this contract — never on a concrete implementation.

export const DOCS_CONTENT_SOURCE = 'DocsContentSource';

/**
 * @interface IDocsContentSource
 */
export class IDocsContentSource {
  /** @returns {import('./types').DocsNavigation} */
  getNavigation() {
    throw new Error('IDocsContentSource.getNavigation() not implemented');
  }

  /** @returns {import('./types').DocPage[]} */
  listPages() {
    throw new Error('IDocsContentSource.listPages() not implemented');
  }

  /**
   * @param {string} slug
   * @returns {import('./types').DocPage | null}
   */
  getPage(slug) {
    throw new Error('IDocsContentSource.getPage() not implemented');
  }

  /** @returns {import('./types').Concept[]} */
  getConcepts() {
    throw new Error('IDocsContentSource.getConcepts() not implemented');
  }

  /** @returns {{ initial: string, nodes: import('./types').StateNode[] }} */
  getStateMachine() {
    throw new Error('IDocsContentSource.getStateMachine() not implemented');
  }

  /** @returns {{ id: string, label: string, kind: string, description: string }[]} */
  getEventFlow() {
    throw new Error('IDocsContentSource.getEventFlow() not implemented');
  }

  /** @returns {import('./types').RuntimeEvent[]} */
  getRuntimeEvents() {
    throw new Error('IDocsContentSource.getRuntimeEvents() not implemented');
  }
}

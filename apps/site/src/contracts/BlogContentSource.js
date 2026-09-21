// Blog content boundary.
//
// Page components depend only on this contract — never on a concrete
// implementation.

export const BLOG_CONTENT_SOURCE = 'BlogContentSource';

/**
 * @interface IBlogContentSource
 */
export class IBlogContentSource {
  /**
   * @param {{ tag?: string, seriesId?: string }} [options]
   * @returns {import('./types').BlogPost[]}
   */
  listPosts(options = {}) {
    throw new Error('IBlogContentSource.listPosts() not implemented');
  }

  /**
   * @param {string} slug
   * @returns {import('./types').BlogPost | null}
   */
  getPost(slug) {
    throw new Error('IBlogContentSource.getPost() not implemented');
  }

  /**
   * @returns {string[]}
   */
  getTags() {
    throw new Error('IBlogContentSource.getTags() not implemented');
  }

  /**
   * @returns {import('./types').BlogPost | null}
   */
  getFeaturedPost() {
    throw new Error('IBlogContentSource.getFeaturedPost() not implemented');
  }
}

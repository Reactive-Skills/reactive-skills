import { IBlogContentSource } from '@/contracts/BlogContentSource';
import { blogPosts, blogPostsBySlug, blogTags } from '@/infrastructure/content/blog';

/**
 * In-memory implementation of the BlogContentSource contract.
 * @implements {IBlogContentSource}
 */
export class InMemoryBlogContentSource extends IBlogContentSource {
  listPosts(options = {}) {
    let posts = [...blogPosts];

    if (options.tag) {
      const normalizedTag = options.tag.toLowerCase();
      posts = posts.filter((p) =>
        p.tags.some((t) => t.toLowerCase() === normalizedTag)
      );
    }

    if (options.seriesId) {
      posts = posts.filter((p) => p.series?.id === options.seriesId);
    }

    return posts;
  }

  getPost(slug) {
    return blogPostsBySlug[slug] || null;
  }

  getTags() {
    return blogTags;
  }

  getFeaturedPost() {
    return blogPosts.find((p) => p.featured) || blogPosts[0] || null;
  }
}

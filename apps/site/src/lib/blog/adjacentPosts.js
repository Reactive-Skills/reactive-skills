function byPublicationOrder(a, b) {
  if (a.publishedAt !== b.publishedAt) return a.publishedAt < b.publishedAt ? -1 : 1;
  return a.slug.localeCompare(b.slug);
}

export function getAdjacentPosts(posts, slug) {
  const chronological = [...posts].sort(byPublicationOrder);
  const index = chronological.findIndex((post) => post.slug === slug);
  if (index === -1) return { prevPost: null, nextPost: null };
  return {
    prevPost: chronological[index - 1] ?? null,
    nextPost: chronological[index + 1] ?? null,
  };
}

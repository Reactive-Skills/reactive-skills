import { postIntroducingReactiveSkills } from './posts/introducing-reactive-skills';
import { postGuardingTheStateMachineJev } from './posts/guarding-the-state-machine-jev';
import { loadMarkdownBlogPosts } from './markdownLoader';

const loadedMarkdownPosts = loadMarkdownBlogPosts();

/** @type {import('@/contracts/types').BlogPost[]} */
export const blogPosts = loadedMarkdownPosts.length > 0
  ? loadedMarkdownPosts
  : [postIntroducingReactiveSkills, postGuardingTheStateMachineJev];

/** @type {Record<string, import('@/contracts/types').BlogPost>} */
export const blogPostsBySlug = Object.fromEntries(
  blogPosts.map((post) => [post.slug, post])
);

export const blogTags = Array.from(
  new Set(blogPosts.flatMap((p) => p.tags || []))
).sort();

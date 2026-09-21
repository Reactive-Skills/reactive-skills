import { getBlogContentSource } from '@/infrastructure/container';
import { BlogIndexView } from '@/features/blog/BlogIndexView';

export const metadata = {
  title: 'Blog — Architecture & Deep Dives',
  description:
    'Technical deep-dives into Hierarchical State Machines, deterministic guarding, sub-second micro-decisions, and event-sourced agent architectures.',
};

export default function BlogPage() {
  const content = getBlogContentSource();
  const posts = content.listPosts();
  const tags = content.getTags();

  return <BlogIndexView posts={posts} tags={tags} />;
}

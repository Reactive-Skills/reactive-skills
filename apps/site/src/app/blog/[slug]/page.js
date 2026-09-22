import { notFound } from 'next/navigation';
import { getBlogContentSource } from '@/infrastructure/container';
import { BlogPostView } from '@/features/blog/BlogPostView';
import { absoluteUrl } from '@/infrastructure/siteMetadata';

export async function generateStaticParams() {
  const content = getBlogContentSource();
  const posts = content.listPosts();
  return posts.map((p) => ({
    slug: p.slug,
  }));
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;
  const content = getBlogContentSource();
  const post = content.getPost(slug);

  if (!post) {
    return {
      title: 'Article Not Found',
    };
  }

  const postUrl = absoluteUrl(`/blog/${post.slug}`);

  return {
    title: `${post.title} · Blog`,
    description: post.summary,
    alternates: {
      canonical: postUrl,
    },
    openGraph: {
      url: postUrl,
      siteName: 'Reactive Skills',
      title: post.title,
      description: post.summary,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: [post.author.name],
      tags: post.tags,
      images: [absoluteUrl('/opengraph-image')],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.summary,
      images: [absoluteUrl('/opengraph-image')],
    },
  };
}

export default async function BlogPostPage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;
  const content = getBlogContentSource();
  const post = content.getPost(slug);

  if (!post) {
    notFound();
  }

  const allPosts = content.listPosts();
  const currentIndex = allPosts.findIndex((p) => p.slug === slug);
  const prevPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null;
  const nextPost = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null;

  return <BlogPostView post={post} nextPost={nextPost} prevPost={prevPost} />;
}

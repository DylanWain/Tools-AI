// ============================================================================
// pages/blog/[slug].tsx — Static blog article page
// getStaticPaths + getStaticProps = zero runtime cost
// fallback: false = unknown slugs → 404 from CDN (no compute)
// ============================================================================

import Head from 'next/head';
import { GetStaticPaths, GetStaticProps } from 'next';
import BlogArticle from '../../components/blog/BlogArticle';
import { getAllArticleSlugs, getArticleBySlug, type ArticleContent } from '../../lib/articles';

interface BlogPostProps {
  article: ArticleContent;
}

export default function BlogPost({ article }: BlogPostProps) {
  const { meta } = article;
  const canonicalUrl = `https://www.thetoolswebsite.com/blog/${meta.slug}`;

  return (
    <>
      <Head>
        {/* Primary */}
        <title>{meta.title} | Tools AI</title>
        <meta name="description" content={meta.description} />
        <link rel="canonical" href={canonicalUrl} />

        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="Tools AI" />
        <meta property="og:image" content={meta.ogImage || 'https://www.thetoolswebsite.com/og-default.png'} />
        <meta property="article:published_time" content={meta.publishDate} />
        <meta property="article:modified_time" content={meta.updateDate} />
        <meta property="article:author" content={meta.author} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={meta.title} />
        <meta name="twitter:description" content={meta.description} />
        <meta name="twitter:image" content={meta.ogImage || 'https://www.thetoolswebsite.com/og-default.png'} />

        {/* Robots */}
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
      </Head>
      <BlogArticle article={article} />
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const slugs = getAllArticleSlugs();
  return {
    paths: slugs.map(slug => ({ params: { slug } })),
    fallback: false, // Unknown slugs → 404 from CDN, zero compute
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const slug = params?.slug as string;
  const article = getArticleBySlug(slug);

  if (!article) {
    return { notFound: true };
  }

  return {
    props: { article },
    // NO revalidate — fully static, rebuild to update
  };
};

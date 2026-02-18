// ============================================================================
// pages/blog/index.tsx — Blog index page (static)
// ============================================================================

import Head from 'next/head';
import { GetStaticProps } from 'next';
import { getAllArticles, CATEGORY_META } from '../../lib/articles';

interface BlogArticleMeta {
  meta: {
    slug: string;
    title: string;
    category: string;
    readTime: string;
    wordCount: number;
  };
}

interface BlogIndexProps {
  articles: BlogArticleMeta[];
  categories: { slug: string; label: string; count: number }[];
}

export default function BlogIndex({ articles, categories }: BlogIndexProps) {
  return (
    <>
      <Head>
        <title>AI Memory & Context Blog | Tools AI</title>
        <meta name="description" content="Guides, fixes, and deep dives for ChatGPT, Claude, and Gemini memory problems. Learn how to never lose AI context again." />
        <link rel="canonical" href="https://www.thetoolswebsite.com/blog" />
      </Head>
      <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', color: '#1a1a1a', background: '#fff' }}>
        {/* Nav */}
        <nav style={{ borderBottom: '1px solid #e5e5e5', padding: '16px 0', position: 'sticky', top: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', zIndex: 100 }}>
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <a href="/" style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', textDecoration: 'none' }}>Tools AI</a>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <a href="/app" style={{ color: '#666', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>Chat</a>
              <a href="/download" style={{ display: 'inline-flex', alignItems: 'center', background: '#1a1a1a', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Get the Extension</a>
            </div>
          </div>
        </nav>

        {/* Hero */}
        <header style={{ padding: '48px 0 40px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>
            <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: -1.5, margin: '0 0 12px' }}>AI Memory & Context Blog</h1>
            <p style={{ fontSize: 18, color: '#666', lineHeight: 1.6, margin: 0 }}>{articles.length} guides to fix AI memory loss, save conversations, and never lose context again.</p>
          </div>
        </header>

        {/* Categories */}
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px 0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 40 }}>
            {categories.map(cat => (
              <a key={cat.slug} href={`#${cat.slug}`} style={{ display: 'inline-block', background: '#f5f5f5', color: '#666', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
                {cat.label} ({cat.count})
              </a>
            ))}
          </div>
        </div>

        {/* Articles by Category */}
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 64px' }}>
          {categories.map(cat => {
            const catArticles = articles.filter(a => a.meta.category === cat.slug);
            return (
              <section key={cat.slug} id={cat.slug} style={{ marginBottom: 48 }}>
                <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, margin: '0 0 20px', paddingTop: 16 }}>{cat.label}</h2>
                <div style={{ display: 'grid', gap: 12 }}>
                  {catArticles.map(a => (
                    <a key={a.meta.slug} href={`/blog/${a.meta.slug}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#fafafa', borderRadius: 8, textDecoration: 'none', transition: 'background 0.2s' }}>
                      <div>
                        <span style={{ fontSize: 15, fontWeight: 500, color: '#1a1a1a', lineHeight: 1.4, display: 'block' }}>{a.meta.title}</span>
                        <span style={{ fontSize: 13, color: '#888', marginTop: 4, display: 'block' }}>{a.meta.readTime} · {a.meta.wordCount.toLocaleString()} words</span>
                      </div>
                      <span style={{ fontSize: 18, color: '#ccc' }}>→</span>
                    </a>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* Footer */}
        <footer style={{ borderTop: '1px solid #e5e5e5', padding: '24px 0' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 13, color: '#888', margin: 0 }}>© {new Date().getFullYear()} Tools AI</p>
            <div style={{ display: 'flex', gap: 16 }}>
              <a href="/privacy" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>Privacy</a>
              <a href="/terms" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>Terms</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const fullArticles = getAllArticles();

  // Only pass the fields the index page actually uses — NOT full content
  const articles = fullArticles.map(a => ({
    meta: {
      slug: a.meta.slug,
      title: a.meta.title,
      category: a.meta.category,
      readTime: a.meta.readTime,
      wordCount: a.meta.wordCount,
    },
  }));

  const catMap: Record<string, number> = {};
  articles.forEach(a => {
    catMap[a.meta.category] = (catMap[a.meta.category] || 0) + 1;
  });
  const categories = Object.entries(catMap)
    .map(([slug, count]) => ({
      slug,
      label: CATEGORY_META[slug]?.label || slug,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return { props: { articles, categories } };
};

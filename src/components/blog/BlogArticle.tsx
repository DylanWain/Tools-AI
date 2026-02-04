// ============================================================================
// components/blog/BlogArticle.tsx — 10X Gold Standard Article Component
// Matches Tools AI landing page design: #1a1a1a primary, clean typography,
// -apple-system font stack, 900px max-width
// ============================================================================

import React from 'react';
import type { ArticleContent } from '../../lib/articles';

interface BlogArticleProps {
  article: ArticleContent;
}

export default function BlogArticle({ article }: BlogArticleProps) {
  const { meta, heroHook, tableOfContents, sections, faqs, tables, ctaSections, internalLinks, externalLinks } = article;

  return (
    <>
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: meta.title,
            description: meta.description,
            author: { '@type': 'Organization', name: 'Tools AI', url: 'https://toolsai.com' },
            publisher: { '@type': 'Organization', name: 'Tools AI', logo: { '@type': 'ImageObject', url: 'https://toolsai.com/favicon.svg' } },
            datePublished: meta.publishDate,
            dateModified: meta.updateDate,
            mainEntityOfPage: { '@type': 'WebPage', '@id': `https://toolsai.com/blog/${meta.slug}` },
            wordCount: meta.wordCount,
          }),
        }}
      />
      {faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqs.map(faq => ({
                '@type': 'Question',
                name: faq.question,
                acceptedAnswer: { '@type': 'Answer', text: faq.answer },
              })),
            }),
          }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://toolsai.com' },
              { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://toolsai.com/blog' },
              { '@type': 'ListItem', position: 3, name: meta.title, item: `https://toolsai.com/blog/${meta.slug}` },
            ],
          }),
        }}
      />

      <div className="blog-article">
        {/* Navigation */}
        <nav className="blog-nav">
          <div className="blog-nav-inner">
            <a href="/" className="blog-logo">Tools AI</a>
            <div className="blog-nav-links">
              <a href="/blog">Blog</a>
              <a href="/app">Chat</a>
              <a href="/download" className="blog-btn-primary">Get the Extension</a>
            </div>
          </div>
        </nav>

        {/* Breadcrumbs */}
        <div className="blog-breadcrumbs">
          <div className="blog-inner">
            <a href="/">Home</a>
            <span className="blog-breadcrumb-sep">›</span>
            <a href="/blog">Blog</a>
            <span className="blog-breadcrumb-sep">›</span>
            <a href={`/blog/category/${meta.category}`}>{meta.categoryLabel}</a>
            <span className="blog-breadcrumb-sep">›</span>
            <span className="blog-breadcrumb-current">{meta.title}</span>
          </div>
        </div>

        {/* Hero */}
        <header className="blog-hero">
          <div className="blog-inner">
            <span className="blog-badge">{meta.categoryLabel}</span>
            <h1 className="blog-title">{meta.title}</h1>
            <p className="blog-excerpt">{meta.excerpt}</p>
            <div className="blog-meta-row">
              <span className="blog-author">{meta.author}</span>
              <span className="blog-meta-sep">·</span>
              <time dateTime={meta.updateDate}>{new Date(meta.updateDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
              <span className="blog-meta-sep">·</span>
              <span>{meta.readTime}</span>
              <span className="blog-meta-sep">·</span>
              <span>{meta.wordCount.toLocaleString()} words</span>
            </div>
          </div>
        </header>

        {/* Article Body */}
        <article className="blog-body">
          <div className="blog-inner">

            {/* Hook */}
            <div className="blog-hook" dangerouslySetInnerHTML={{ __html: heroHook }} />

            {/* CTA after intro */}
            {ctaSections.filter(c => c.position === 'after-intro').map((cta, i) => (
              <div key={i} className="blog-cta-box">
                <strong>{cta.headline}</strong>
                <p>{cta.body}</p>
                <a href={cta.buttonUrl} className="blog-btn-primary">{cta.buttonText}</a>
              </div>
            ))}

            {/* Table of Contents */}
            {tableOfContents.length > 0 && (
              <div className="blog-toc">
                <h2 className="blog-toc-title">What You'll Learn</h2>
                <ul className="blog-toc-list">
                  {tableOfContents.map((item, i) => (
                    <li key={i} className={`blog-toc-item blog-toc-level-${item.level}`}>
                      <a href={item.href}>{item.text}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Main Sections */}
            {sections.map((section, i) => (
              <section key={i} id={section.h2Id} className="blog-section">
                <h2>{section.h2}</h2>
                <div dangerouslySetInnerHTML={{ __html: section.content }} />
                {section.h3s?.map((h3, j) => (
                  <div key={j} id={h3.id} className="blog-subsection">
                    <h3>{h3.title}</h3>
                    <div dangerouslySetInnerHTML={{ __html: h3.content }} />
                  </div>
                ))}

                {/* Insert CTA mid-article */}
                {i === Math.floor(sections.length / 2) && ctaSections.filter(c => c.position === 'mid-article').map((cta, k) => (
                  <div key={k} className="blog-cta-box">
                    <strong>{cta.headline}</strong>
                    <p>{cta.body}</p>
                    <a href={cta.buttonUrl} className="blog-btn-primary">{cta.buttonText}</a>
                  </div>
                ))}
              </section>
            ))}

            {/* Tables */}
            {tables.map((table, i) => (
              <div key={i} className="blog-table-wrap">
                {table.caption && <p className="blog-table-caption">{table.caption}</p>}
                <table className="blog-table">
                  <thead>
                    <tr>
                      {table.headers.map((h, j) => <th key={j}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => <td key={k} dangerouslySetInnerHTML={{ __html: cell }} />)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            {/* CTA before FAQs */}
            {ctaSections.filter(c => c.position === 'before-faqs').map((cta, i) => (
              <div key={i} className="blog-cta-box">
                <strong>{cta.headline}</strong>
                <p>{cta.body}</p>
                <a href={cta.buttonUrl} className="blog-btn-primary">{cta.buttonText}</a>
              </div>
            ))}

            {/* FAQs */}
            {faqs.length > 0 && (
              <section className="blog-faqs" id="faqs">
                <h2>Frequently Asked Questions</h2>
                <div className="blog-faq-list">
                  {faqs.map((faq, i) => (
                    <details key={i} className="blog-faq-item">
                      <summary className="blog-faq-question">{faq.question}</summary>
                      <div className="blog-faq-answer" dangerouslySetInnerHTML={{ __html: faq.answer }} />
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* Internal Links */}
            {internalLinks.length > 0 && (
              <section className="blog-related-links">
                <h2>Related Guides</h2>
                <div className="blog-links-grid">
                  {internalLinks.slice(0, 12).map((link, i) => (
                    <a key={i} href={link.href} className="blog-link-card">
                      <span className="blog-link-category">{link.category}</span>
                      <span className="blog-link-text">{link.text}</span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Footer CTA */}
            {ctaSections.filter(c => c.position === 'footer').map((cta, i) => (
              <div key={i} className="blog-cta-footer">
                <h2>{cta.headline}</h2>
                <p>{cta.body}</p>
                <a href={cta.buttonUrl} className="blog-btn-primary blog-btn-lg">{cta.buttonText}</a>
              </div>
            ))}
          </div>
        </article>

        {/* Footer */}
        <footer className="blog-footer">
          <div className="blog-inner">
            <p>© {new Date().getFullYear()} Tools AI. The universal memory layer for AI.</p>
            <div className="blog-footer-links">
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
              <a href="/blog">Blog</a>
            </div>
          </div>
        </footer>
      </div>

      <style jsx>{`
        /* ============================================ */
        /* TOOLS AI BLOG — DESIGN SYSTEM               */
        /* Matches landing: #1a1a1a, clean, -apple-sys */
        /* ============================================ */

        .blog-article {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #1a1a1a;
          background: #fff;
          -webkit-font-smoothing: antialiased;
        }

        .blog-inner {
          max-width: 900px;
          margin: 0 auto;
          padding: 0 24px;
        }

        /* Nav */
        .blog-nav {
          border-bottom: 1px solid #e5e5e5;
          padding: 16px 0;
          position: sticky;
          top: 0;
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(10px);
          z-index: 100;
        }
        .blog-nav-inner {
          max-width: 900px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .blog-logo {
          font-size: 20px;
          font-weight: 700;
          color: #1a1a1a;
          text-decoration: none;
        }
        .blog-nav-links {
          display: flex;
          align-items: center;
          gap: 24px;
        }
        .blog-nav-links a {
          color: #666;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
        }
        .blog-nav-links a:hover { color: #1a1a1a; }

        /* Primary Button */
        .blog-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #1a1a1a;
          color: #fff !important;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none !important;
          transition: background 0.2s;
        }
        .blog-btn-primary:hover { background: #333; }
        .blog-btn-lg { padding: 14px 28px; font-size: 16px; }

        /* Breadcrumbs */
        .blog-breadcrumbs {
          padding: 16px 0;
          font-size: 13px;
          color: #888;
          border-bottom: 1px solid #f0f0f0;
        }
        .blog-breadcrumbs a { color: #888; text-decoration: none; }
        .blog-breadcrumbs a:hover { color: #1a1a1a; }
        .blog-breadcrumb-sep { margin: 0 8px; }
        .blog-breadcrumb-current { color: #1a1a1a; font-weight: 500; }

        /* Hero */
        .blog-hero {
          padding: 48px 0 40px;
          border-bottom: 1px solid #f0f0f0;
        }
        .blog-badge {
          display: inline-block;
          background: #f5f5f5;
          color: #666;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 16px;
        }
        .blog-title {
          font-size: 42px;
          font-weight: 700;
          line-height: 1.15;
          letter-spacing: -1.5px;
          color: #1a1a1a;
          margin: 0 0 16px;
        }
        .blog-excerpt {
          font-size: 18px;
          color: #666;
          line-height: 1.6;
          margin: 0 0 20px;
        }
        .blog-meta-row {
          font-size: 14px;
          color: #888;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0;
        }
        .blog-author { font-weight: 600; color: #1a1a1a; }
        .blog-meta-sep { margin: 0 8px; }

        /* Body */
        .blog-body {
          padding: 48px 0;
        }
        .blog-hook {
          font-size: 18px;
          line-height: 1.7;
          color: #333;
          margin-bottom: 40px;
        }
        .blog-hook p { margin: 0 0 16px; }

        /* Table of Contents */
        .blog-toc {
          background: #fafafa;
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          padding: 28px 32px;
          margin: 0 0 48px;
        }
        .blog-toc-title {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 16px;
          color: #1a1a1a;
        }
        .blog-toc-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .blog-toc-item { margin: 6px 0; }
        .blog-toc-item a {
          color: #0369a1;
          text-decoration: none;
          font-size: 15px;
          line-height: 1.5;
        }
        .blog-toc-item a:hover { text-decoration: underline; }
        .blog-toc-level-3 { padding-left: 20px; }

        /* Sections */
        .blog-section {
          margin: 0 0 48px;
        }
        .blog-section h2 {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.5px;
          color: #1a1a1a;
          margin: 0 0 20px;
          padding-top: 24px;
        }
        .blog-subsection h3 {
          font-size: 20px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 32px 0 12px;
        }
        .blog-section p, .blog-subsection p {
          font-size: 16px;
          line-height: 1.7;
          color: #333;
          margin: 0 0 16px;
        }

        /* CTA Box */
        .blog-cta-box {
          background: #fafafa;
          border: 2px solid #e5e5e5;
          border-radius: 12px;
          padding: 32px;
          margin: 40px 0;
          text-align: center;
        }
        .blog-cta-box strong {
          display: block;
          font-size: 20px;
          margin-bottom: 8px;
          color: #1a1a1a;
        }
        .blog-cta-box p {
          color: #666;
          margin: 0 0 16px;
          font-size: 15px;
        }

        /* Tables */
        .blog-table-wrap {
          margin: 32px 0;
          overflow-x: auto;
        }
        .blog-table-caption {
          font-size: 14px;
          font-weight: 600;
          color: #666;
          margin-bottom: 8px;
        }
        .blog-table {
          width: 100%;
          border-collapse: collapse;
          background: #fff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .blog-table th {
          background: #f5f5f5;
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 600;
          color: #1a1a1a;
          text-align: left;
          border-bottom: 1px solid #e5e5e5;
        }
        .blog-table td {
          padding: 12px 16px;
          font-size: 14px;
          color: #333;
          border-bottom: 1px solid #f0f0f0;
        }
        .blog-table tr:last-child td { border-bottom: none; }

        /* FAQs */
        .blog-faqs {
          margin: 48px 0;
          padding-top: 24px;
        }
        .blog-faqs h2 {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.5px;
          margin: 0 0 24px;
        }
        .blog-faq-item {
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          margin: 0 0 8px;
          overflow: hidden;
        }
        .blog-faq-question {
          padding: 16px 20px;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          color: #1a1a1a;
          list-style: none;
        }
        .blog-faq-question::-webkit-details-marker { display: none; }
        .blog-faq-question::before {
          content: '+';
          display: inline-block;
          width: 20px;
          font-weight: 700;
          color: #888;
        }
        details[open] .blog-faq-question::before { content: '−'; }
        .blog-faq-answer {
          padding: 0 20px 16px 40px;
          font-size: 15px;
          line-height: 1.7;
          color: #333;
        }

        /* Related Links */
        .blog-related-links {
          margin: 48px 0;
        }
        .blog-related-links h2 {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 20px;
        }
        .blog-links-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }
        .blog-link-card {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 16px 20px;
          background: #fafafa;
          border-radius: 8px;
          text-decoration: none;
          transition: background 0.2s;
        }
        .blog-link-card:hover { background: #f0f0f0; }
        .blog-link-category {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #888;
        }
        .blog-link-text {
          font-size: 14px;
          font-weight: 500;
          color: #1a1a1a;
          line-height: 1.4;
        }

        /* Footer CTA */
        .blog-cta-footer {
          background: #1a1a1a;
          color: #fff;
          border-radius: 16px;
          padding: 48px 40px;
          margin: 48px 0;
          text-align: center;
        }
        .blog-cta-footer h2 {
          font-size: 28px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 12px;
        }
        .blog-cta-footer p {
          color: #ccc;
          font-size: 16px;
          margin: 0 0 24px;
        }
        .blog-cta-footer .blog-btn-primary {
          background: #fff;
          color: #1a1a1a !important;
        }
        .blog-cta-footer .blog-btn-primary:hover {
          background: #f0f0f0;
        }

        /* Footer */
        .blog-footer {
          border-top: 1px solid #e5e5e5;
          padding: 24px 0;
          margin-top: 24px;
        }
        .blog-footer .blog-inner {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .blog-footer p { font-size: 13px; color: #888; margin: 0; }
        .blog-footer-links { display: flex; gap: 16px; }
        .blog-footer-links a { font-size: 13px; color: #888; text-decoration: none; }
        .blog-footer-links a:hover { color: #1a1a1a; }

        /* Responsive */
        @media (max-width: 768px) {
          .blog-title { font-size: 28px; letter-spacing: -1px; }
          .blog-hero { padding: 32px 0 28px; }
          .blog-section h2 { font-size: 22px; }
          .blog-toc { padding: 20px 24px; }
          .blog-cta-footer { padding: 32px 24px; border-radius: 12px; }
          .blog-nav-links { gap: 12px; }
          .blog-footer .blog-inner { flex-direction: column; gap: 12px; text-align: center; }
        }
      `}</style>
    </>
  );
}

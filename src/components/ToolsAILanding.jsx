import React, { useState } from 'react';

// Custom SVG Icons for "Who it's for" section
const Icons = {
  developer: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="12 8 4 20 12 32" />
      <polyline points="28 8 36 20 28 32" />
      <line x1="22" y1="6" x2="18" y2="34" />
    </svg>
  ),
  founder: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 4 L20 14" />
      <path d="M20 14 L28 22 L28 36 L12 36 L12 22 L20 14" />
      <circle cx="20" cy="8" r="4" />
      <path d="M16 26 L24 26" />
      <path d="M16 30 L24 30" />
    </svg>
  ),
  researcher: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="16" cy="16" r="10" />
      <line x1="23" y1="23" x2="36" y2="36" />
      <path d="M12 14 L16 18 L20 12" />
    </svg>
  ),
  therapy: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="20" cy="14" r="8" />
      <path d="M8 36 C8 26 14 22 20 22 C26 22 32 26 32 36" />
      <path d="M16 12 Q20 18 24 12" />
      <circle cx="16" cy="10" r="1.5" fill="currentColor" />
      <circle cx="24" cy="10" r="1.5" fill="currentColor" />
    </svg>
  ),
  writer: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M28 4 L36 12 L14 34 L4 36 L6 26 L28 4" />
      <path d="M24 8 L32 16" />
      <path d="M6 26 L14 34" />
    </svg>
  ),
  student: (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 16 L20 8 L36 16 L20 24 L4 16" />
      <path d="M10 19 L10 30 Q20 36 30 30 L30 19" />
      <line x1="36" y1="16" x2="36" y2="28" />
      <circle cx="36" cy="30" r="2" />
    </svg>
  ),
};

export default function ToolsAILanding() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'landing' }),
      });
      if (res.ok) {
        setSubmitted(true);
      }
    } catch (err) {
      console.error('Waitlist error:', err);
    }
    setIsLoading(false);
  };

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="nav">
        <div className="nav-inner">
          <span className="logo">Tools AI</span>
          
          {/* Desktop nav */}
          <div className="nav-links-desktop">
            <a href="#comparison">Why Tools AI</a>
            <a href="#how-it-works">How it works</a>
            <a href="/dashboard">Dashboard</a>
            <a href="/download" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
              Get the extension
            </a>
          </div>

          {/* Mobile menu button */}
          <button 
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}>
              <span></span>
              <span></span>
              <span></span>
            </span>
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="mobile-menu">
            <a href="#comparison" onClick={() => setMobileMenuOpen(false)}>Why Tools AI</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How it works</a>
            <a href="/dashboard" onClick={() => setMobileMenuOpen(false)}>Dashboard</a>
            <a
              href="/download"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '8px', textAlign: 'center', textDecoration: 'none' }}
            >
              Get the extension
            </a>
          </div>
        )}
      </nav>

      {/* Hero - Updated messaging */}
      <section className="hero">
        <div className="hero-content">
          <div className="badge">Now available — free Chrome extension</div>

          <h1 className="hero-title">
            One memory layer for<br />every AI conversation
          </h1>

          <p className="hero-subtitle">
            ChatGPT, Claude, and Gemini all forget. Tools AI captures every conversation,
            <br />
            <strong>stores it permanently, and makes it searchable across all platforms.</strong>
          </p>

          {/* Primary CTA - Extension Download */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
            <a href="/download" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '16px 32px', fontSize: '16px', textDecoration: 'none' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/><circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/></svg>
              Add to Chrome — free
            </a>
            <a href="/dashboard" className="btn btn-primary" style={{ background: '#f5f5f5', color: '#1a1a1a', border: '1px solid #e5e5e5', padding: '16px 32px', fontSize: '16px', textDecoration: 'none' }}>
              Open dashboard
            </a>
          </div>
          <p style={{ fontSize: '13px', color: '#999', marginBottom: '40px' }}>
            Works with ChatGPT, Claude, and Gemini · No API key required · Free forever
          </p>

          {/* Email subscription (secondary) */}
          <div id="waitlist" className="waitlist-form">
            {!submitted ? (
              <form onSubmit={handleSubmit}>
                <p style={{ fontSize: '13px', color: '#888', marginBottom: '10px' }}>Get notified about new features:</p>
                <div className="form-row">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    required
                    className="input"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn btn-primary"
                    style={{ opacity: isLoading ? 0.7 : 1, background: 'transparent', color: '#1a1a1a', border: '1px solid #d5d5d5' }}
                  >
                    {isLoading ? 'Joining...' : 'Subscribe'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="success-message">
                You're on the list ✓
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Product preview */}
      <section className="preview-section">
        <div className="preview-container">
          {/* Browser chrome */}
          <div className="browser-chrome">
            <div className="browser-dot red" />
            <div className="browser-dot yellow" />
            <div className="browser-dot green" />
          </div>
          
          {/* Chat UI preview */}
          <div className="chat-preview">
            {/* Sidebar - hidden on mobile */}
            <div className="chat-sidebar">
              <div className="new-chat-btn">
                <span>+</span> New chat
              </div>
              
              <div className="chat-label">Recent</div>
              {['Database schema review', 'API authentication', 'React optimization'].map((chat, i) => (
                <div key={i} className={`chat-item ${i === 0 ? 'active' : ''}`}>
                  {chat}
                </div>
              ))}
              
              <div className="chat-label" style={{ marginTop: '20px' }}>3 months ago</div>
              {['Redis caching decision', 'Initial architecture'].map((chat, i) => (
                <div key={i} className="chat-item">{chat}</div>
              ))}
            </div>

            {/* Chat area */}
            <div className="chat-area">
              {/* User message */}
              <div className="message">
                <div className="avatar user">Y</div>
                <div className="message-text">
                  Why did we choose Redis for caching? I know we discussed this but I can't remember the reasoning.
                </div>
              </div>

              {/* AI response */}
              <div className="message">
                <div className="avatar ai">∞</div>
                <div className="message-content">
                  <div className="message-text">
                    From your conversation on <strong>October 15</strong>, you chose Redis over Memcached for three reasons:
                  </div>
                  <div className="code-block">
                    <div><strong>1.</strong> Data structures for your leaderboard feature</div>
                    <div><strong>2.</strong> Built-in persistence for cache warming</div>
                    <div><strong>3.</strong> Pub/sub for real-time notifications</div>
                  </div>
                  <div className="memory-tag">
                    <span>←</span> Retrieved from conversation 94 days ago
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ChatGPT Comparison */}
      <section id="comparison" className="comparison-section">
        <div className="section-inner">
          <h2 className="section-title">Why not just use ChatGPT?</h2>
          <p className="section-subtitle">
            ChatGPT wasn't built for long-running projects. We were.
          </p>

          <div className="comparison-table-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th></th>
                  <th>ChatGPT</th>
                  <th className="highlight">Tools AI</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="label">Long conversations</td>
                  <td className="bad">Summarized & compressed</td>
                  <td className="good">Stored verbatim</td>
                </tr>
                <tr>
                  <td className="label">Memory guarantees</td>
                  <td className="bad">None</td>
                  <td className="good">Explicit & permanent</td>
                </tr>
                <tr>
                  <td className="label">Message integrity</td>
                  <td className="bad">Mutable</td>
                  <td className="good">SHA-256 hashed</td>
                </tr>
                <tr>
                  <td className="label">Auditability</td>
                  <td className="bad">No</td>
                  <td className="good">Yes, with exports</td>
                </tr>
                <tr>
                  <td className="label">Year-long projects</td>
                  <td className="bad">Unreliable</td>
                  <td className="good">Designed for it</td>
                </tr>
                <tr>
                  <td className="label">Your own API keys</td>
                  <td className="bad">No</td>
                  <td className="good">Yes, pay providers directly</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* The problem */}
      <section className="problem-section">
        <div className="problem-content">
          <h2>AI assistants forget everything</h2>
          <p>
            You've had this conversation before. You explained your project, your preferences, your decisions. 
            But the AI doesn't remember. So you explain it again. And again.
          </p>
        </div>
      </section>

      {/* Who it's for - with custom SVG icons */}
      <section className="audience-section">
        <div className="section-inner">
          <h2 className="section-title">Who this is for</h2>
          
          <div className="audience-grid">
            <div className="audience-item">
              <span className="audience-icon">{Icons.developer}</span>
              <h3>Developers</h3>
              <p>Working on long-running codebases where context matters</p>
            </div>
            <div className="audience-item">
              <span className="audience-icon">{Icons.founder}</span>
              <h3>Founders</h3>
              <p>Documenting strategy & decisions over months of iteration</p>
            </div>
            <div className="audience-item">
              <span className="audience-icon">{Icons.researcher}</span>
              <h3>Researchers</h3>
              <p>Tracking evolving hypotheses and literature reviews</p>
            </div>
            <div className="audience-item">
              <span className="audience-icon">{Icons.therapy}</span>
              <h3>Therapy & Journaling</h3>
              <p>Long-term mental health tracking, personal growth, and reflective journaling</p>
            </div>
            <div className="audience-item">
              <span className="audience-icon">{Icons.writer}</span>
              <h3>Writers</h3>
              <p>Working on large, persistent documents and creative projects</p>
            </div>
            <div className="audience-item">
              <span className="audience-icon">{Icons.student}</span>
              <h3>Students</h3>
              <p>Studying complex subjects over semesters with connected context</p>
            </div>
          </div>

          <p className="audience-summary">
            Anyone tired of AI "forgetting" critical context mid-project.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="how-section">
        <div className="section-inner">
          <h2 className="section-title">How it works</h2>

          <div className="steps-grid">
            {[
              {
                num: '01',
                title: 'Every message stored',
                desc: 'Raw messages saved with cryptographic hashes. Nothing is deleted or truncated.',
              },
              {
                num: '02',
                title: 'Semantic indexing',
                desc: 'Vector embeddings enable search by meaning, not just keywords.',
              },
              {
                num: '03',
                title: 'Automatic summaries',
                desc: 'Daily and weekly summaries compress context while preserving key details.',
              },
            ].map((item, i) => (
              <div key={i} className="step">
                <div className="step-num">{item.num}</div>
                <h3 className="step-title">{item.title}</h3>
                <p className="step-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="features-section">
        <div className="section-inner">
          <h2 className="section-title">Features</h2>

          <div className="features-grid">
            {[
              {
                title: 'Your own API keys',
                desc: 'Connect OpenAI, Anthropic, or Google. Pay providers directly at their rates.',
              },
              {
                title: 'Semantic search',
                desc: 'Find past conversations by meaning. Ask "what did we decide about caching?" and get results.',
              },
              {
                title: 'Verified exports',
                desc: 'Export conversations to PDF or Markdown with SHA-256 hashes for verification.',
              },
              {
                title: 'Private and encrypted',
                desc: 'Your data is encrypted at rest. We never train on your conversations.',
              },
            ].map((feature, i) => (
              <div key={i} className="feature-card">
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="pricing-section">
        <div className="section-inner">
          <h2 className="section-title">Simple pricing</h2>
          
          <div className="pricing-card">
            <div className="pricing-header">
              <span className="pricing-amount">$20</span>
              <span className="pricing-period">/ month</span>
            </div>
            <p className="pricing-desc">
              Unlimited conversations. Permanent memory. Your API keys.
            </p>
            <ul className="pricing-features">
              <li>Unlimited conversations</li>
              <li>Permanent message storage</li>
              <li>Semantic search across all chats</li>
              <li>Export anytime (PDF, Markdown, JSON)</li>
              <li>Use your own API keys</li>
            </ul>
            <button 
              onClick={() => document.getElementById('waitlist').scrollIntoView({ behavior: 'smooth' })}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              Join waitlist
            </button>
            <p className="pricing-note">Cancel anytime. No lock-in.</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Stop losing your AI conversations</h2>
          <p>Install the extension in 60 seconds. Free forever.</p>
          <div className="waitlist-form" style={{ maxWidth: '400px', margin: '0 auto' }}>
            <a href="/download" className="btn btn-primary" style={{ width: '100%', background: '#fff', color: '#1a1a1a', padding: '16px 32px', fontSize: '16px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/><circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/></svg>
              Add to Chrome — free
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <span className="footer-logo">Tools AI</span>
          <div className="footer-links">
            <a href="/download">Download</a>
            <a href="/dashboard">Dashboard</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </div>
        </div>
      </footer>

      <style>{`
        /* ============================================
           BASE STYLES & RESET
           ============================================ */
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        html {
          scroll-behavior: smooth;
          -webkit-text-size-adjust: 100%;
        }
        
        .landing-page {
          min-height: 100vh;
          background: #fff;
          color: #1a1a1a;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          overflow-x: hidden;
        }

        /* ============================================
           NAVIGATION
           ============================================ */
        .nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid #f0f0f0;
        }

        .nav-inner {
          max-width: 1140px;
          margin: 0 auto;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .logo {
          font-weight: 700;
          font-size: 18px;
          letter-spacing: -0.5px;
        }

        .nav-links-desktop {
          display: flex;
          align-items: center;
          gap: 32px;
        }

        .nav-links-desktop a {
          color: #666;
          text-decoration: none;
          font-size: 14px;
        }

        .nav-links-desktop a:hover {
          color: #1a1a1a;
        }

        .mobile-menu-btn {
          display: none;
          background: none;
          border: none;
          padding: 8px;
          cursor: pointer;
        }

        .hamburger {
          display: flex;
          flex-direction: column;
          gap: 5px;
          width: 24px;
        }

        .hamburger span {
          display: block;
          height: 2px;
          background: #1a1a1a;
          border-radius: 2px;
          transition: all 0.3s ease;
        }

        .hamburger.open span:nth-child(1) {
          transform: rotate(45deg) translate(5px, 5px);
        }

        .hamburger.open span:nth-child(2) {
          opacity: 0;
        }

        .hamburger.open span:nth-child(3) {
          transform: rotate(-45deg) translate(5px, -5px);
        }

        .mobile-menu {
          display: none;
          padding: 16px 20px 20px;
          border-top: 1px solid #f0f0f0;
        }

        .mobile-menu a {
          display: block;
          padding: 12px 0;
          color: #666;
          text-decoration: none;
          font-size: 16px;
          border-bottom: 1px solid #f0f0f0;
        }

        /* ============================================
           BUTTONS & INPUTS
           ============================================ */
        .btn {
          padding: 14px 24px;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: opacity 0.2s;
        }

        .btn:hover {
          opacity: 0.9;
        }

        .btn-primary {
          background: #1a1a1a;
          color: #fff;
        }

        .btn-sm {
          padding: 10px 18px;
          font-size: 14px;
        }

        .input {
          padding: 14px 16px;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          font-size: 15px;
          width: 280px;
          outline: none;
        }

        .input:focus {
          border-color: #1a1a1a;
        }

        /* ============================================
           HERO
           ============================================ */
        .hero {
          padding: 140px 20px 80px;
          text-align: center;
        }

        .hero-content {
          max-width: 700px;
          margin: 0 auto;
        }

        .badge {
          display: inline-block;
          padding: 6px 14px;
          background: #f5f5f5;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
          color: #666;
          margin-bottom: 24px;
        }

        .hero-title {
          font-size: 52px;
          font-weight: 700;
          line-height: 1.1;
          letter-spacing: -2px;
          margin-bottom: 20px;
        }

        .hero-subtitle {
          font-size: 18px;
          color: #666;
          line-height: 1.6;
          margin-bottom: 32px;
        }

        .hero-subtitle strong {
          color: #1a1a1a;
        }

        .waitlist-form {
          display: inline-block;
        }

        .form-row {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .form-note {
          margin-top: 12px;
          font-size: 13px;
          color: #888;
        }

        .success-message {
          padding: 16px 32px;
          background: #f0fdf4;
          border-radius: 8px;
          color: #166534;
          font-weight: 500;
        }

        /* ============================================
           PREVIEW SECTION
           ============================================ */
        .preview-section {
          padding: 0 20px 80px;
        }

        .preview-container {
          max-width: 1000px;
          margin: 0 auto;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15);
          border: 1px solid #e5e5e5;
        }

        .browser-chrome {
          background: #f5f5f5;
          padding: 14px 16px;
          display: flex;
          gap: 8px;
          border-bottom: 1px solid #e5e5e5;
        }

        .browser-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .browser-dot.red { background: #ff5f57; }
        .browser-dot.yellow { background: #ffbd2e; }
        .browser-dot.green { background: #28c840; }

        .chat-preview {
          display: flex;
          min-height: 400px;
          background: #fff;
        }

        .chat-sidebar {
          width: 240px;
          background: #fafafa;
          padding: 16px;
          border-right: 1px solid #f0f0f0;
        }

        .new-chat-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: #fff;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 20px;
        }

        .chat-label {
          font-size: 12px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .chat-item {
          padding: 10px 12px;
          font-size: 14px;
          color: #666;
          border-radius: 6px;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .chat-item.active {
          background: #fff;
          color: #1a1a1a;
        }

        .chat-area {
          flex: 1;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .message {
          display: flex;
          gap: 12px;
        }

        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .avatar.user {
          background: #e5e5e5;
          color: #666;
        }

        .avatar.ai {
          background: #1a1a1a;
          color: #fff;
        }

        .message-content {
          flex: 1;
        }

        .message-text {
          font-size: 15px;
          line-height: 1.6;
          color: #1a1a1a;
        }

        .code-block {
          margin-top: 12px;
          padding: 16px;
          background: #f5f5f5;
          border-radius: 8px;
          font-size: 14px;
          line-height: 1.8;
        }

        .memory-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 12px;
          padding: 8px 14px;
          background: #f0f9ff;
          border-radius: 6px;
          font-size: 13px;
          color: #0369a1;
        }

        /* ============================================
           COMPARISON SECTION
           ============================================ */
        .comparison-section {
          padding: 80px 20px;
          background: #fafafa;
        }

        .section-inner {
          max-width: 900px;
          margin: 0 auto;
        }

        .section-title {
          font-size: 32px;
          font-weight: 700;
          text-align: center;
          margin-bottom: 16px;
          letter-spacing: -1px;
        }

        .section-subtitle {
          text-align: center;
          color: #666;
          font-size: 18px;
          margin-bottom: 48px;
        }

        .comparison-table-wrapper {
          overflow-x: auto;
        }

        .comparison-table {
          width: 100%;
          border-collapse: collapse;
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
        }

        .comparison-table th,
        .comparison-table td {
          padding: 16px 20px;
          text-align: left;
          border-bottom: 1px solid #f0f0f0;
        }

        .comparison-table th {
          background: #f5f5f5;
          font-weight: 600;
          font-size: 14px;
        }

        .comparison-table th.highlight {
          background: #1a1a1a;
          color: #fff;
        }

        .comparison-table td.label {
          font-weight: 500;
          color: #1a1a1a;
        }

        .comparison-table td.bad {
          color: #888;
        }

        .comparison-table td.good {
          color: #166534;
          font-weight: 500;
        }

        /* ============================================
           PROBLEM SECTION
           ============================================ */
        .problem-section {
          padding: 80px 20px;
          background: #1a1a1a;
          color: #fff;
        }

        .problem-content {
          max-width: 700px;
          margin: 0 auto;
          text-align: center;
        }

        .problem-content h2 {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 20px;
          letter-spacing: -1px;
        }

        .problem-content p {
          font-size: 18px;
          color: #a0a0a0;
          line-height: 1.7;
        }

        /* ============================================
           AUDIENCE SECTION
           ============================================ */
        .audience-section {
          padding: 80px 20px;
        }

        .audience-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-bottom: 32px;
        }

        .audience-item {
          text-align: center;
          padding: 32px 24px;
          background: #fafafa;
          border-radius: 12px;
        }

        .audience-icon {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 16px;
          color: #1a1a1a;
        }

        .audience-item h3 {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .audience-item p {
          font-size: 14px;
          color: #666;
          line-height: 1.5;
        }

        .audience-summary {
          text-align: center;
          font-size: 16px;
          color: #888;
          font-style: italic;
        }

        /* ============================================
           HOW IT WORKS
           ============================================ */
        .how-section {
          padding: 80px 20px;
          background: #fafafa;
        }

        .steps-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 40px;
          margin-top: 48px;
        }

        .step {
          text-align: center;
        }

        .step-num {
          font-size: 48px;
          font-weight: 700;
          color: #e5e5e5;
          margin-bottom: 16px;
        }

        .step-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .step-desc {
          font-size: 15px;
          color: #666;
          line-height: 1.6;
        }

        /* ============================================
           FEATURES
           ============================================ */
        .features-section {
          padding: 80px 20px;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 24px;
          margin-top: 48px;
        }

        .feature-card {
          padding: 32px;
          background: #fafafa;
          border-radius: 12px;
        }

        .feature-card h3 {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .feature-card p {
          font-size: 15px;
          color: #666;
          line-height: 1.6;
        }

        /* ============================================
           PRICING
           ============================================ */
        .pricing-section {
          padding: 80px 20px;
          background: #fafafa;
        }

        .pricing-card {
          max-width: 400px;
          margin: 48px auto 0;
          padding: 40px;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
          text-align: center;
        }

        .pricing-header {
          margin-bottom: 16px;
        }

        .pricing-amount {
          font-size: 48px;
          font-weight: 700;
          letter-spacing: -2px;
        }

        .pricing-period {
          font-size: 18px;
          color: #666;
        }

        .pricing-desc {
          color: #666;
          margin-bottom: 24px;
        }

        .pricing-features {
          list-style: none;
          text-align: left;
          margin-bottom: 32px;
        }

        .pricing-features li {
          padding: 10px 0;
          border-bottom: 1px solid #f0f0f0;
          font-size: 15px;
        }

        .pricing-features li::before {
          content: "→";
          margin-right: 10px;
          color: #1a1a1a;
        }

        .pricing-note {
          margin-top: 12px;
          font-size: 13px;
          color: #888;
        }

        /* ============================================
           CTA SECTION
           ============================================ */
        .cta-section {
          padding: 80px 20px;
          text-align: center;
        }

        .cta-content {
          max-width: 600px;
          margin: 0 auto;
        }

        .cta-content h2 {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 12px;
          letter-spacing: -1px;
        }

        .cta-content p {
          color: #666;
          font-size: 18px;
          margin-bottom: 32px;
        }

        /* ============================================
           FOOTER
           ============================================ */
        .footer {
          padding: 24px 20px;
          border-top: 1px solid #f0f0f0;
        }

        .footer-inner {
          max-width: 1140px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .footer-logo {
          font-size: 14px;
          color: #888;
          font-weight: 500;
        }

        .footer-links {
          display: flex;
          gap: 24px;
        }

        .footer-links a {
          font-size: 14px;
          color: #888;
          text-decoration: none;
        }

        .footer-links a:hover {
          color: #1a1a1a;
        }

        /* ============================================
           TABLET STYLES (768px and below)
           ============================================ */
        @media (max-width: 768px) {
          .nav-links-desktop {
            display: none;
          }

          .mobile-menu-btn {
            display: block;
          }

          .mobile-menu {
            display: block;
          }

          .hero {
            padding: 120px 20px 60px;
          }

          .hero-title {
            font-size: 36px;
            letter-spacing: -1px;
          }

          .hero-subtitle {
            font-size: 16px;
          }

          .preview-section {
            padding: 0 20px 60px;
          }

          .chat-sidebar {
            display: none;
          }

          .chat-preview {
            min-height: 300px;
          }

          .chat-area {
            padding: 20px;
          }

          .audience-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .steps-grid {
            grid-template-columns: 1fr;
            gap: 32px;
          }

          .features-grid {
            grid-template-columns: 1fr;
          }

          .problem-content h2,
          .section-title,
          .cta-content h2 {
            font-size: 24px;
          }

          .problem-content p,
          .cta-content p {
            font-size: 16px;
          }

          .comparison-table th,
          .comparison-table td {
            padding: 12px 14px;
            font-size: 13px;
          }
        }

        /* ============================================
           MOBILE STYLES (480px and below)
           ============================================ */
        @media (max-width: 480px) {
          .nav-inner {
            padding: 14px 16px;
          }

          .hero {
            padding: 110px 16px 50px;
          }

          .hero-title {
            font-size: 32px;
            letter-spacing: -0.5px;
          }

          .hero-subtitle {
            font-size: 15px;
            margin-bottom: 28px;
          }

          .badge {
            font-size: 12px;
            padding: 5px 12px;
            margin-bottom: 20px;
          }

          .form-row {
            flex-direction: column;
          }

          .btn {
            width: 100%;
            padding: 16px 24px;
          }

          .input {
            width: 100%;
          }

          .preview-section {
            padding: 0 16px 50px;
          }

          .preview-container {
            border-radius: 12px;
          }

          .browser-chrome {
            padding: 12px 14px;
          }

          .browser-dot {
            width: 10px;
            height: 10px;
          }

          .chat-area {
            padding: 16px;
            gap: 20px;
          }

          .message-text {
            font-size: 13px;
          }

          .code-block {
            padding: 12px;
            font-size: 13px;
          }

          .memory-tag {
            font-size: 11px;
            padding: 8px 12px;
          }

          .audience-grid {
            grid-template-columns: 1fr;
          }

          .problem-section,
          .how-section,
          .features-section,
          .pricing-section,
          .comparison-section,
          .audience-section {
            padding: 60px 16px;
          }

          .section-title {
            margin-bottom: 36px;
          }

          .step-num {
            font-size: 36px;
          }

          .step-title {
            font-size: 16px;
          }

          .step-desc {
            font-size: 14px;
          }

          .feature-card {
            padding: 20px;
          }

          .feature-card h3 {
            font-size: 15px;
          }

          .feature-card p {
            font-size: 14px;
          }

          .pricing-card {
            padding: 28px 20px;
          }

          .pricing-amount {
            font-size: 40px;
          }

          .cta-section {
            padding: 70px 16px;
          }

          .footer {
            padding: 20px 16px;
          }

          .footer-inner {
            flex-direction: column;
            gap: 16px;
            text-align: center;
          }

          .footer-links {
            gap: 20px;
          }
        }

        /* ============================================
           SMALL MOBILE (iPhone SE, etc - 375px and below)
           ============================================ */
        @media (max-width: 375px) {
          .hero-title {
            font-size: 28px;
          }

          .hero-subtitle {
            font-size: 14px;
          }

          .problem-content h2,
          .section-title,
          .cta-content h2 {
            font-size: 22px;
          }
        }

        /* ============================================
           iOS SAFE AREA SUPPORT
           ============================================ */
        @supports (padding-top: env(safe-area-inset-top)) {
          .nav {
            padding-top: env(safe-area-inset-top);
          }

          .footer {
            padding-bottom: calc(24px + env(safe-area-inset-bottom));
          }
        }

        /* ============================================
           PREVENT iOS TAP HIGHLIGHT
           ============================================ */
        a, button {
          -webkit-tap-highlight-color: transparent;
        }

        /* ============================================
           SMOOTH SCROLLING FIX FOR iOS
           ============================================ */
        @supports (-webkit-touch-callout: none) {
          html {
            scroll-behavior: auto;
          }
        }
      `}</style>
    </div>
  );
}

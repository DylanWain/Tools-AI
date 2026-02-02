import React, { useState } from 'react';
import Head from 'next/head';

export default function Download() {
  const [showManual, setShowManual] = useState(false);

  return (
    <>
      <Head>
        <title>Download Tools AI - Chrome Extension</title>
        <meta name="description" content="Install the Tools AI Chrome extension to capture every AI conversation across ChatGPT, Claude, and Gemini." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>

      <div className="download-page">
        <nav className="dl-nav">
          <a href="/" className="dl-logo">Tools AI</a>
          <a href="/dashboard" className="dl-nav-link">Dashboard</a>
        </nav>

        <section className="dl-hero">
          <div className="dl-icon">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="28" stroke="#1a1a1a" strokeWidth="2.5" fill="#f5f5f5"/>
              <circle cx="32" cy="32" r="12" stroke="#1a1a1a" strokeWidth="2" fill="white"/>
              <line x1="32" y1="4" x2="32" y2="20" stroke="#1a1a1a" strokeWidth="2"/>
              <line x1="7" y1="46" x2="21" y2="38" stroke="#1a1a1a" strokeWidth="2"/>
              <line x1="57" y1="46" x2="43" y2="38" stroke="#1a1a1a" strokeWidth="2"/>
            </svg>
          </div>
          <h1>Get Tools AI for Chrome</h1>
          <p className="dl-subtitle">
            Capture every AI conversation across ChatGPT, Claude, and Gemini. 
            Free, private, and takes 60 seconds to install.
          </p>

          <div className="dl-buttons">
            <a 
              href="https://chrome.google.com/webstore/detail/kmhlfdeaimgihpggdjijcndmkfieomal" 
              target="_blank" 
              rel="noopener noreferrer"
              className="dl-btn dl-btn-primary"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/><circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/></svg>
              Add to Chrome — free
            </a>
            <button className="dl-btn dl-btn-secondary" onClick={() => setShowManual(!showManual)}>
              {showManual ? 'Hide' : 'Manual install instructions'}
            </button>
          </div>
        </section>

        {showManual && (
          <section className="dl-manual">
            <h2>Manual Install (Developer Mode)</h2>
            <p>If the extension isn't on the Chrome Web Store yet, or you want to install a local copy:</p>
            <div className="dl-steps">
              <div className="dl-step">
                <span className="dl-step-num">1</span>
                <div>
                  <strong>Download the ZIP</strong>
                  <p>Download the extension file and unzip it to a folder on your computer.</p>
                </div>
              </div>
              <div className="dl-step">
                <span className="dl-step-num">2</span>
                <div>
                  <strong>Open Chrome Extensions</strong>
                  <p>Go to <code>chrome://extensions</code> in your browser address bar.</p>
                </div>
              </div>
              <div className="dl-step">
                <span className="dl-step-num">3</span>
                <div>
                  <strong>Enable Developer Mode</strong>
                  <p>Toggle the "Developer mode" switch in the top-right corner.</p>
                </div>
              </div>
              <div className="dl-step">
                <span className="dl-step-num">4</span>
                <div>
                  <strong>Load Unpacked</strong>
                  <p>Click "Load unpacked" and select the unzipped extension folder.</p>
                </div>
              </div>
              <div className="dl-step">
                <span className="dl-step-num">5</span>
                <div>
                  <strong>You're done!</strong>
                  <p>Visit ChatGPT, Claude, or Gemini and start chatting. Tools AI captures everything automatically.</p>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="dl-features">
          <h2>What you get</h2>
          <div className="dl-feature-grid">
            {[
              { title: 'Auto-capture', desc: 'Every message saved automatically from ChatGPT, Claude, and Gemini' },
              { title: '⌘+Shift+K', desc: 'Search and inject context from any past conversation, on any platform' },
              { title: 'Code extraction', desc: 'All code blocks detected and indexed separately for quick reference' },
              { title: 'File tracking', desc: 'Downloads from AI platforms automatically captured and linked' },
              { title: 'Cloud dashboard', desc: 'Sign in to view all conversations in a searchable web dashboard' },
              { title: 'Private by default', desc: 'Your data stays in your browser. Cloud sync is optional.' },
            ].map((f, i) => (
              <div key={i} className="dl-feature-card">
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="dl-connect">
          <h2>Connect to your dashboard</h2>
          <p>
            After installing, sign in through the extension popup to sync your conversations 
            to the cloud. Access them from any device at <a href="/dashboard">/dashboard</a>.
          </p>
          <div className="dl-connect-steps">
            <div>1. Click the Tools AI icon in Chrome toolbar</div>
            <div>2. Click "Sign in" or "Create account"</div>
            <div>3. Your conversations auto-sync to the cloud</div>
          </div>
        </section>

        <footer className="dl-footer">
          <div className="dl-footer-inner">
            <span>Tools AI</span>
            <div className="dl-footer-links">
              <a href="/">Home</a>
              <a href="/dashboard">Dashboard</a>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
            </div>
          </div>
        </footer>
      </div>

      <style jsx>{`
        .download-page {
          min-height: 100vh;
          background: #fff;
          color: #1a1a1a;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .dl-nav {
          max-width: 1000px;
          margin: 0 auto;
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .dl-logo {
          font-weight: 700;
          font-size: 18px;
          color: #1a1a1a;
          text-decoration: none;
        }
        .dl-nav-link {
          color: #666;
          text-decoration: none;
          font-size: 14px;
        }
        .dl-hero {
          text-align: center;
          padding: 60px 20px 80px;
          max-width: 640px;
          margin: 0 auto;
        }
        .dl-icon {
          margin-bottom: 24px;
        }
        .dl-hero h1 {
          font-size: 40px;
          font-weight: 700;
          letter-spacing: -1.5px;
          margin-bottom: 16px;
        }
        .dl-subtitle {
          font-size: 17px;
          color: #666;
          line-height: 1.6;
          margin-bottom: 32px;
        }
        .dl-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .dl-btn {
          padding: 16px 32px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          border: none;
          text-decoration: none;
          transition: all 0.2s;
        }
        .dl-btn-primary {
          background: #1a1a1a;
          color: #fff;
        }
        .dl-btn-primary:hover { opacity: 0.9; }
        .dl-btn-secondary {
          background: #f5f5f5;
          color: #1a1a1a;
          border: 1px solid #e5e5e5;
        }
        .dl-btn-secondary:hover { background: #eee; }

        .dl-manual {
          max-width: 640px;
          margin: 0 auto;
          padding: 0 20px 60px;
        }
        .dl-manual h2 {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 12px;
        }
        .dl-manual > p {
          color: #666;
          margin-bottom: 24px;
        }
        .dl-steps {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .dl-step {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          padding: 16px;
          background: #fafafa;
          border-radius: 12px;
          border: 1px solid #eee;
        }
        .dl-step-num {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #1a1a1a;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 14px;
          flex-shrink: 0;
        }
        .dl-step strong { display: block; margin-bottom: 4px; }
        .dl-step p { color: #666; font-size: 14px; margin: 0; }
        .dl-step code {
          background: #eee;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 13px;
        }

        .dl-features {
          max-width: 800px;
          margin: 0 auto;
          padding: 60px 20px;
          border-top: 1px solid #eee;
        }
        .dl-features h2 {
          font-size: 24px;
          font-weight: 700;
          text-align: center;
          margin-bottom: 32px;
        }
        .dl-feature-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }
        .dl-feature-card {
          padding: 20px;
          border: 1px solid #eee;
          border-radius: 10px;
        }
        .dl-feature-card h3 {
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 6px;
        }
        .dl-feature-card p {
          font-size: 14px;
          color: #666;
          line-height: 1.5;
        }

        .dl-connect {
          max-width: 640px;
          margin: 0 auto;
          padding: 60px 20px;
          text-align: center;
          border-top: 1px solid #eee;
        }
        .dl-connect h2 {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 12px;
        }
        .dl-connect > p {
          color: #666;
          margin-bottom: 24px;
          line-height: 1.6;
        }
        .dl-connect a { color: #1a1a1a; font-weight: 500; }
        .dl-connect-steps {
          display: flex;
          flex-direction: column;
          gap: 8px;
          text-align: left;
          max-width: 360px;
          margin: 0 auto;
        }
        .dl-connect-steps div {
          padding: 12px 16px;
          background: #fafafa;
          border-radius: 8px;
          font-size: 14px;
          border: 1px solid #eee;
        }

        .dl-footer {
          padding: 24px 20px;
          border-top: 1px solid #f0f0f0;
          margin-top: 40px;
        }
        .dl-footer-inner {
          max-width: 1000px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          color: #888;
        }
        .dl-footer-links { display: flex; gap: 20px; }
        .dl-footer-links a { color: #888; text-decoration: none; }
        .dl-footer-links a:hover { color: #1a1a1a; }

        @media (max-width: 640px) {
          .dl-hero h1 { font-size: 28px; }
          .dl-buttons { flex-direction: column; }
          .dl-feature-grid { grid-template-columns: 1fr; }
          .dl-footer-inner { flex-direction: column; gap: 12px; }
        }
      `}</style>
    </>
  );
}

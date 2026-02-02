import React from 'react';
import Head from 'next/head';

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy - Tools AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>

      <div className="legal-page">
        <nav className="legal-nav">
          <a href="/" className="legal-logo">Tools AI</a>
        </nav>

        <div className="legal-content">
          <h1>Privacy Policy</h1>
          <p className="legal-date">Last updated: February 1, 2026</p>

          <section>
            <h2>1. Introduction</h2>
            <p>
              Tools AI ("we", "our", "us") operates the Tools AI website and Chrome extension 
              (collectively, the "Service"). This Privacy Policy explains how we collect, use, 
              disclose, and safeguard your information when you use our Service.
            </p>
          </section>

          <section>
            <h2>2. Information We Collect</h2>
            
            <h3>2.1 Account Information</h3>
            <p>
              When you create an account, we collect your email address and a hashed version 
              of your password. We never store passwords in plain text.
            </p>

            <h3>2.2 Conversation Data</h3>
            <p>
              Our Chrome extension captures conversations you have with AI platforms 
              (ChatGPT, Claude, Gemini) that you visit while the extension is active. This includes:
            </p>
            <ul>
              <li>Message content (both your messages and AI responses)</li>
              <li>Conversation titles and timestamps</li>
              <li>Code blocks extracted from conversations</li>
              <li>File downloads initiated during AI conversations</li>
            </ul>
            <p>
              <strong>Important:</strong> Data is captured only on AI platform websites you actively 
              visit. We do not monitor or capture any other browsing activity.
            </p>

            <h3>2.3 Usage Data</h3>
            <p>
              We may collect basic usage analytics such as feature usage counts and error reports 
              to improve the Service. We do not track your browsing history outside of supported 
              AI platforms.
            </p>
          </section>

          <section>
            <h2>3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, maintain, and improve the Service</li>
              <li>Store and organize your AI conversations for your personal use</li>
              <li>Enable search across your saved conversations</li>
              <li>Authenticate your account and protect your data</li>
              <li>Send you important service updates (not marketing)</li>
            </ul>
          </section>

          <section>
            <h2>4. Data Storage and Security</h2>
            <p>
              Your data is stored in secure databases hosted by Supabase (built on PostgreSQL) 
              with encryption at rest. All data transmission between your browser and our servers 
              uses HTTPS/TLS encryption.
            </p>
            <p>
              Each user's data is isolated — you can only access your own conversations. 
              We use JWT-based authentication to verify your identity on every request.
            </p>
          </section>

          <section>
            <h2>5. Data Sharing</h2>
            <p>
              <strong>We do not sell, trade, or share your personal data with third parties.</strong>
            </p>
            <p>We may share data only in these limited circumstances:</p>
            <ul>
              <li>With your explicit consent</li>
              <li>To comply with legal obligations or valid legal processes</li>
              <li>To protect the safety of our users or the public</li>
              <li>With service providers who help operate the Service (e.g., hosting), under strict confidentiality agreements</li>
            </ul>
          </section>

          <section>
            <h2>6. AI Training</h2>
            <p>
              <strong>We never use your conversations to train AI models.</strong> Your data is 
              yours alone, stored for your personal use and retrieval.
            </p>
          </section>

          <section>
            <h2>7. Your API Keys</h2>
            <p>
              If you provide API keys (OpenAI, Anthropic, Google) for the chat feature, 
              these keys are stored locally in your browser's localStorage and are sent 
              directly to the respective AI provider. We do not store your API keys on our servers.
            </p>
          </section>

          <section>
            <h2>8. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li><strong>Access</strong> your data at any time through the dashboard</li>
              <li><strong>Export</strong> all your conversations in standard formats</li>
              <li><strong>Delete</strong> any or all of your conversations</li>
              <li><strong>Close</strong> your account and have all data permanently removed</li>
            </ul>
            <p>
              To exercise any of these rights, contact us at privacy@thetoolswebsite.com or use the 
              in-app deletion features.
            </p>
          </section>

          <section>
            <h2>9. Chrome Extension Permissions</h2>
            <p>The Tools AI Chrome extension requests the following permissions:</p>
            <ul>
              <li><strong>activeTab:</strong> To read AI conversation content on the current tab</li>
              <li><strong>storage:</strong> To save captured conversations locally</li>
              <li><strong>downloads:</strong> To detect and catalog file downloads from AI platforms</li>
            </ul>
            <p>
              The extension only activates on AI platform domains (chat.openai.com, claude.ai, 
              gemini.google.com). It does not access any other websites.
            </p>
          </section>

          <section>
            <h2>10. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. If you delete your 
              account, all associated data is permanently removed within 30 days. Waitlist 
              email addresses are retained until the user unsubscribes or requests removal.
            </p>
          </section>

          <section>
            <h2>11. Children's Privacy</h2>
            <p>
              Our Service is not intended for children under 13. We do not knowingly collect 
              information from children under 13.
            </p>
          </section>

          <section>
            <h2>12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of 
              significant changes by email or through the Service. Your continued use of 
              the Service after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2>13. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us at:
            </p>
            <p>
              Email: privacy@thetoolswebsite.com
            </p>
          </section>
        </div>

        <footer className="legal-footer">
          <a href="/">← Back to Tools AI</a>
          <a href="/terms">Terms of Service</a>
        </footer>
      </div>

      <style jsx>{`
        .legal-page {
          min-height: 100vh;
          background: #fff;
          color: #1a1a1a;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .legal-nav {
          padding: 16px 24px;
          border-bottom: 1px solid #f0f0f0;
        }

        .legal-logo {
          font-weight: 700;
          font-size: 18px;
          color: #1a1a1a;
          text-decoration: none;
        }

        .legal-content {
          max-width: 720px;
          margin: 0 auto;
          padding: 48px 24px 80px;
        }

        h1 {
          font-size: 36px;
          font-weight: 700;
          margin: 0 0 8px 0;
          letter-spacing: -1px;
        }

        .legal-date {
          color: #888;
          font-size: 14px;
          margin-bottom: 48px;
        }

        section {
          margin-bottom: 36px;
        }

        h2 {
          font-size: 20px;
          font-weight: 600;
          margin: 0 0 12px 0;
        }

        h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 16px 0 8px 0;
        }

        p {
          font-size: 15px;
          line-height: 1.7;
          color: #444;
          margin: 0 0 12px 0;
        }

        ul {
          margin: 8px 0 16px 20px;
          padding: 0;
        }

        li {
          font-size: 15px;
          line-height: 1.7;
          color: #444;
          margin-bottom: 6px;
        }

        strong {
          color: #1a1a1a;
        }

        .legal-footer {
          max-width: 720px;
          margin: 0 auto;
          padding: 24px;
          border-top: 1px solid #f0f0f0;
          display: flex;
          justify-content: space-between;
          font-size: 14px;
        }

        .legal-footer a {
          color: #666;
          text-decoration: none;
        }

        .legal-footer a:hover {
          color: #1a1a1a;
        }

        @media (max-width: 480px) {
          h1 { font-size: 28px; }
          .legal-content { padding: 32px 16px 60px; }
        }
      `}</style>
    </>
  );
}

import React from 'react';
import Head from 'next/head';

export default function Terms() {
  return (
    <>
      <Head>
        <title>Terms of Service - Tools AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>

      <div className="legal-page">
        <nav className="legal-nav">
          <a href="/" className="legal-logo">Tools AI</a>
        </nav>

        <div className="legal-content">
          <h1>Terms of Service</h1>
          <p className="legal-date">Last updated: February 1, 2026</p>

          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using Tools AI ("the Service"), you agree to be bound by these 
              Terms of Service. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2>2. Description of Service</h2>
            <p>
              Tools AI provides a Chrome extension and web dashboard for capturing, storing, 
              and searching AI conversations across multiple platforms. The Service also includes 
              an AI chat interface where users can interact with AI models using their own API keys.
            </p>
          </section>

          <section>
            <h2>3. User Accounts</h2>
            <p>
              You may use certain features anonymously or create an account for cloud sync. 
              You are responsible for maintaining the confidentiality of your account credentials 
              and for all activity under your account.
            </p>
          </section>

          <section>
            <h2>4. Your API Keys</h2>
            <p>
              The Service allows you to use your own API keys from providers like OpenAI, 
              Anthropic, and Google. You are responsible for all charges incurred through 
              your API keys. We are not liable for any costs, rate limits, or issues with 
              third-party AI providers.
            </p>
          </section>

          <section>
            <h2>5. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any illegal purpose</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Reverse engineer or decompile the Service</li>
              <li>Use the Service to store or transmit malicious content</li>
              <li>Resell or redistribute the Service without permission</li>
            </ul>
          </section>

          <section>
            <h2>6. Data Ownership</h2>
            <p>
              You retain ownership of all content you create and store through the Service, 
              including conversations, code, and files. We claim no ownership over your data.
            </p>
          </section>

          <section>
            <h2>7. Service Availability</h2>
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted 
              service. We may perform maintenance, updates, or modifications that temporarily 
              affect availability.
            </p>
          </section>

          <section>
            <h2>8. Limitation of Liability</h2>
            <p>
              The Service is provided "as is" without warranties of any kind. We are not 
              liable for any indirect, incidental, or consequential damages arising from 
              your use of the Service, including but not limited to data loss.
            </p>
          </section>

          <section>
            <h2>9. Termination</h2>
            <p>
              We may terminate or suspend your access to the Service at our discretion, 
              with or without cause. You may close your account at any time. Upon termination, 
              your data will be deleted in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2>10. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of the Service 
              after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2>11. Contact</h2>
            <p>
              Questions about these Terms? Contact us at support@thetoolswebsite.com.
            </p>
          </section>
        </div>

        <footer className="legal-footer">
          <a href="/">← Back to Tools AI</a>
          <a href="/privacy">Privacy Policy</a>
        </footer>
      </div>

      <style jsx>{`
        .legal-page {
          min-height: 100vh;
          background: #fff;
          color: #1a1a1a;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .legal-nav { padding: 16px 24px; border-bottom: 1px solid #f0f0f0; }
        .legal-logo { font-weight: 700; font-size: 18px; color: #1a1a1a; text-decoration: none; }
        .legal-content { max-width: 720px; margin: 0 auto; padding: 48px 24px 80px; }
        h1 { font-size: 36px; font-weight: 700; margin: 0 0 8px 0; letter-spacing: -1px; }
        .legal-date { color: #888; font-size: 14px; margin-bottom: 48px; }
        section { margin-bottom: 36px; }
        h2 { font-size: 20px; font-weight: 600; margin: 0 0 12px 0; }
        p { font-size: 15px; line-height: 1.7; color: #444; margin: 0 0 12px 0; }
        ul { margin: 8px 0 16px 20px; padding: 0; }
        li { font-size: 15px; line-height: 1.7; color: #444; margin-bottom: 6px; }
        .legal-footer {
          max-width: 720px; margin: 0 auto; padding: 24px;
          border-top: 1px solid #f0f0f0; display: flex;
          justify-content: space-between; font-size: 14px;
        }
        .legal-footer a { color: #666; text-decoration: none; }
        .legal-footer a:hover { color: #1a1a1a; }
        @media (max-width: 480px) {
          h1 { font-size: 28px; }
          .legal-content { padding: 32px 16px 60px; }
        }
      `}</style>
    </>
  );
}

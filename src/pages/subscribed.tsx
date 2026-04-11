// Tools AI — /subscribed
//
// Post-checkout success page. Stripe redirects here after a successful
// Checkout Session. We show a confirmation + deep-link back to the
// extension so the quotaService re-fetches and the status bar flips from
// "Trial" to "Chad" or "PAYG".

import Head from 'next/head';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Subscribed() {
  const router = useRouter();

  useEffect(() => {
    // Bounce back to the extension after 1.5s so the user sees the confirmation.
    const t = setTimeout(() => {
      window.location.href = 'tools-ai://tools-ai.tools-ai/auth?refreshed=1';
    }, 1500);
    return () => clearTimeout(t);
  }, [router.query]);

  return (
    <>
      <Head>
        <title>Welcome · Tools AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={styles.page}>
        <div style={styles.card}>
          <div style={styles.check}>✓</div>
          <h1 style={styles.title}>You&apos;re in.</h1>
          <p style={styles.sub}>
            Subscription active. Returning you to Tools AI…
          </p>
          <p style={styles.manual}>
            If the extension doesn&apos;t open automatically, click{' '}
            <a
              href="tools-ai://tools-ai.tools-ai/auth?refreshed=1"
              style={styles.link}
            >
              here
            </a>
            .
          </p>
        </div>
      </main>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0f',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: '40px 32px',
    background: '#12121a',
    border: '1px solid #24243a',
    borderRadius: 12,
    color: '#f0f0f5',
    textAlign: 'center',
    boxShadow: '0 12px 60px rgba(0,0,0,0.5)',
  },
  check: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'rgba(80, 208, 128, 0.15)',
    color: '#50d080',
    fontSize: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 18px',
    fontWeight: 700,
  },
  title: { fontSize: 22, fontWeight: 700, margin: '0 0 6px' },
  sub: { fontSize: 13, color: '#9090aa', margin: '0 0 24px' },
  manual: { fontSize: 11, color: '#6060aa', margin: 0 },
  link: { color: '#a5b4fc', textDecoration: 'underline' },
};

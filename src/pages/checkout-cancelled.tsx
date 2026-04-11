// Tools AI — /checkout-cancelled
// Shown when the user hits "Back" in Stripe Checkout. Offers a deep link
// back to the extension.

import Head from 'next/head';

export default function CheckoutCancelled() {
  return (
    <>
      <Head>
        <title>Checkout cancelled · Tools AI</title>
      </Head>
      <main style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>Checkout cancelled</h1>
          <p style={styles.sub}>
            No charge was made. You can try again any time from the extension.
          </p>
          <a href="vscode://tools-ai.tools-ai/auth?refreshed=1" style={styles.link}>
            Return to Tools AI →
          </a>
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
  },
  title: { fontSize: 22, fontWeight: 700, margin: '0 0 8px' },
  sub: { fontSize: 13, color: '#9090aa', margin: '0 0 20px' },
  link: { color: '#a5b4fc', fontSize: 13, textDecoration: 'underline' },
};

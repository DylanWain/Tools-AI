// Tools AI — /loginDeepControl
//
// The landing page the desktop extension opens when the user clicks
// "Sign in for free trial" in the status bar. It's a minimal email-only
// signup flow:
//
//   1. User enters email (no password — they set one later if desired)
//   2. POSTs to /api/v1/signup → creates user row + starts 14-day trial + JWT
//   3. Redirects the browser to `vscode://tools-ai.tools-ai/auth?token=...&email=...`
//   4. VS Code's URI handler dispatches to Tools AI's authService
//   5. Extension stores the token in Keychain, status bar flips to "Chad Trial — 14d"
//
// If the user closes the tab after step 2, we also show the token on screen
// with a "Copy" button as a fallback (matches Warp's UX).

import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function LoginDeepControl() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'redirecting' | 'fallback' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [from, setFrom] = useState<string>('desktop');

  useEffect(() => {
    if (typeof router.query.from === 'string') setFrom(router.query.from);
  }, [router.query.from]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Please enter a valid email.');
      return;
    }
    setStatus('working');
    setError(null);
    try {
      const res = await fetch('/api/v1/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: from }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setError(data.error || 'Signup failed. Please try again.');
        setStatus('error');
        return;
      }
      setToken(data.token);
      setStatus('redirecting');
      // Deep-link back to the extension.
      const deepLink = `vscode://tools-ai.tools-ai/auth?token=${encodeURIComponent(data.token)}&email=${encodeURIComponent(email)}`;
      // Use window.location for deep links — it actually dispatches.
      window.location.href = deepLink;
      // After 2 seconds, if we're still here, fall back to the show-token UI.
      setTimeout(() => setStatus('fallback'), 2000);
    } catch (err: any) {
      setError(err?.message || 'Network error');
      setStatus('error');
    }
  }

  function copyToken() {
    if (!token) return;
    navigator.clipboard.writeText(token).catch(() => {});
  }

  return (
    <>
      <Head>
        <title>Sign in · Tools AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>⚡ Tools AI</div>
          <h1 style={styles.title}>Start your 14-day Chad trial</h1>
          <p style={styles.sub}>
            No credit card required. Full access to all 5 models.
          </p>

          {status === 'fallback' && token ? (
            <div style={styles.fallback}>
              <p style={{ margin: '0 0 10px', fontSize: 13 }}>
                Your browser didn&apos;t redirect back to Tools AI automatically. Copy
                this token and paste it into the extension:
              </p>
              <div style={styles.tokenBox}>{token}</div>
              <button style={styles.primaryBtn} onClick={copyToken}>
                Copy token
              </button>
              <p style={{ margin: '12px 0 0', fontSize: 11, color: '#888' }}>
                In Tools AI: Command Palette → <code>Tools AI: Paste Sign-in Token</code>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={styles.form}>
              <label style={styles.label}>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  required
                  style={styles.input}
                  disabled={status === 'working' || status === 'redirecting'}
                />
              </label>
              {error ? <div style={styles.error}>{error}</div> : null}
              <button
                type="submit"
                style={styles.primaryBtn}
                disabled={status === 'working' || status === 'redirecting'}
              >
                {status === 'working'
                  ? 'Creating trial…'
                  : status === 'redirecting'
                    ? 'Returning to Tools AI…'
                    : 'Start free trial'}
              </button>
              <p style={styles.terms}>
                By continuing, you agree to our Terms of Service and Privacy Policy.
              </p>
            </form>
          )}
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
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: '36px 32px 32px',
    background: '#12121a',
    border: '1px solid #24243a',
    borderRadius: 12,
    color: '#f0f0f5',
    boxShadow: '0 12px 60px rgba(0,0,0,0.5)',
  },
  logo: {
    fontSize: 13,
    fontWeight: 600,
    color: '#a5b4fc',
    marginBottom: 24,
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    margin: '0 0 6px',
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 13,
    color: '#9090aa',
    margin: '0 0 24px',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#9090aa',
  },
  input: {
    padding: '10px 12px',
    borderRadius: 6,
    border: '1px solid #2a2a3e',
    background: '#0a0a12',
    color: '#f0f0f5',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
  },
  primaryBtn: {
    padding: '11px 16px',
    borderRadius: 6,
    border: 'none',
    background: '#818cf8',
    color: '#12121a',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  terms: {
    fontSize: 10,
    color: '#6060aa',
    margin: '8px 0 0',
    textAlign: 'center',
  },
  error: {
    padding: '8px 12px',
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 6,
    color: '#f87171',
    fontSize: 12,
  },
  fallback: { display: 'flex', flexDirection: 'column', gap: 8 },
  tokenBox: {
    padding: '10px 12px',
    borderRadius: 6,
    border: '1px solid #2a2a3e',
    background: '#0a0a12',
    color: '#a5b4fc',
    fontSize: 11,
    fontFamily: 'ui-monospace, Menlo, monospace',
    wordBreak: 'break-all',
    marginBottom: 8,
  },
};

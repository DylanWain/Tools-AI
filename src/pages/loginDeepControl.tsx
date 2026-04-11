// Tools AI — /loginDeepControl
//
// Cursor-style automatic handoff. Flow:
//
//   1. User arrives from the extension (status bar "Sign in for free trial")
//   2. User enters their email, clicks "Start free trial"
//   3. POST /api/v1/signup → user row + 14-day trial + JWT
//   4. Browser redirects to tools-ai://tools-ai.tools-ai/auth?token=...
//   5. macOS Launch Services routes to Tools AI.app (CFBundleURLTypes
//      registered at install time), the extension's UriHandler stores
//      the token in Keychain, status bar flips to "Chad Trial — 14d".
//
// No copy-paste. No manual steps. The "Open Tools AI" fallback only
// appears if the automatic redirect fails (Safari "allow?" prompt
// dismissed, app not installed, etc.) — and even then it's just a link,
// not a token-copy UX.

import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

type Status = 'idle' | 'working' | 'redirecting' | 'success' | 'error';

export default function LoginDeepControl() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
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
      // Build the deep link. Using the tools-ai:// protocol registered by
      // Tools AI.app's CFBundleURLTypes so the OS routes it exclusively to
      // Tools AI (never stock VS Code).
      const link = `tools-ai://tools-ai.tools-ai/auth?token=${encodeURIComponent(
        data.token,
      )}&email=${encodeURIComponent(email)}`;
      setDeepLink(link);
      setStatus('redirecting');

      // Fire the deep link immediately — the browser hands it off to macOS
      // Launch Services which opens Tools AI. Most browsers show a one-time
      // confirmation prompt the first time; after that it's instant.
      window.location.href = link;

      // After 2.5 seconds assume we're still on the page (user didn't
      // confirm the "open in Tools AI?" prompt, or the browser blocked it)
      // and show a manual "Open Tools AI" button.
      setTimeout(() => {
        setStatus((current) => (current === 'redirecting' ? 'success' : current));
      }, 2500);
    } catch (err: any) {
      setError(err?.message || 'Network error');
      setStatus('error');
    }
  }

  function openTools() {
    if (deepLink) window.location.href = deepLink;
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

          {status === 'success' || status === 'redirecting' ? (
            <>
              <div style={styles.check}>✓</div>
              <h1 style={styles.title}>You&apos;re in</h1>
              <p style={styles.sub}>
                {status === 'redirecting'
                  ? 'Opening Tools AI…'
                  : 'Tools AI should be open now. If nothing happened, click below.'}
              </p>
              <button style={styles.primaryBtn} onClick={openTools}>
                Open Tools AI
              </button>
              <p style={styles.note}>
                Your 14-day Chad trial is active. Close this tab when you&apos;re back
                in the editor.
              </p>
            </>
          ) : (
            <>
              <h1 style={styles.title}>Start your 14-day Chad trial</h1>
              <p style={styles.sub}>No credit card required. Full access to all 5 models.</p>

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
                    disabled={status === 'working'}
                  />
                </label>
                {error ? <div style={styles.error}>{error}</div> : null}
                <button type="submit" style={styles.primaryBtn} disabled={status === 'working'}>
                  {status === 'working' ? 'Creating trial…' : 'Start free trial'}
                </button>
                <p style={styles.terms}>
                  By continuing, you agree to our Terms of Service and Privacy Policy.
                </p>
              </form>
            </>
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
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
    textAlign: 'center',
  },
  logo: {
    fontSize: 13,
    fontWeight: 600,
    color: '#a5b4fc',
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  check: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'rgba(80, 208, 128, 0.15)',
    color: '#50d080',
    fontSize: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    fontWeight: 700,
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
  note: {
    fontSize: 11,
    color: '#6060aa',
    margin: '14px 0 0',
  },
  form: { display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' },
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
    width: '100%',
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
};

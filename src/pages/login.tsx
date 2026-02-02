// ============================================================================
// pages/login.tsx - Login and registration page
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login, register, isLoggedIn, isLoading, error, clearError } = useAuth();
  
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirected, setRedirected] = useState(false);

  // Redirect if already logged in (with a real account, not anonymous)
  useEffect(() => {
    if (!isLoading && isLoggedIn && !redirected) {
      setRedirected(true);
      const redirect = router.query.redirect as string;
      router.replace(redirect ? `/${redirect}` : '/dashboard');
    }
  }, [isLoggedIn, isLoading, router, redirected]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email || !password) {
      setLocalError('Email and password are required');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);

    try {
      if (isRegister) {
        await register(email, password, displayName || undefined);
      } else {
        await login(email, password);
      }
      const redirect = router.query.redirect as string;
      router.push(redirect ? `/${redirect}` : '/dashboard');
    } catch (err) {
      // Error is handled by context
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setLocalError(null);
    clearError();
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <p style={{ color: '#888', fontSize: '16px' }}>Loading...</p>
      </div>
    );
  }

  // If already logged in, show nothing while redirecting
  if (isLoggedIn) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <p style={{ color: '#888', fontSize: '16px' }}>Redirecting...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{isRegister ? 'Create Account' : 'Sign In'} - Tools AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>

      <div className="login-page">
        <nav className="login-nav">
          <a href="/" className="login-logo">Tools AI</a>
        </nav>

        <div className="login-center">
          <div className="login-card">
            <div className="login-header">
              <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
              <p>
                {isRegister
                  ? 'Sign up to sync your AI conversations to the cloud'
                  : 'Sign in to access your synced conversations'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              {isRegister && (
                <div className="login-field">
                  <label htmlFor="displayName">Name</label>
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="login-field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="login-field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                  minLength={8}
                />
              </div>

              {(localError || error) && (
                <div className="login-error">
                  {localError || error}
                </div>
              )}

              <button
                type="submit"
                className="login-submit"
                disabled={submitting}
              >
                {submitting
                  ? 'Please wait...'
                  : isRegister
                  ? 'Create Account'
                  : 'Sign In'}
              </button>
            </form>

            <div className="login-footer-text">
              <p>
                {isRegister ? 'Already have an account?' : "Don't have an account?"}
                <button type="button" onClick={toggleMode} className="login-toggle">
                  {isRegister ? 'Sign In' : 'Create Account'}
                </button>
              </p>
            </div>

            <div className="login-back">
              <a href="/">← Back to Tools AI</a>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          background: #fff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .login-nav {
          padding: 16px 24px;
          border-bottom: 1px solid #f0f0f0;
        }

        .login-logo {
          font-weight: 700;
          font-size: 18px;
          color: #1a1a1a;
          text-decoration: none;
        }

        .login-center {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: calc(100vh - 57px);
          padding: 40px 20px;
        }

        .login-card {
          width: 100%;
          max-width: 400px;
        }

        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-header h1 {
          font-size: 24px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 8px 0;
          letter-spacing: -0.5px;
        }

        .login-header p {
          color: #888;
          font-size: 15px;
          margin: 0;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .login-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .login-field label {
          color: #444;
          font-size: 14px;
          font-weight: 500;
        }

        .login-field input {
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 16px;
          color: #1a1a1a;
          transition: border-color 0.2s;
        }

        .login-field input:focus {
          outline: none;
          border-color: #1a1a1a;
          box-shadow: 0 0 0 3px rgba(0,0,0,0.05);
        }

        .login-field input::placeholder {
          color: #bbb;
        }

        .login-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 12px;
          color: #dc2626;
          font-size: 14px;
        }

        .login-submit {
          background: #1a1a1a;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 14px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          margin-top: 4px;
        }

        .login-submit:hover:not(:disabled) {
          background: #333;
        }

        .login-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .login-footer-text {
          margin-top: 24px;
          text-align: center;
        }

        .login-footer-text p {
          color: #888;
          font-size: 14px;
          margin: 0;
        }

        .login-toggle {
          background: none;
          border: none;
          color: #1a1a1a;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          margin-left: 4px;
        }

        .login-toggle:hover {
          text-decoration: underline;
        }

        .login-back {
          margin-top: 20px;
          text-align: center;
        }

        .login-back a {
          color: #999;
          font-size: 13px;
          text-decoration: none;
        }

        .login-back a:hover {
          color: #1a1a1a;
        }
      `}</style>
    </>
  );
}

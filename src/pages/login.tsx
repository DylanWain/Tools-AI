// ============================================================================
// pages/login.tsx - Login and registration page
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login, register, isAuthenticated, isLoading, error, clearError } = useAuth();
  
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const redirect = router.query.redirect;
      router.push(redirect ? `/${redirect}` : '/');
    }
  }, [isAuthenticated, router]);

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
      router.push('/');
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
      <div className="auth-container">
        <div className="auth-loading">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{isRegister ? 'Create Account' : 'Sign In'} - Persistent AI Chat</title>
      </Head>

      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>{isRegister ? 'Create Account' : 'Welcome Back'}</h1>
            <p>
              {isRegister
                ? 'Sign up to start chatting with AI'
                : 'Sign in to your account'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {isRegister && (
              <div className="auth-field">
                <label htmlFor="displayName">Display Name</label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="John Doe"
                  autoComplete="name"
                />
              </div>
            )}

            <div className="auth-field">
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

            <div className="auth-field">
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
              <div className="auth-error">
                {localError || error}
              </div>
            )}

            <button
              type="submit"
              className="auth-submit"
              disabled={submitting}
            >
              {submitting
                ? 'Please wait...'
                : isRegister
                ? 'Create Account'
                : 'Sign In'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              {isRegister ? 'Already have an account?' : "Don't have an account?"}
              <button
                type="button"
                onClick={toggleMode}
                className="auth-toggle"
              >
                {isRegister ? 'Sign In' : 'Create Account'}
              </button>
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .auth-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--bg-primary);
          padding: 20px;
        }

        .auth-loading {
          color: var(--text-secondary);
          font-size: 18px;
        }

        .auth-card {
          background-color: var(--bg-secondary);
          border-radius: var(--radius-lg);
          padding: 40px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
        }

        .auth-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .auth-header h1 {
          color: var(--text-primary);
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 8px 0;
        }

        .auth-header p {
          color: var(--text-secondary);
          font-size: 14px;
          margin: 0;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .auth-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .auth-field label {
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 500;
        }

        .auth-field input {
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 12px 16px;
          font-size: 16px;
          color: var(--text-primary);
          transition: border-color 0.2s;
        }

        .auth-field input:focus {
          outline: none;
          border-color: var(--accent-primary);
        }

        .auth-field input::placeholder {
          color: var(--text-muted);
        }

        .auth-error {
          background-color: rgba(239, 68, 68, 0.1);
          border: 1px solid var(--accent-danger);
          border-radius: var(--radius-md);
          padding: 12px;
          color: var(--accent-danger);
          font-size: 14px;
        }

        .auth-submit {
          background-color: var(--accent-primary);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          padding: 14px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .auth-submit:hover:not(:disabled) {
          background-color: var(--accent-primary-hover);
        }

        .auth-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .auth-footer {
          margin-top: 24px;
          text-align: center;
        }

        .auth-footer p {
          color: var(--text-secondary);
          font-size: 14px;
          margin: 0;
        }

        .auth-toggle {
          background: none;
          border: none;
          color: var(--accent-primary);
          font-size: 14px;
          cursor: pointer;
          margin-left: 4px;
        }

        .auth-toggle:hover {
          text-decoration: underline;
        }
      `}</style>
    </>
  );
}

// ============================================================================
// pages/_app.tsx - App wrapper
// ============================================================================

import type { AppProps } from 'next/app';
import '../styles/globals.css';
import { ErrorBoundary } from '../components';
import { AuthProvider } from '../contexts/AuthContext';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </ErrorBoundary>
  );
}

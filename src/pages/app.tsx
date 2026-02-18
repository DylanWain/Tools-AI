// ============================================================================
// pages/app.tsx - Main Chat Application (authenticated)
// ============================================================================

import type { NextPage } from 'next';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useEffect } from 'react';

const ChatPage = dynamic(() => import('../components/ChatPage'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#212121',
      color: '#ececec',
    }}>
      Loading...
    </div>
  ),
});

const App: NextPage = () => {
  // Lock body scroll only on this page
  useEffect(() => {
    document.body.classList.add('chat-app-active');
    return () => {
      document.body.classList.remove('chat-app-active');
    };
  }, []);

  return (
    <>
      <Head>
        <title>Tools AI - Free AI Chat</title>
        <meta name="description" content="Tools AI - Free unlimited AI chat with memory across all conversations." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="canonical" href="https://www.thetoolswebsite.com" />
      </Head>
      <ChatPage />
    </>
  );
};

export default App;

// ============================================================================
// Homepage - Chat Interface (replaces landing page)
// SEO pages still at /blog/*, dashboard at /dashboard
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
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      Loading Tools AI...
    </div>
  ),
});

const Home: NextPage = () => {
  useEffect(() => {
    document.body.classList.add('chat-app-active');
    return () => document.body.classList.remove('chat-app-active');
  }, []);

  return (
    <>
      <Head>
        <title>Tools AI - Free Unlimited AI Chat with Memory</title>
        <meta name="description" content="Free unlimited AI chat powered by Llama 3.1. No limits, conversations saved forever. Switch between GPT-4, Claude, Gemini with your own API keys." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta property="og:title" content="Tools AI - Free Unlimited AI Chat" />
        <meta property="og:description" content="Free unlimited AI chat with permanent memory. No signup required." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://thetoolswebsite.com" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="canonical" href="https://thetoolswebsite.com" />
      </Head>
      <ChatPage />
    </>
  );
};

export default Home;

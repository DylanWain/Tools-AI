// ============================================================================
// pages/app.tsx - Main Chat Application (authenticated)
// ============================================================================

import type { NextPage } from 'next';
import dynamic from 'next/dynamic';
import Head from 'next/head';

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
  return (
    <>
      <Head>
        <title>Tools AI - Chat</title>
        <meta name="description" content="Tools AI - AI Chat with Permanent Memory" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <ChatPage />
    </>
  );
};

export default App;

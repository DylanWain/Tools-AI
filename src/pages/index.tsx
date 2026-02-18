import type { NextPage } from 'next';
import dynamic from 'next/dynamic';
import Head from 'next/head';

const ChatPage = dynamic(() => import('../components/ChatPage'), {
  ssr: false,
});

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>Tools AI - Free Unlimited AI Chat</title>
        <meta name="description" content="Free unlimited AI chat powered by Llama 3.3 70B. No signup required. Chat with AI instantly, save every conversation, and sync across ChatGPT, Claude, and Gemini." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="canonical" href="https://www.thetoolswebsite.com" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Tools AI - Free Unlimited AI Chat" />
        <meta property="og:description" content="Free unlimited AI chat powered by Llama 3.3 70B. No signup required." />
        <meta property="og:url" content="https://www.thetoolswebsite.com" />
        <meta property="og:site_name" content="Tools AI" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Tools AI - Free Unlimited AI Chat" />
      </Head>
      <ChatPage />
    </>
  );
};

export default Home;

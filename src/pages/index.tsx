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
        <meta name="description" content="Free unlimited AI chat powered by Llama 3.3 70B. Just start chatting - no account needed." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <ChatPage />
    </>
  );
};

export default Home;

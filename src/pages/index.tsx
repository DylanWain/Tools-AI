import type { NextPage } from 'next';
import dynamic from 'next/dynamic';
import Head from 'next/head';

const ToolsAILanding = dynamic(() => import('../components/ToolsAILanding'), {
  ssr: false,
});

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>Tools AI - Universal Memory Layer for ChatGPT, Claude, and Gemini</title>
        <meta name="description" content="Tools AI captures every AI conversation across ChatGPT, Claude, and Gemini. One Chrome extension. Every conversation stored, searchable, and permanent." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="Tools AI - One Memory Layer for Every AI Conversation" />
        <meta property="og:description" content="Stop losing context across ChatGPT, Claude, and Gemini. Free Chrome extension that captures and organizes everything." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://thetoolswebsite.com" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Tools AI - Universal AI Memory Layer" />
        <meta name="twitter:description" content="Free Chrome extension that captures every AI conversation across ChatGPT, Claude, and Gemini." />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="canonical" href="https://thetoolswebsite.com" />
      </Head>
      <ToolsAILanding />
    </>
  );
};

export default Home;

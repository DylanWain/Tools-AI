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
        <title>Tools AI — Every AI Platform. One App.</title>
        <meta name="description" content="ChatGPT, Claude, Gemini, Grok, Perplexity — all in one powerful desktop app. Your conversations stay private on your device." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="canonical" href="https://www.thetoolswebsite.com" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Tools AI — Every AI Platform. One App." />
        <meta property="og:description" content="ChatGPT, Claude, Gemini, Grok, Perplexity — unified in one desktop app. Private by default." />
        <meta property="og:url" content="https://www.thetoolswebsite.com" />
        <meta property="og:site_name" content="Tools AI" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Tools AI — Every AI Platform. One App." />
      </Head>
      <ToolsAILanding />
    </>
  );
};

export default Home;

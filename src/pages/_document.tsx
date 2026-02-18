// ============================================================================
// pages/_document.tsx - Custom Document with Google Analytics + LogRocket
// ============================================================================

import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-DSWKZ32CJ6"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-DSWKZ32CJ6');
            `,
          }}
        />
        
        {/* LogRocket Session Recording */}
        <script src="https://cdn.logr-in.com/LogRocket.min.js" crossOrigin="anonymous"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.LogRocket && window.LogRocket.init('umgzq9/tools-ai');
            `,
          }}
        />
        
        {/* Favicon */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        
        {/* Meta tags */}
        <meta name="description" content="Tools AI - Free unlimited AI chat with memory. Sync conversations across ChatGPT, Claude, and Gemini." />
        <meta name="theme-color" content="#212121" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

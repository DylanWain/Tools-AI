/**
 * GET / — the multi-LLM compare chat (the main product).
 *
 * Thin server-component shell. Reads which providers have keys
 * configured (so the client picker can honestly grey out the
 * unavailable ones), then hands off to <CompareChat /> which owns
 * layout, sidebar, sessions, and all interactivity.
 *
 * History: this used to be the Veronum marketing landing page (Hero,
 * Pricing, FAQ, demos, etc.). The marketing components still live in
 * components/ for future revival — they're no longer routed to. To put
 * the marketing back, re-import them in a new page (e.g.
 * app/about/page.tsx) and copy this file's previous structure from
 * git history.
 *
 * Auth: anonymous visitors see the magic-link sign-in gate. Once
 * signed in, every account gets $5 of free use across every model;
 * after that the paywall (Subscribe $25/mo or PAYG 3×) takes over.
 * Both flows live inside <CompareChat />.
 */

import type { Metadata } from "next";
import { CompareChat } from "@/components/chat/CompareChat";
import { providerAvailable, type ProviderId } from "@/lib/compare/models";

export const metadata: Metadata = {
  title: "The Tools Website — one prompt, every model",
  description:
    "Compare GPT, Claude, Perplexity, Gemini, and Grok side-by-side. Pick the best answer, multi-turn from any model. $5 free, then $25/mo or pay-as-you-go.",
};

// CompareChat reads auth state from the browser's persisted Supabase
// session at runtime; the page must not be cached at the route level.
export const dynamic = "force-dynamic";

const ALL_PROVIDERS: ProviderId[] = ["openai", "anthropic", "perplexity", "gemini", "xai", "deepseek"];

export default function Home() {
  // Providers with a key set ON THIS SERVER. May be empty in two
  // legitimate cases: (a) the desktop app forwards /api/* to the live
  // deploy where the real keys live, so local keys are irrelevant;
  // (b) a dev server that just hasn't loaded env yet.
  const localProviders = ALL_PROVIDERS.filter(providerAvailable);

  // NEVER hard-block the whole page on local key presence. The
  // "No model providers configured" full-screen gate used to take
  // over whenever a server couldn't see keys — which kept happening
  // across the desktop/dev launch permutations and was infuriating.
  // We always render the chat. If no provider is locally available we
  // fall back to advertising all of them: in the desktop app the
  // /api/* rewrite forwards to the live deploy (real keys), and if a
  // model genuinely has no key anywhere the failure is a clear
  // per-send error, not a screen takeover.
  const providers = localProviders.length > 0 ? localProviders : ALL_PROVIDERS;

  return (
    <>
      <CompareChat availableProviders={providers} />
      <CaretKeyframes />
    </>
  );
}

function NoProvidersConfigured() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-[60ch] text-center">
        <h1 className="font-serif text-[28px] text-white mb-3">No model providers configured</h1>
        <p className="text-white/60 text-[15px] leading-[1.6] mb-6">
          Set at least one of these on the server to enable the compare chat:
        </p>
        <ul className="font-mono text-[13px] text-white/75 inline-block text-left space-y-1.5">
          <li><code>OPENAI_API_KEY</code> — GPT-4o, o1, etc.</li>
          <li><code>ANTHROPIC_API_KEY</code> — Claude Sonnet, Haiku</li>
          <li><code>PERPLEXITY_API_KEY</code> — Sonar (web-grounded)</li>
          <li><code>GEMINI_API_KEY</code> — Gemini 1.5 Pro/Flash</li>
          <li><code>XAI_API_KEY</code> — Grok</li>
        </ul>
        <p className="text-white/40 text-[12px] mt-8">
          On Vercel: <code className="font-mono">vercel env add OPENAI_API_KEY</code>, then redeploy.
        </p>
      </div>
    </div>
  );
}

function CaretKeyframes() {
  // The streaming-token blinking caret in ResponseBox uses this keyframe.
  return (
    <style>{`
      @keyframes caret-blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }
    `}</style>
  );
}

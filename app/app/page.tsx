/**
 * GET /app — the multi-LLM compare chat (the product).
 *
 * Moved here from `/` so the homepage can be the marketing landing. The
 * desktop app loads THIS route. Thin server-component shell: reads which
 * providers have keys configured, then hands off to <CompareChat />.
 *
 * Auth: anonymous visitors see the magic-link sign-in gate. Once signed
 * in, every account gets $5 of free use across every model; after that
 * the paywall (Subscribe $25/mo or PAYG 3×) takes over.
 */

import type { Metadata } from "next";
import { CompareChat } from "@/components/chat/CompareChat";
import { providerAvailable, type ProviderId } from "@/lib/compare/models";

export const metadata: Metadata = {
  title: "Veronum — one prompt, every model",
  description:
    "Compare GPT, Claude, Perplexity, Gemini, and Grok side-by-side. Pick the best answer, multi-turn from any model. $5 free, then $25/mo or pay-as-you-go.",
};

// CompareChat reads auth state from the browser's persisted Supabase
// session at runtime; the page must not be cached at the route level.
export const dynamic = "force-dynamic";

const ALL_PROVIDERS: ProviderId[] = ["openai", "anthropic", "perplexity", "gemini", "xai", "deepseek"];

export default function AppPage() {
  const localProviders = ALL_PROVIDERS.filter(providerAvailable);
  // Never hard-block on local key presence — the desktop app forwards
  // /api/* to the live deploy where the real keys live.
  const providers = localProviders.length > 0 ? localProviders : ALL_PROVIDERS;

  return (
    <>
      <CompareChat availableProviders={providers} />
      <CaretKeyframes />
    </>
  );
}

function CaretKeyframes() {
  return (
    <style>{`
      @keyframes caret-blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }
    `}</style>
  );
}

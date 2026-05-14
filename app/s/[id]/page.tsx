/**
 * GET /s/[id] — public share recipient page.
 *
 * This is THE viral surface for the extension. When a user clicks "Share
 * this chat live" in the extension, the share URL points here. Someone
 * who never installed anything clicks the link, lands on this page, sees
 * the conversation rendered cleanly, and is funneled toward installing
 * Veronum. Loom hit 25M users via this exact loop (2 of 5 recipients of
 * a shared video signed up); this is the same mechanic for AI chats.
 *
 * Server component — fetches the share from Supabase, server-renders
 * the conversation, sets correct OpenGraph + Twitter card metadata so
 * the link previews nicely in Slack / Discord / DMs / tweets.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { serverSupabase } from "@/lib/supabase";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

type Turn = { role: "user" | "assistant"; text: string };
type ShareRow = {
  id: string;
  source: string;
  title: string | null;
  turns: Turn[];
  source_url: string | null;
  captured_at: number | null;
  stored_at: number | null;
  view_count: number | null;
};

const SOURCE_LABEL: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  grok: "Grok",
  perplexity: "Perplexity",
};

const DOWNLOAD_URL =
  "https://github.com/DylanWain/veronum-overlay/releases/latest/download/Veronum-1.2.7-universal.dmg";

async function loadShare(id: string): Promise<ShareRow | null> {
  if (!/^[A-Za-z0-9]{6,32}$/.test(id)) return null;
  const supabase = serverSupabase();
  const { data, error } = await supabase
    .from("extension_shared_conversations")
    .select(
      "id, source, title, turns, source_url, captured_at, stored_at, view_count, is_private",
    )
    .eq("id", id)
    .eq("is_private", false)
    .maybeSingle();
  if (error) {
    console.warn("[/s/[id]] supabase error:", error.message);
    return null;
  }
  if (!data) return null;
  return data as ShareRow;
}

/** Bump view_count via the security-definer RPC. Fire-and-forget —
 *  we never wait for it, and a failure here doesn't fail the page. */
async function bumpViewCountAsync(id: string) {
  try {
    const supabase = serverSupabase();
    await supabase.rpc("bump_share_view_count", { p_id: id });
  } catch {
    /* non-fatal */
  }
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await props.params;
  const share = await loadShare(id);
  if (!share) {
    return {
      title: "Shared chat not found — Veronum",
    };
  }
  const sourceLabel = SOURCE_LABEL[share.source] || share.source;
  const title = share.title
    ? `${share.title} — via Veronum`
    : `Shared ${sourceLabel} chat — via Veronum`;
  const description = share.turns?.[0]?.text
    ? share.turns[0].text.slice(0, 180)
    : `A ${sourceLabel} conversation shared via Veronum.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `https://www.thetoolswebsite.com/s/${id}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function SharedConversationPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const share = await loadShare(id);
  if (!share) notFound();
  void bumpViewCountAsync(id);

  const sourceLabel = SOURCE_LABEL[share.source] || share.source;
  const turns = Array.isArray(share.turns) ? share.turns : [];

  return (
    <>
      <Nav />
      <main className="u-container pt-10 sm:pt-14 lg:pt-20 pb-16 lg:pb-24">
        {/* Header — message-match the brand, but lead with the share itself */}
        <header className="max-w-[68ch] mx-auto mb-10">
          <div
            className="font-mono uppercase tracking-[0.08em] text-[var(--detail-xs)] text-ink-faded mb-3"
          >
            Shared from {sourceLabel} · via Veronum
          </div>
          <h1
            className="font-serif font-medium text-ink leading-[1.05]"
            style={{ fontSize: "var(--display-l)" }}
          >
            {share.title || "Untitled chat"}
          </h1>
          {share.stored_at && (
            <p className="font-mono text-[var(--detail-xs)] text-ink-faded mt-3">
              {humanAgo(share.stored_at)} · {turns.length} turn
              {turns.length === 1 ? "" : "s"}
            </p>
          )}
        </header>

        {/* Conversation */}
        <article className="max-w-[68ch] mx-auto">
          {turns.map((turn, i) => (
            <TurnBubble key={i} turn={turn} />
          ))}
        </article>

        {/* Funnel card — the conversion moment */}
        <FunnelCard />
      </main>
      <Footer />
    </>
  );
}

function TurnBubble({ turn }: { turn: Turn }) {
  const isUser = turn.role === "user";
  return (
    <div className="mb-7">
      <div
        className="font-mono uppercase tracking-[0.08em] text-[var(--detail-xs)] text-ink-faded mb-2"
      >
        {isUser ? "You" : "Assistant"}
      </div>
      <div
        className={
          isUser
            ? "text-ink leading-[1.55] whitespace-pre-wrap"
            : "text-ink leading-[1.55] whitespace-pre-wrap"
        }
        style={{ fontSize: "var(--paragraph-m)" }}
      >
        {turn.text}
      </div>
    </div>
  );
}

function FunnelCard() {
  return (
    <aside className="max-w-[68ch] mx-auto mt-16">
      <div className="border border-ink/10 rounded-2xl bg-ivory-light p-7 sm:p-9">
        <div
          className="font-mono uppercase tracking-[0.08em] text-[var(--detail-xs)] text-ink-faded mb-3"
        >
          This chat was shared via Veronum
        </div>
        <h2
          className="font-serif font-medium text-ink leading-[1.1] mb-5"
          style={{ fontSize: "var(--display-m)" }}
        >
          Code with AI on every platform.
        </h2>
        <p
          className="text-ink leading-[1.55] max-w-[48ch] mb-7"
          style={{ fontSize: "var(--paragraph-s)" }}
        >
          Veronum runs 10 agents in parallel across ChatGPT, Claude,
          Cursor, VS Code, Warp, and Zed. Share live coding sessions,
          undo any edit, and keep version history for every turn.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <a
            href={DOWNLOAD_URL}
            className="inline-flex items-center justify-center bg-slate-dark text-ivory px-5 py-[10px] rounded-full text-[15px] font-medium hover:bg-slate-medium transition"
          >
            Download for Mac — Free
          </a>
          <Link
            href="/welcome?source=share"
            className="inline-flex items-center justify-center border border-ink/20 text-ink px-5 py-[10px] rounded-full text-[15px] font-medium hover:bg-ink/[0.04] transition"
          >
            See how it works
          </Link>
        </div>
      </div>
    </aside>
  );
}

function humanAgo(epochMs: number): string {
  const seconds = Math.max(1, Math.floor((Date.now() - epochMs) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/**
 * /chat — the device-agnostic Veronum chat surface.
 *
 * Flow:
 *   1. Auth-gate via Supabase magic-link (same as /pair-bridge).
 *   2. Read the signed-in user's veronum_bridges row(s) — RLS already
 *      restricts to "your own".
 *   3. Subscribe to the chosen bridge's Realtime broadcast channel
 *      `bridge:<install_id>`.
 *   4. Browser sends `dispatch.request` with prompt + cwd + sessionId;
 *      the daemon (lib/bridgeSupabase.js → handleChannelDispatch in
 *      server.js) proxies through its localhost /api/claude/send and
 *      forwards each SSE event back as `dispatch.<event>` broadcasts.
 *   5. We render the deltas live, then mark the message done.
 *
 * Intentionally minimal for the first end-to-end test:
 *   - One bridge per account (uses the first paired row).
 *   - cwd + sessionId pasted into inputs (in v0.3 we add a session
 *     picker driven by a `sessions.list-request` channel message).
 *   - No voice yet (Companion / push-to-talk live in the localhost
 *     prototype; we'll wire them through the channel in v0.3 too).
 *
 * Reuses the same Newsreader-serif / ivory-bg styling as the rest of
 * the marketing site so it doesn't feel grafted-on.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase";

interface Bridge {
  id: string;
  install_id: string;
  hostname: string | null;
  app_version: string | null;
  last_seen_at: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming: boolean;
}

const SECONDS_FOR_ONLINE = 90; // bridges that heart-beat within 90 s are "online"

export default function ChatPage() {
  const supabase = useMemo(() => getBrowserSupabase(), []);

  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [bridges, setBridges] = useState<Bridge[] | null>(null);
  const [activeBridge, setActiveBridge] = useState<Bridge | null>(null);

  const [cwd, setCwd] = useState("");
  const [sessionId, setSessionId] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const dispatchIdRef = useRef<string | null>(null);

  // ─── 1. Auth check ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSignedInEmail(data.session?.user?.email ?? null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") setSignedInEmail(session?.user?.email ?? null);
      if (event === "SIGNED_OUT") setSignedInEmail(null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // ─── 2. Load bridges once signed in ─────────────────────────────────────
  useEffect(() => {
    if (!signedInEmail) {
      setBridges(null);
      setActiveBridge(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("veronum_bridges")
        .select("id, install_id, hostname, app_version, last_seen_at")
        .not("user_id", "is", null)
        .order("last_seen_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        setAuthError(error.message);
        return;
      }
      setBridges(data as Bridge[]);
      if (data && data.length > 0) setActiveBridge(data[0] as Bridge);
    })();
    return () => {
      cancelled = true;
    };
  }, [signedInEmail, supabase]);

  // ─── 3. Subscribe to the bridge's Realtime channel ──────────────────────
  useEffect(() => {
    if (!activeBridge) return;
    const channelName = `bridge:${activeBridge.install_id}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false, ack: false } },
    });

    // Wire every dispatch.* event to the streaming render path.
    const onEvent = (event: string) => ({ payload }: { payload: any }) => {
      const reqId = payload?.request_id;
      if (!reqId || reqId !== dispatchIdRef.current) return; // ignore other in-flight
      setMessages((prev) => {
        // Find the streaming assistant bubble that matches; if missing, create.
        let idx = prev.findIndex((m) => m.id === reqId && m.role === "assistant");
        const next = [...prev];
        if (idx < 0) {
          next.push({ id: reqId, role: "assistant", text: "", streaming: true });
          idx = next.length - 1;
        }
        const m = next[idx];
        if (event === "dispatch.delta") {
          if (typeof payload.accumulated === "string") m.text = payload.accumulated;
          else if (typeof payload.text === "string") m.text += payload.text;
        } else if (event === "dispatch.done") {
          if (payload.accumulated) m.text = payload.accumulated;
          m.streaming = false;
        } else if (event === "dispatch.error") {
          m.text = (m.text ? m.text + "\n\n" : "") + "⚠ " + (payload.message || "error");
          m.streaming = false;
        }
        return next;
      });
      if (event === "dispatch.done" || event === "dispatch.error") {
        setSending(false);
        dispatchIdRef.current = null;
      }
    };
    channel
      .on("broadcast", { event: "dispatch.status" }, onEvent("dispatch.status"))
      .on("broadcast", { event: "dispatch.delta" }, onEvent("dispatch.delta"))
      .on("broadcast", { event: "dispatch.tool_use" }, onEvent("dispatch.tool_use"))
      .on("broadcast", { event: "dispatch.result" }, onEvent("dispatch.result"))
      .on("broadcast", { event: "dispatch.done" }, onEvent("dispatch.done"))
      .on("broadcast", { event: "dispatch.error" }, onEvent("dispatch.error"))
      .subscribe();
    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [activeBridge, supabase]);

  // ─── 4. Send a prompt via the channel ──────────────────────────────────
  const send = async () => {
    if (!prompt.trim() || !activeBridge || !channelRef.current || sending) return;
    if (!cwd || !sessionId) {
      setAuthError("Enter the cwd + session id of an existing Claude session.");
      return;
    }
    setAuthError(null);
    const reqId = crypto.randomUUID();
    dispatchIdRef.current = reqId;
    const userText = prompt.trim();
    setMessages((prev) => [
      ...prev,
      { id: reqId + ":user", role: "user", text: userText, streaming: false },
    ]);
    setPrompt("");
    setSending(true);
    await channelRef.current.send({
      type: "broadcast",
      event: "dispatch.request",
      payload: {
        request_id: reqId,
        editor: "claude",
        cwd,
        sessionId,
        prompt: userText,
        model: "haiku",
        effort: "low",
      },
    });
  };

  // ─── Magic link sign-in ────────────────────────────────────────────────
  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = emailInput.trim();
    if (!/.+@.+\..+/.test(trimmed)) {
      setAuthError("Enter a valid email address.");
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: `${window.location.origin}/chat` },
    });
    if (error) setAuthError(error.message);
    else setMagicLinkSent(true);
  };

  // ─── Render ────────────────────────────────────────────────────────────
  if (!signedInEmail) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-ivory px-6 py-16">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <Link href="/" className="font-serif text-[24px] font-medium tracking-tight text-ink">Veronum</Link>
            <div className="mt-2 font-mono uppercase tracking-[0.08em] text-[11px] text-ink-faded">Chat</div>
          </div>
          <div className="rounded-2xl border border-ink/10 bg-white shadow-sm p-6 sm:p-8">
            {magicLinkSent ? (
              <p className="text-[14px] text-ink-faded">
                Sign-in link sent to <span className="font-mono text-ink">{emailInput}</span>. Click it to come back here.
              </p>
            ) : (
              <>
                <h1 className="font-serif text-[22px] font-medium text-ink mb-2">Sign in to chat</h1>
                <p className="text-[14px] text-ink-faded mb-6">
                  We&rsquo;ll email you a one-time link. Need to install the Bridge first?{" "}
                  <Link href="/pair-bridge" className="underline">Pair this Mac</Link>.
                </p>
                <form onSubmit={sendMagicLink} className="space-y-3">
                  <input
                    type="email" required autoFocus placeholder="you@example.com"
                    value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full rounded-full border border-ink/15 px-4 py-2.5 text-[15px] focus:outline-none focus:border-slate-dark"
                  />
                  <button type="submit" className="w-full bg-slate-dark text-ivory rounded-full px-4 py-2.5 text-[15px] font-medium hover:bg-slate-medium transition">
                    Send sign-in link
                  </button>
                  {authError && <p className="text-[12px] text-red-700 mt-2">{authError}</p>}
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ivory px-4 py-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-baseline justify-between mb-4">
          <Link href="/" className="font-serif text-[22px] font-medium tracking-tight text-ink">Veronum</Link>
          <span className="font-mono text-[11px] text-ink-faded">{signedInEmail}</span>
        </div>

        {/* Bridge selector */}
        {bridges === null ? (
          <div className="rounded-xl bg-white border border-ink/10 p-4 text-[13px] text-ink-faded">Loading bridges…</div>
        ) : bridges.length === 0 ? (
          <div className="rounded-xl bg-white border border-ink/10 p-4 text-[13px] text-ink-faded">
            No bridge paired yet.{" "}
            <a href="https://github.com/DylanWain/veronum-bridge/releases/latest/download/Veronum-Bridge.dmg" className="underline">
              Download Veronum Bridge
            </a>{" "}
            for your Mac, then{" "}
            <Link href="/pair-bridge" className="underline">pair it</Link>.
          </div>
        ) : (
          <div className="rounded-xl bg-white border border-ink/10 p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-block w-2 h-2 rounded-full ${(Date.now() - new Date(activeBridge?.last_seen_at || 0).getTime()) / 1000 < SECONDS_FOR_ONLINE ? "bg-green-500" : "bg-zinc-400"}`} />
              <span className="font-mono text-[13px] text-ink">
                {activeBridge?.hostname || activeBridge?.install_id.slice(0, 8)}
              </span>
              <span className="font-mono text-[11px] text-ink-faded">
                {activeBridge?.app_version ? `v${activeBridge.app_version}` : ""}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              <input
                placeholder="cwd  e.g. /Users/dylanwain/Katya App Test"
                value={cwd} onChange={(e) => setCwd(e.target.value)}
                className="rounded-md border border-ink/15 px-3 py-1.5 font-mono text-[12px] focus:outline-none focus:border-slate-dark"
              />
              <input
                placeholder="session id  e.g. cb524761-…"
                value={sessionId} onChange={(e) => setSessionId(e.target.value)}
                className="rounded-md border border-ink/15 px-3 py-1.5 font-mono text-[12px] focus:outline-none focus:border-slate-dark"
              />
            </div>
            {authError && <p className="text-[12px] text-red-700 mt-2">{authError}</p>}
          </div>
        )}

        {/* Messages */}
        <div className="space-y-3 mb-4 min-h-[40vh]">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl border p-3 text-[14px] leading-[1.55] ${m.role === "user" ? "bg-slate-dark/5 border-slate-dark/15 ml-auto max-w-[85%]" : "bg-white border-ink/10 mr-auto max-w-[85%]"}`}
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 text-ink-faded">{m.role}</div>
              <div className="whitespace-pre-wrap">
                {m.text}
                {m.streaming && <span className="opacity-50">▋</span>}
              </div>
            </div>
          ))}
          {messages.length === 0 && bridges && bridges.length > 0 && (
            <p className="text-[13px] text-ink-faded text-center pt-8">
              Type a prompt below. It&rsquo;ll route through Supabase Realtime to your Mac and stream the reply back.
            </p>
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="sticky bottom-4 bg-white rounded-2xl border border-ink/10 shadow-sm p-3 flex gap-2 items-end"
        >
          <textarea
            placeholder="Ask Claude…"
            value={prompt} onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            rows={2}
            className="flex-1 resize-none rounded-md px-3 py-2 text-[15px] focus:outline-none"
            disabled={!activeBridge || sending}
          />
          <button
            type="submit"
            disabled={!activeBridge || sending || !prompt.trim()}
            className="bg-slate-dark text-ivory rounded-full px-5 py-2 text-[14px] font-medium disabled:opacity-40 hover:bg-slate-medium transition"
          >
            {sending ? "…" : "Send"}
          </button>
        </form>
      </div>
    </main>
  );
}

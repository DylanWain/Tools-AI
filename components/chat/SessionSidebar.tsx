"use client";

/**
 * Left sidebar — Grok-styled. Pure-black surface that bleeds into the
 * main pane (no dividing border), with subtle rounded-pill highlights
 * for the active session.
 *
 * Layout:
 *   ┌──────────────────────────┐
 *   │ [V mark]            [«]  │  collapse toggle
 *   ├──────────────────────────┤
 *   │ [edit-pencil] New chat   │
 *   ├──────────────────────────┤
 *   │ history ⌄                │
 *   │   today                  │
 *   │   • session a            │
 *   │   • session b            │
 *   │   earlier                │
 *   │   • session c            │
 *   └──────────────────────────┘
 *
 * Hidden on screens smaller than lg so the chat surface stays usable
 * on phones.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { CompareSession } from "@/lib/compare/sessions";
import { VeronumMark } from "@/components/VeronumMark";
import { getBrowserSupabase } from "@/lib/supabase";

// Same Stripe Payment Link the /compare paywall + /chat page use —
// one source of truth for the subscribe URL.
const STRIPE_CHECKOUT_BASE = "https://buy.stripe.com/fZu28tb3x9aufwJeLt1sQ00";

type Props = {
  sessions: CompareSession[];
  currentId: string | null;
  onNewChat: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  /** Opens the sign-in modal. Pulled up from CompareChat so the sidebar
   *  doesn't need to own a second magic-link form — same flow as the
   *  one that pops on Send 401. */
  onRequestSignIn?: () => void;
};

export function SessionSidebar({
  sessions, currentId, onNewChat, onLoad, onDelete, onRequestSignIn,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const buckets = useMemo(() => bucketByRecency(sessions), [sessions]);

  // Auth state for the bottom-left footer. Watches Supabase session
  // changes so signing in from anywhere (Send→modal, magic link return)
  // immediately updates the avatar / email / menu items.
  const [account, setAccount] = useState<{ email: string; id: string } | null>(null);
  useEffect(() => {
    const supabase = getBrowserSupabase();
    const apply = (session: { user?: { email?: string | null; id?: string } } | null) => {
      const email = session?.user?.email;
      const id = session?.user?.id;
      setAccount(email && id ? { email, id } : null);
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => apply(session));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (collapsed) {
    return (
      <aside className="hidden lg:flex w-[56px] shrink-0 flex-col bg-black items-center pt-3 gap-3">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="w-9 h-9 inline-flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] rounded-lg transition"
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <ChevronRight />
        </button>
        <button
          type="button"
          onClick={onNewChat}
          className="w-9 h-9 inline-flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.06] rounded-lg transition"
          aria-label="New chat"
          title="New chat"
        >
          <EditIcon />
        </button>
      </aside>
    );
  }

  return (
    <aside className="hidden lg:flex w-[260px] shrink-0 flex-col bg-black">
      {/* Brand row + collapse */}
      <div className="h-14 px-3 flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-2 text-white/95 hover:text-white">
          <VeronumMark className="h-7 w-7 rounded-md" />
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="w-7 h-7 inline-flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] rounded-md transition"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <ChevronLeftDouble />
        </button>
      </div>

      {/* New chat — full-width row */}
      <div className="px-2">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full inline-flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.06] text-white/90 hover:text-white text-[14px] font-medium transition-colors"
        >
          <EditIcon />
          New chat
        </button>
      </div>

      {/* History section */}
      <div className="flex-1 overflow-y-auto px-2 mt-3">
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          className="w-full flex items-center gap-1 px-3 py-1.5 text-white/70 hover:text-white text-[13px] font-medium transition-colors"
        >
          <span>History</span>
          <Caret open={historyOpen} />
        </button>

        {historyOpen && (
          <div className="mt-1">
            {sessions.length === 0 ? (
              <p className="text-[12px] text-white/30 px-3 py-2 leading-[1.5]">
                Nothing yet. Send a prompt to create your first session.
              </p>
            ) : (
              <>
                {buckets.map(({ label, items }) =>
                  items.length === 0 ? null : (
                    <section key={label} className="mt-2">
                      <div className="text-[11px] text-white/35 px-3 mb-1 lowercase">
                        {label}
                      </div>
                      <ul className="space-y-0.5">
                        {items.map((s) => (
                          <SessionRow
                            key={s.id}
                            session={s}
                            active={s.id === currentId}
                            onLoad={() => onLoad(s.id)}
                            onDelete={() => onDelete(s.id)}
                          />
                        ))}
                      </ul>
                    </section>
                  ),
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom-left account / settings menu — Veronum-style.
          When signed out: prompt to sign in. When signed in: avatar
          initial + truncated email + popover menu (Subscribe / Sign out). */}
      <AccountFooter account={account} onRequestSignIn={onRequestSignIn} />
    </aside>
  );
}

/** Bottom-of-sidebar account row + popover menu. Matches the
 *  bottom-left avatar pattern from the Veronum desktop app and from
 *  Claude/Cursor's sidebars — Settings + Sign out live here, NOT in
 *  the top nav. (See user memory: 'Veronum: Settings lives in
 *  bottom-left avatar menu — Match Claude/Cursor'.) */
function AccountFooter({
  account, onRequestSignIn,
}: {
  account: { email: string; id: string } | null;
  onRequestSignIn?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Click-away to close the popover. Listening on mousedown rather
  // than click so dragging selections inside the menu doesn't close it.
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (wrapRef.current.contains(e.target as Node)) return;
      setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function signOut() {
    setMenuOpen(false);
    try {
      const { error } = await getBrowserSupabase().auth.signOut();
      if (error) console.warn("[sidebar] signOut error:", error.message);
    } catch (e) {
      console.warn("[sidebar] signOut threw:", (e as Error).message);
    }
  }

  // Signed-out: small row that opens the sign-in modal (same modal
  // used by Send→401). We never inline a second magic-link form here
  // — one source of truth, less code to keep in sync.
  if (!account) {
    return (
      <div className="px-2 pb-3 shrink-0">
        <button
          type="button"
          onClick={onRequestSignIn}
          className="w-full inline-flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.06] text-white/85 hover:text-white text-[13.5px] transition-colors"
        >
          <span
            aria-hidden
            className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-white/[0.08] text-white/55 text-[12px]"
          >
            ?
          </span>
          <span className="truncate">Sign in</span>
        </button>
      </div>
    );
  }

  const initial = account.email.charAt(0).toUpperCase();
  const subscribeHref = `${STRIPE_CHECKOUT_BASE}?client_reference_id=${encodeURIComponent(account.id)}`;
  return (
    <div ref={wrapRef} className="relative px-2 pb-3 shrink-0">
      {menuOpen && (
        <div
          role="menu"
          aria-label="Account menu"
          className="absolute left-2 right-2 bottom-[calc(100%-8px)] mb-1 rounded-xl border border-white/10 bg-[#161616] shadow-[0_-12px_40px_rgba(0,0,0,0.45)] p-1.5 z-50"
        >
          <div className="px-3 py-2 border-b border-white/[0.06] mb-1">
            <div className="text-[11px] uppercase tracking-wider text-white/35 font-mono">
              Signed in
            </div>
            <div className="text-[13px] text-white/95 truncate mt-0.5" title={account.email}>
              {account.email}
            </div>
          </div>
          <a
            href={subscribeHref}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            className="block px-3 py-2 rounded-lg text-[13px] text-white/85 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            Subscribe — $25 / month
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-white/85 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="w-full inline-flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.06] text-white/90 hover:text-white transition-colors"
        title={account.email}
      >
        <span
          aria-hidden
          className="w-7 h-7 inline-flex items-center justify-center rounded-full bg-[#d97757] text-white text-[12.5px] font-medium shrink-0"
        >
          {initial}
        </span>
        <span className="flex-1 min-w-0 text-left text-[13px] text-white/85 truncate">
          {account.email}
        </span>
        <span aria-hidden className="text-white/45 text-[10px]">···</span>
      </button>
    </div>
  );
}

function SessionRow({
  session, active, onLoad, onDelete,
}: {
  session: CompareSession;
  active: boolean;
  onLoad: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={[
        "group relative rounded-lg",
        active ? "bg-white/[0.08]" : "hover:bg-white/[0.04]",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onLoad}
        className="w-full text-left px-3 py-1.5 pr-9 block"
        title={session.title}
      >
        <div
          className={[
            "text-[13.5px] leading-[1.35] truncate",
            active ? "text-white" : "text-white/80",
          ].join(" ")}
        >
          {session.title}
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (confirm("Delete this session?")) onDelete();
        }}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 inline-flex items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Delete session"
        title="Delete"
      >
        ×
      </button>
    </li>
  );
}

// ── Time bucketing — Today / Yesterday / Earlier this week / Older ──
function bucketByRecency(sessions: CompareSession[]) {
  const now = Date.now();
  const day = 86_400_000;
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  const today: CompareSession[] = [];
  const yesterday: CompareSession[] = [];
  const week: CompareSession[] = [];
  const older: CompareSession[] = [];

  for (const s of sessions) {
    if (s.createdAt >= todayMs) today.push(s);
    else if (s.createdAt >= todayMs - day) yesterday.push(s);
    else if (s.createdAt >= now - 7 * day) week.push(s);
    else older.push(s);
  }
  return [
    { label: "today", items: today },
    { label: "yesterday", items: yesterday },
    { label: "earlier this week", items: week },
    { label: "older", items: older },
  ];
}

// ── Icons (no extra deps) ────────────────────────────────────────────
function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" />
      <path d="M10 4l2 2" />
    </svg>
  );
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 150ms ease" }}
    >
      <path d="M3 4.5 L6 7.5 L9 4.5" />
    </svg>
  );
}

function ChevronLeftDouble() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 4 L5 8 L9 12" />
      <path d="M13 4 L9 8 L13 12" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 4 L10 8 L6 12" />
    </svg>
  );
}

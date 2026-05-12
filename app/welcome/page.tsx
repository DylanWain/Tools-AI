/**
 * GET /welcome — install-day funnel for the Chrome extension.
 *
 * Opens automatically on extension install (background.js fires
 * chrome.tabs.create with this URL + a ?source=chrome-ext tag). Goal:
 * convert a fresh extension install into a desktop-app download
 * within 60 seconds. Single primary CTA. Animated demo above the
 * fold so the user instantly sees what they just installed.
 *
 * Brand match: same design tokens as the homepage Hero — Newsreader
 * serif headline, ivory bg, slate-dark CTA pill, JetBrains Mono for
 * meta lines. Reuses Nav + Footer so the page lives in the site.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ExtensionInstallDemo } from "@/components/ExtensionInstallDemo";

export const metadata: Metadata = {
  title: "You're in — get Veronum Desktop",
  description:
    "You just installed Veronum for Chrome. Get the desktop app to unlock 10 parallel agents, live shared sessions, version history, and undo for every AI edit.",
};

const DOWNLOAD_URL =
  "https://github.com/DylanWain/veronum-releases/releases/latest/download/Veronum-1.2.4-universal.dmg";

export default function WelcomePage() {
  return (
    <>
      <Nav />
      <main>
        {/* ── Hero ────────────────────────────────────────────────── */}
        <section className="u-container pt-12 sm:pt-16 lg:pt-24 pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end">
            <div className="lg:col-span-8">
              <div className="font-mono uppercase tracking-[0.08em] text-[var(--detail-xs)] text-ink-faded mb-3 animate-veronum-fade-up">
                You&rsquo;re in.
              </div>
              <h1
                className="font-serif font-medium text-ink leading-[1.02] animate-veronum-fade-up animation-delay-100"
                style={{ fontSize: "var(--display-xxl)" }}
              >
                Now grab the desktop app.
              </h1>
            </div>
            <div className="lg:col-span-4">
              <p
                className="text-ink leading-[1.45] max-w-[40ch] animate-veronum-fade-up animation-delay-200"
                style={{ fontSize: "var(--paragraph-l)" }}
              >
                The Chrome extension lets you share + save AI chats. The desktop
                app runs 10 parallel agents, syncs your codebase, and shares
                live sessions with your team.
              </p>
            </div>
          </div>

          <div className="mt-10 sm:mt-14 flex flex-col sm:flex-row gap-3 sm:items-center animate-veronum-fade-up animation-delay-300">
            <a
              href={DOWNLOAD_URL}
              className="inline-flex items-center justify-center bg-slate-dark text-ivory px-6 py-[12px] rounded-full text-[15.5px] font-medium hover:bg-slate-medium transition"
            >
              Download for Mac — Free
            </a>
            <span className="font-mono text-[var(--detail-xs)] text-ink-faded">
              Universal build · Apple Silicon &amp; Intel · 7-day free trial
            </span>
          </div>
        </section>

        {/* ── Animated demo ──────────────────────────────────────── */}
        <section className="u-container pb-12 sm:pb-20 animate-veronum-fade-up animation-delay-400">
          <ExtensionInstallDemo />
        </section>

        {/* ── How it works strip ─────────────────────────────────── */}
        <section className="u-container py-14 sm:py-20 border-t border-ink/10">
          <h2
            className="font-serif font-medium text-ink leading-[1.05] mb-12"
            style={{ fontSize: "var(--display-l)" }}
          >
            How the funnel works.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            <Step
              n="01"
              title="Click the V on any AI chat"
              body="The Veronum extension drops a small button on every ChatGPT, Claude, Gemini, Grok, and Perplexity conversation. Click → share, save, undo, or hand off to 10 parallel agents."
            />
            <Step
              n="02"
              title="Share live with one click"
              body="The share link goes straight to your clipboard. Paste it in Slack, an email, a DM. Your teammate clicks and sees the conversation rendered cleanly — no screenshots, no copy-paste."
            />
            <Step
              n="03"
              title="Open in Veronum Desktop"
              body="The desktop app is where the real work happens. Run 10 agents at once, get live shared coding sessions with teammates, version history per turn, and one-click undo across your codebase."
            />
          </div>
        </section>

        {/* ── Works with ─────────────────────────────────────────── */}
        <section className="u-container pb-14 sm:pb-20 border-t border-ink/10 pt-14">
          <div className="font-mono uppercase tracking-[0.08em] text-[var(--detail-xs)] text-ink-faded mb-6">
            Works with
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {[
              "ChatGPT",
              "Claude",
              "Cursor",
              "Gemini",
              "Grok",
              "Perplexity",
              "VS Code",
              "Warp",
              "Zed",
            ].map((name) => (
              <span
                key={name}
                className="font-serif text-ink"
                style={{ fontSize: "var(--display-s)" }}
              >
                {name}
              </span>
            ))}
          </div>
        </section>

        {/* ── Final CTA ──────────────────────────────────────────── */}
        <section className="u-container pb-24 sm:pb-32 pt-6">
          <div className="border border-ink/10 rounded-2xl bg-ivory-light p-8 sm:p-12 max-w-[68ch] mx-auto">
            <h2
              className="font-serif font-medium text-ink leading-[1.05] mb-4"
              style={{ fontSize: "var(--display-m)" }}
            >
              Ready to stop switching tabs?
            </h2>
            <p
              className="text-ink leading-[1.55] mb-7 max-w-[52ch]"
              style={{ fontSize: "var(--paragraph-s)" }}
            >
              Veronum Desktop is a free 7-day trial. After that, $25/month
              for unlimited agents, sessions, and shared rooms. Cancel any
              time inside the app.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <a
                href={DOWNLOAD_URL}
                className="inline-flex items-center justify-center bg-slate-dark text-ivory px-5 py-[10px] rounded-full text-[15px] font-medium hover:bg-slate-medium transition"
              >
                Download for Mac — Free
              </a>
              <Link
                href="/"
                className="inline-flex items-center justify-center border border-ink/20 text-ink px-5 py-[10px] rounded-full text-[15px] font-medium hover:bg-ink/[0.04] transition"
              >
                See full features
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />

      {/* ── Page-scoped animation keyframes ─────────────────────── */}
      <style>{`
        @keyframes veronum-fade-up {
          0%   { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-veronum-fade-up {
          animation: veronum-fade-up 0.7s cubic-bezier(0.22, 0.61, 0.36, 1) both;
        }
        .animation-delay-100 { animation-delay: 0.10s; }
        .animation-delay-200 { animation-delay: 0.20s; }
        .animation-delay-300 { animation-delay: 0.35s; }
        .animation-delay-400 { animation-delay: 0.55s; }
      `}</style>
    </>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <div className="font-mono text-[var(--detail-xs)] text-clay mb-3 tracking-[0.05em]">
        {n}
      </div>
      <h3
        className="font-serif font-medium text-ink leading-[1.15] mb-3"
        style={{ fontSize: "var(--display-s)" }}
      >
        {title}
      </h3>
      <p
        className="text-ink leading-[1.55]"
        style={{ fontSize: "var(--paragraph-s)" }}
      >
        {body}
      </p>
    </div>
  );
}

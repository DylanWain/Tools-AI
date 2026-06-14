/**
 * GET / — Veronum marketing landing (dark, matches the pitch deck).
 *
 * Self-contained dark sections so it doesn't touch the shared (light)
 * Nav/Footer used by /support, /privacy, etc. The product lives at /app
 * (where the desktop wrapper loads); the deck at /deck.
 *
 * Rich like the original: live interactive demos (in a light "see it in
 * action" band), social proof, and testimonials.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { VeronumMark } from "@/components/VeronumMark";
import { VeronumDemo } from "@/components/VeronumDemo";
import { MultiAgentDemo } from "@/components/demos/MultiAgentDemo";

export const metadata: Metadata = {
  title: "Veronum — every LLM, one workspace",
  description:
    "One prompt, every model. Compare Claude, GPT, Gemini & Perplexity side-by-side, continue your Claude Code / Cursor / Codex sessions, and code 3.5× faster than any one model alone. 50,000+ conversations and counting.",
};

const APP_URL = "/app";
const DOWNLOAD_URL = "https://github.com/DylanWain/veronum-bridge/releases/latest/download/Veronum-Bridge.dmg";
const PLATFORMS = ["Claude", "GPT", "Gemini", "Cursor", "Perplexity", "Codex"];

const STATS = [
  { v: "50,000+", l: "Conversations had" },
  { v: "450+", l: "Developers" },
  { v: "0%", l: "Churn" },
  { v: "$0", l: "Marketing spend" },
];

const FEATURES = [
  { t: "Compare every model", d: "One prompt fans out to Claude, GPT, Gemini and Perplexity at once. Watch them answer side-by-side and keep the best." },
  { t: "Continue any session", d: "Link your real Claude Code, Cursor and Codex sessions and pick up the thread — then switch models mid-conversation." },
  { t: "Talk to it live", d: "Hands-free voice: speak your prompt, hear the answer. Drive your coding agent without touching the keyboard." },
  { t: "Ten agents at once", d: "Dispatch up to ten agents in parallel on a single task. Stop babysitting one chat and start shipping." },
];

const TESTIMONIALS = [
  { name: "Akash Vishwakarma", file: "akash.jpg", role: "ex-Meta engineer", quote: "Meta has this internally. Nothing exists for the public.", big: true },
  { name: "Jesse", file: "jesse.jpg", role: "Software engineer", quote: "I literally switched from Cursor to this." },
  { name: "Sparsh Sharma", file: "sparsh.jpg", role: "Engineer · USC", quote: "I would willingly pay $50 a month. Most certainly." },
  { name: "Divleen Kaur Chugh", file: "divleen.jpg", role: "Paid since week 1", quote: "This is so useful — I want to show my dad." },
  { name: "Matthias Stephens", file: "matthias.jpg", role: "Founder", quote: "Wow Dylan, this is game-changing." },
  { name: "Fate", file: "fate.jpg", role: "Power user", quote: "Amazing seeing how this gets better every week." },
];

const PRICES = [
  { name: "Free", price: "$5", unit: "of usage", blurb: "Try every model. No card required.", cta: "Start free", href: APP_URL, primary: false },
  { name: "Pro", price: "$25", unit: "/ month", blurb: "Covers $25 of usage at cost, 2× beyond. Cancel anytime.", cta: "Subscribe", href: APP_URL, primary: true },
  { name: "Pay-as-you-go", price: "3×", unit: "raw cost", blurb: "No monthly fee. Card on file, pay only for what you run.", cta: "Open Veronum", href: APP_URL, primary: false },
];

const FAQ = [
  { q: "Which models can I use?", a: "Claude, GPT, Gemini, Perplexity and Grok today — with Codex and more added as they ship. One subscription covers all of them." },
  { q: "Can I keep my existing AI chats?", a: "Yes. Veronum reads your on-disk Claude Code, Cursor and Codex sessions and opens them right in the workspace, fully continuable with any model." },
  { q: "How is it 3.5× faster?", a: "One model is one guess, then a wait, then a retry. Veronum runs every model in parallel and surfaces the first correct answer — and can dispatch ten agents on one task." },
  { q: "Is my code private?", a: "Your sessions are read locally and never leave your machine unless you choose to. Subscription state is anonymous; no password, no harvesting." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-dark text-ivory antialiased">
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-slate-dark/85 backdrop-blur border-b border-ivory/10">
        <div className="u-container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <VeronumMark className="h-8 w-8 rounded-lg" />
            <span className="font-serif font-medium text-[19px] text-ivory">Veronum</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-[14px] text-ivory/70">
            <a href="#demo" className="hover:text-ivory transition">Demo</a>
            <a href="#features" className="hover:text-ivory transition">Features</a>
            <a href="#pricing" className="hover:text-ivory transition">Pricing</a>
            <a href="#faq" className="hover:text-ivory transition">FAQ</a>
            <Link href="/deck" className="hover:text-ivory transition">Deck</Link>
          </nav>
          <Link href={APP_URL} className="inline-flex items-center rounded-full bg-ivory text-slate-dark px-4 py-2 text-[13.5px] font-medium hover:bg-ivory/90 transition">
            Open Veronum
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="u-container pt-20 lg:pt-28 pb-14 text-center">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-clay mb-7">The bridge between the LLMs</p>
        <h1 className="font-serif font-medium leading-[0.95] text-ivory mx-auto max-w-[16ch]" style={{ fontSize: "var(--display-xxl)" }}>
          Every LLM, one workspace.
        </h1>
        <p className="text-ivory/75 leading-[1.5] mx-auto max-w-[58ch] mt-7" style={{ fontSize: "var(--paragraph-l)" }}>
          One prompt → Claude, GPT, Gemini &amp; Perplexity answer side-by-side. Keep the best,
          continue any session, and code <span className="text-clay font-medium">3.5× faster</span> than any one of them alone.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-9">
          <Link href={APP_URL} className="inline-flex items-center rounded-full bg-clay text-ivory px-6 py-3 text-[15px] font-medium hover:opacity-90 transition">
            Try Veronum free
          </Link>
          <a href={DOWNLOAD_URL} className="inline-flex items-center rounded-full border border-ivory/25 text-ivory px-6 py-3 text-[15px] font-medium hover:bg-ivory/[0.06] transition">
            Download for Mac
          </a>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-12 text-ivory/45 font-mono text-[12px] uppercase tracking-[0.08em]">
          {PLATFORMS.map((p, i) => (
            <span key={p} className="flex items-center gap-5">{p}{i < PLATFORMS.length - 1 && <span className="text-clay/60">·</span>}</span>
          ))}
        </div>
      </section>

      {/* Social proof band */}
      <section className="border-y border-ivory/10 bg-ivory/[0.02]">
        <div className="u-container py-10 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {STATS.map((s) => (
            <div key={s.l}>
              <div className="font-serif font-medium text-ivory leading-[0.95]" style={{ fontSize: "var(--display-m)" }}>{s.v}</div>
              <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ivory/50 mt-2">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* LIGHT "see it in action" showcase — the live demos */}
      <section id="demo" className="bg-ivory text-ink">
        <div className="u-container py-16 lg:py-24">
          <div className="text-center mb-12">
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-clay mb-3">See it in action</p>
            <h2 className="font-serif font-medium text-ink leading-[1.05] mx-auto max-w-[24ch]" style={{ fontSize: "var(--display-l)" }}>
              One prompt. Every model. Ten agents.
            </h2>
          </div>
          <div className="space-y-16 lg:space-y-24">
            <div>
              <h3 className="font-serif font-medium text-ink text-[22px] mb-5 text-center">Compare every model, live</h3>
              <VeronumDemo />
            </div>
            <div>
              <h3 className="font-serif font-medium text-ink text-[22px] mb-5 text-center">Dispatch ten agents at once</h3>
              <MultiAgentDemo />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="u-container py-16 lg:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-[80ch] mx-auto">
          {FEATURES.map((f) => (
            <div key={f.t} className="bg-ivory/[0.04] border border-ivory/10 rounded-2xl p-7">
              <h3 className="font-serif font-medium text-ivory text-[22px] mb-2">{f.t}</h3>
              <p className="text-ivory/70 text-[15px] leading-[1.55]">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3.5x band */}
      <section className="u-container py-8">
        <div className="max-w-[72ch] mx-auto text-center bg-ivory/[0.03] border border-ivory/10 rounded-3xl px-8 py-14">
          <div className="font-serif font-medium text-clay leading-[0.9]" style={{ fontSize: "var(--display-xxl)" }}>3.5×</div>
          <p className="font-serif text-ivory leading-[1.1] mt-3" style={{ fontSize: "var(--display-s)" }}>faster than coding with Claude alone.</p>
          <p className="text-ivory/60 text-[14px] mt-4">Parallel models. Best answer wins. Ten agents on tap.</p>
        </div>
      </section>

      {/* Testimonials */}
      <section className="u-container py-16 lg:py-24">
        <h2 className="font-serif font-medium text-ivory text-center mb-12" style={{ fontSize: "var(--display-l)" }}>Developers are switching.</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-[92ch] mx-auto">
          {TESTIMONIALS.map((q) => (
            <div key={q.name} className={"rounded-2xl border border-ivory/10 p-6 flex flex-col gap-3 " + (q.big ? "bg-clay/[0.10] sm:col-span-2 lg:col-span-1 lg:row-span-1" : "bg-ivory/[0.04]")}>
              <p className={"font-serif leading-[1.3] flex-1 " + (q.big ? "text-ivory text-[19px]" : "text-ivory/90 text-[15px]")}>
                <span className="text-clay mr-1">&ldquo;</span>{q.quote}
              </p>
              <div className="flex items-center gap-2.5 pt-2 border-t border-ivory/10">
                <CustomerPhoto name={q.name} file={q.file} size={30} />
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium text-ivory truncate">{q.name}</div>
                  <div className="text-[11px] text-ivory/50 truncate">{q.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="u-container py-16 lg:py-24">
        <h2 className="font-serif font-medium text-ivory text-center mb-3" style={{ fontSize: "var(--display-l)" }}>Simple pricing.</h2>
        <p className="text-ivory/60 text-center mb-12 text-[15px]">Free to start. $25/month when you go deep — or pay only for what you run.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-[84ch] mx-auto">
          {PRICES.map((p) => (
            <div key={p.name} className={"rounded-2xl p-7 flex flex-col " + (p.primary ? "bg-ivory text-slate-dark" : "bg-ivory/[0.04] border border-ivory/10 text-ivory")}>
              <div className={"font-mono text-[11px] uppercase tracking-[0.12em] mb-4 " + (p.primary ? "text-slate-dark/60" : "text-ivory/50")}>{p.name}</div>
              <div className="flex items-baseline gap-1.5 mb-3">
                <span className="font-serif font-medium" style={{ fontSize: "var(--display-m)" }}>{p.price}</span>
                <span className={"text-[13px] " + (p.primary ? "text-slate-dark/60" : "text-ivory/55")}>{p.unit}</span>
              </div>
              <p className={"text-[14px] leading-[1.5] flex-1 mb-6 " + (p.primary ? "text-slate-dark/75" : "text-ivory/70")}>{p.blurb}</p>
              <Link href={p.href} className={"inline-flex items-center justify-center rounded-full px-5 py-2.5 text-[14px] font-medium transition " + (p.primary ? "bg-slate-dark text-ivory hover:bg-slate-dark/90" : "bg-ivory/10 text-ivory hover:bg-ivory/15")}>{p.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="u-container py-16 lg:py-24 max-w-[68ch] mx-auto">
        <h2 className="font-serif font-medium text-ivory text-center mb-12" style={{ fontSize: "var(--display-l)" }}>Questions, answered.</h2>
        <ul className="divide-y divide-ivory/10 border-t border-b border-ivory/10">
          {FAQ.map((item) => (
            <li key={item.q}>
              <details className="group">
                <summary className="flex justify-between items-center gap-4 py-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="text-[16px] font-medium text-ivory">{item.q}</span>
                  <span aria-hidden className="text-ivory/40 text-2xl leading-none transition-transform group-open:rotate-45 select-none">+</span>
                </summary>
                <p className="text-[15px] text-ivory/70 leading-relaxed pb-5">{item.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      {/* Final CTA */}
      <section className="u-container py-20 text-center">
        <VeronumMark className="h-14 w-14 rounded-xl mx-auto mb-7" />
        <h2 className="font-serif font-medium text-ivory mx-auto max-w-[18ch]" style={{ fontSize: "var(--display-l)" }}>Every LLM, one workspace.</h2>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          <Link href={APP_URL} className="inline-flex items-center rounded-full bg-clay text-ivory px-6 py-3 text-[15px] font-medium hover:opacity-90 transition">Try Veronum free</Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ivory/10">
        <div className="u-container py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-ivory/50">
          <span>© 2026 Veronum</span>
          <div className="flex items-center gap-6">
            <Link href="/deck" className="hover:text-ivory transition">Deck</Link>
            <Link href="/support" className="hover:text-ivory transition">Support</Link>
            <Link href="/privacy" className="hover:text-ivory transition">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CustomerPhoto({ name, file, size = 30 }: { name: string; file: string; size?: number }) {
  const initials = name.split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  return (
    <div className="relative rounded-full overflow-hidden bg-clay/20 flex-shrink-0" style={{ width: size, height: size }}>
      <span className="absolute inset-0 flex items-center justify-center font-serif font-medium text-clay" style={{ fontSize: size / 2.6 }}>{initials}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/customers/${file}`} alt={name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
    </div>
  );
}

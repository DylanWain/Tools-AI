import { Slide } from "./Slide";
import { VeronumMark } from "../VeronumMark";

/**
 * Veronum pre-seed deck — 13 slides, DARK MODE.
 *
 * Repositioned for the new Veronum: the multi-LLM bridge. Every model in
 * one workspace, 3.5× faster than Claude alone, link + continue your
 * Claude Code / Cursor / Codex sessions, talk to it live.
 *
 * Tuned for Gana Narayan (fintech/payments angel) who asked specifically
 * for distribution/GTM + unit economics — both get their own slide.
 *
 * Order:
 *   1.  Cover
 *   2.  Problem        — LLM fragmentation
 *   3.  Solution       — one prompt, every model
 *   4.  3.5× faster    — why parallel wins
 *   5.  How it works
 *   6.  vs Nessie      — competition
 *   7.  Traction       — $200+ MRR, 450+ users
 *   8.  Go-to-market   — distribution (for Gana)
 *   9.  Unit economics — (for Gana)
 *   10. Team
 *   11. Vision
 *   12. Ask
 *   13. Contact
 */

const TOTAL = 13;

const COMMITTED_INVESTORS = [
  "Travis Laderer",
  "Cristian Laderer",
  "David Simpson",
  "Mahmood Midlij",
];

/* shared bits ───────────────────────────────────────────────── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-clay mb-10">
      {children}
    </p>
  );
}

function StatCard({ v, l, sub }: { v: string; l: string; sub?: string }) {
  return (
    <div className="bg-ivory/[0.04] border border-ivory/10 rounded-2xl p-5 lg:p-7 flex flex-col items-center text-center">
      <div
        className="font-serif font-medium text-ivory leading-[1.0] mb-2"
        style={{ fontSize: "var(--display-m)" }}
      >
        {v}
      </div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.10em] text-ivory/55 leading-[1.4]">
        {l}
      </div>
      {sub && <div className="text-[11px] text-ivory/40 mt-1.5 leading-snug">{sub}</div>}
    </div>
  );
}

/* ───────────── SLIDE 1: COVER ───────────── */
export function S01Cover() {
  return (
    <Slide n={1} bg="ink" total={TOTAL}>
      <div className="flex flex-col items-center gap-9 lg:gap-11">
        <VeronumMark className="h-20 w-20 lg:h-24 lg:w-24 rounded-2xl" />
        <h1
          className="font-serif font-medium leading-[0.92] text-ivory"
          style={{ fontSize: "var(--display-xxl)" }}
        >
          Veronum.
        </h1>
        <p
          className="font-serif italic font-light text-ivory/85 leading-[1.15] mx-auto max-w-[30ch]"
          style={{ fontSize: "var(--display-m)" }}
        >
          Every LLM, one workspace.
        </p>
        <p className="text-ivory/65 leading-[1.4] max-w-[44ch]" style={{ fontSize: "var(--paragraph-m)" }}>
          The bridge between Claude, GPT, Gemini &amp; Cursor — codes{" "}
          <span className="text-clay font-medium">3.5× faster</span> than any one of them alone.
        </p>
        <p className="text-[13.5px] text-ivory/45 font-mono uppercase tracking-[0.14em] mt-4">
          Pre-seed · $200K · 25% committed · 2026
        </p>
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 2: PROBLEM ───────────── */
export function S02Problem() {
  const tools = ["Claude", "GPT", "Cursor", "Perplexity", "Codex", "Gemini"];
  return (
    <Slide n={2} bg="ink" total={TOTAL}>
      <Eyebrow>The problem</Eyebrow>
      <h2
        className="font-serif font-medium leading-[0.95] text-ivory mx-auto mb-12 max-w-[24ch]"
        style={{ fontSize: "var(--display-xxl)" }}
      >
        Every developer pays for five AIs — and switches between all of them.
      </h2>

      <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
        {tools.map((t) => (
          <span
            key={t}
            className="px-4 py-1.5 rounded-full bg-ivory/[0.06] border border-ivory/10 text-ivory/85 font-medium"
            style={{ fontSize: "var(--paragraph-m)" }}
          >
            {t}
          </span>
        ))}
      </div>

      <p
        className="font-serif italic font-light text-ivory/70 leading-[1.3] mx-auto max-w-[44ch]"
        style={{ fontSize: "var(--paragraph-l)" }}
      >
        Different tabs, different bills, no way to compare answers — and you&apos;re
        always betting on the wrong model for the task.
      </p>
    </Slide>
  );
}

/* ───────────── SLIDE 3: SOLUTION ───────────── */
export function S03Solution() {
  return (
    <Slide n={3} bg="ink" total={TOTAL}>
      <Eyebrow>The solution</Eyebrow>
      <h2
        className="font-serif font-medium leading-[0.92] text-ivory mx-auto mb-10 max-w-[24ch]"
        style={{ fontSize: "var(--display-xxl)" }}
      >
        One prompt. Every model. The best answer.
      </h2>
      <p
        className="text-ivory/80 leading-[1.5] mx-auto max-w-[62ch] mb-10"
        style={{ fontSize: "var(--paragraph-l)" }}
      >
        Veronum runs Claude, GPT, Gemini and Perplexity side-by-side on one
        prompt, links and continues your existing Claude Code / Cursor / Codex
        sessions, and lets you talk to it hands-free. Pick the winner — or keep
        going with whichever model is best for the next step.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-ivory/60 font-mono text-[12.5px] uppercase tracking-[0.1em]">
        <span>Compare</span><span className="text-clay">·</span>
        <span>Continue any session</span><span className="text-clay">·</span>
        <span>Live voice</span><span className="text-clay">·</span>
        <span>10-agent orchestration</span>
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 4: 3.5× FASTER ───────────── */
export function S04Speed() {
  return (
    <Slide n={4} bg="ink" total={TOTAL}>
      <Eyebrow>Why it&apos;s faster</Eyebrow>
      <div
        className="font-serif font-medium text-clay leading-[0.9] mb-4"
        style={{ fontSize: "var(--display-xxl)" }}
      >
        3.5×
      </div>
      <h2
        className="font-serif font-medium leading-[1.0] text-ivory mx-auto mb-10 max-w-[24ch]"
        style={{ fontSize: "var(--display-m)" }}
      >
        faster than coding with Claude alone.
      </h2>
      <p
        className="text-ivory/80 leading-[1.5] mx-auto max-w-[60ch]"
        style={{ fontSize: "var(--paragraph-l)" }}
      >
        One model means one guess, then a wait, then a retry. Veronum fires the
        prompt at every model in parallel and surfaces the first correct
        answer — and dispatches up to ten agents at once on a single task. You
        stop babysitting one chat and start shipping.
      </p>
    </Slide>
  );
}

/* ───────────── SLIDE 5: HOW IT WORKS ───────────── */
export function S05How() {
  const steps = [
    { n: "1", t: "Ask once", d: "Type a prompt or speak it. It fans out to every model you pick — Claude, GPT, Gemini, Perplexity." },
    { n: "2", t: "Take the best", d: "Answers stream in side-by-side. Pick the winner; the rest is one tap away if you want to compare." },
    { n: "3", t: "Keep going", d: "Continue any thread — including your real Claude Code / Cursor / Codex sessions — and switch models mid-conversation." },
  ];
  return (
    <Slide n={5} bg="ink" total={TOTAL} wide>
      <Eyebrow>How it works</Eyebrow>
      <h2
        className="font-serif font-medium leading-[1.0] text-ivory mb-12 mx-auto max-w-[26ch]"
        style={{ fontSize: "var(--display-l)" }}
      >
        Your AI sessions, every model, one place.
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mx-auto max-w-[92ch] text-left">
        {steps.map((s) => (
          <div key={s.n} className="bg-ivory/[0.04] border border-ivory/10 rounded-2xl p-6">
            <div className="font-serif text-clay text-[28px] leading-none mb-4">{s.n}</div>
            <div className="font-serif font-medium text-ivory text-[20px] mb-2">{s.t}</div>
            <p className="text-ivory/70 text-[14px] leading-[1.5]">{s.d}</p>
          </div>
        ))}
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 6: vs NESSIE ───────────── */
export function S06Nessie() {
  const rows = [
    { f: "Pulls in your Claude / Cursor / Codex history", n: true, v: true },
    { f: "Compare every model on one prompt", n: false, v: true },
    { f: "Continue a session with any LLM", n: false, v: true },
    { f: "Live voice control", n: false, v: true },
    { f: "10-agent parallel orchestration", n: false, v: true },
    { f: "Built-in billing — free → $25/mo", n: false, v: true },
  ];
  return (
    <Slide n={6} bg="ink" total={TOTAL} wide>
      <Eyebrow>Competition</Eyebrow>
      <h2
        className="font-serif font-medium leading-[1.0] text-ivory mb-4 mx-auto max-w-[28ch]"
        style={{ fontSize: "var(--display-l)" }}
      >
        Nessie remembers your AI chats. Veronum runs them.
      </h2>
      <p className="text-ivory/65 leading-[1.45] mx-auto max-w-[56ch] mb-10" style={{ fontSize: "var(--paragraph-s)" }}>
        The closest tool is a passive memory layer. We do the ingestion too — then
        turn it into an active multi-model workspace.
      </p>

      <div className="mx-auto max-w-[72ch] text-left">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 items-center pb-3 mb-2 border-b border-ivory/15 font-mono text-[11px] uppercase tracking-[0.1em] text-ivory/50">
          <span></span><span className="text-center w-16">Nessie</span><span className="text-center w-16 text-clay">Veronum</span>
        </div>
        {rows.map((r) => (
          <div key={r.f} className="grid grid-cols-[1fr_auto_auto] gap-x-6 items-center py-2.5 border-b border-ivory/[0.07]">
            <span className="text-ivory/85 text-[14.5px]">{r.f}</span>
            <span className="text-center w-16 text-[15px]">{r.n ? <span className="text-ivory/50">✓</span> : <span className="text-ivory/20">—</span>}</span>
            <span className="text-center w-16 text-[15px]">{r.v ? <span className="text-clay">✓</span> : <span className="text-ivory/20">—</span>}</span>
          </div>
        ))}
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 7: TRACTION ───────────── */
export function S07Traction() {
  const stats = [
    { v: "450+", l: "Users", sub: "4 months · $0 marketing" },
    { v: "$200+", l: "MRR", sub: "Growing weekly" },
    { v: "0%", l: "Churn", sub: "85% weekly retention" },
    { v: "25%", l: "Round committed", sub: "4 angels in" },
  ];
  const customers = [
    { name: "Jesse", file: "jesse.jpg", quote: "I literally switched from Cursor to this.", role: "Software engineer" },
    { name: "Sparsh Sharma", file: "sparsh.jpg", quote: "I would willingly pay $50 a month. Most certainly.", role: "Engineer · USC" },
    { name: "Divleen Kaur Chugh", file: "divleen.jpg", quote: "This is so useful — I want to show my dad.", role: "Paid since week 1" },
    { name: "Matthias Stephens", file: "matthias.jpg", quote: "Wow Dylan, this is game-changing.", role: "Founder" },
  ];
  return (
    <Slide n={7} bg="ink" total={TOTAL} wide>
      <Eyebrow>Traction</Eyebrow>

      <div className="bg-ivory/[0.04] border border-ivory/10 rounded-2xl p-7 lg:p-9 mb-9 mx-auto max-w-[58ch] text-left">
        <p className="font-serif font-normal leading-[1.15] text-ivory" style={{ fontSize: "var(--display-m)" }}>
          <span className="text-clay text-[1.3em] leading-none mr-2 align-top">&ldquo;</span>
          Meta has this internally. Nothing exists for the public.
        </p>
        <div className="mt-5 flex items-center gap-3 pt-4 border-t border-ivory/15">
          <CustomerPhoto name="Akash Vishwakarma" file="akash.jpg" size={42} />
          <div>
            <div className="font-medium text-ivory text-[14px]">Akash Vishwakarma</div>
            <div className="text-[12px] text-ivory/55">ex-Meta engineer</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mx-auto max-w-[88ch] mb-9">
        {stats.map((s) => <StatCard key={s.l} {...s} />)}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mx-auto max-w-[92ch] text-left">
        {customers.map((q) => (
          <div key={q.name} className="bg-ivory/[0.04] border border-ivory/10 rounded-xl p-3.5 flex flex-col gap-2">
            <p className="font-serif font-normal leading-[1.25] text-ivory/90 flex-1" style={{ fontSize: "13.5px" }}>
              <span className="text-clay text-[1.2em] leading-none mr-1 align-top">&ldquo;</span>{q.quote}
            </p>
            <div className="flex items-center gap-2 pt-2 border-t border-ivory/10">
              <CustomerPhoto name={q.name} file={q.file} size={24} />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-[11.5px] text-ivory truncate">{q.name}</div>
                <div className="text-[10px] text-ivory/50 truncate">{q.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 8: GO-TO-MARKET ───────────── */
export function S08GTM() {
  const channels = [
    { t: "Founder-led organic", d: "Same playbook that took Dibby Tour to 1M+ views and 500+ paying customers — DMs, demos, build-in-public. $0 spent, 450+ users in 4 months." },
    { t: "Product-led free → paid", d: "Free tier to try every model, then $25/mo or pay-as-you-go. Self-serve conversion, no sales touch." },
    { t: "Browser extension wedge", d: "A Chrome extension lives on ChatGPT / Claude / Gemini / Perplexity — captures developers where they already work and funnels them into the app." },
  ];
  return (
    <Slide n={8} bg="ink" total={TOTAL} wide>
      <Eyebrow>Go-to-market</Eyebrow>
      <h2 className="font-serif font-medium leading-[1.0] text-ivory mb-3 mx-auto max-w-[26ch]" style={{ fontSize: "var(--display-l)" }}>
        Distribution is the moat — and it&apos;s already working.
      </h2>
      <p className="text-ivory/65 leading-[1.45] mx-auto max-w-[58ch] mb-10" style={{ fontSize: "var(--paragraph-s)" }}>
        Three compounding channels, all organic today. CAC is effectively $0.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mx-auto max-w-[94ch] text-left">
        {channels.map((c, i) => (
          <div key={c.t} className="bg-ivory/[0.04] border border-ivory/10 rounded-2xl p-6">
            <div className="font-mono text-clay text-[12px] mb-3">0{i + 1}</div>
            <div className="font-serif font-medium text-ivory text-[18px] mb-2 leading-tight">{c.t}</div>
            <p className="text-ivory/70 text-[13.5px] leading-[1.5]">{c.d}</p>
          </div>
        ))}
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 9: UNIT ECONOMICS ───────────── */
export function S09Economics() {
  const metrics = [
    { v: "$0", l: "CAC", sub: "100% organic / founder-led" },
    { v: "$25/mo", l: "ARPU", sub: "Flat plan + pay-as-you-go" },
    { v: "~65%", l: "Gross margin", sub: "Usage metered at 3× raw model cost" },
    { v: "0%", l: "Churn", sub: "85% weekly retention" },
  ];
  return (
    <Slide n={9} bg="ink" total={TOTAL} wide>
      <Eyebrow>Unit economics</Eyebrow>
      <h2 className="font-serif font-medium leading-[1.0] text-ivory mb-10 mx-auto max-w-[26ch]" style={{ fontSize: "var(--display-l)" }}>
        $0 to acquire. 65% margin to serve.
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mx-auto max-w-[88ch] mb-10">
        {metrics.map((m) => <StatCard key={m.l} {...m} />)}
      </div>
      <p className="text-ivory/75 leading-[1.55] mx-auto max-w-[64ch] text-left lg:text-center" style={{ fontSize: "var(--paragraph-m)" }}>
        We charge a flat <span className="text-ivory font-medium">$25/mo</span> (covers $25 of model
        usage at cost, 2× beyond) or pay-as-you-go at <span className="text-ivory font-medium">3× raw cost</span> —
        so every paid call is gross-margin positive. With $0 CAC, even one
        retained month clears payback. The free tier converts on a small,
        capped trial — not a subsidy.
      </p>
    </Slide>
  );
}

/* ───────────── SLIDE 10: TEAM ───────────── */
export function S10Team() {
  const dibby = [
    { metric: "1,000,000+", label: "Organic social views" },
    { metric: "500+", label: "Paying customers" },
    { metric: "3", label: "B2B · UCLA · USC · NYU" },
    { metric: "Hilary Duff", label: "Celebrity endorsement" },
  ];
  return (
    <Slide n={10} bg="ink" total={TOTAL}>
      <Eyebrow>Team</Eyebrow>
      <div className="flex flex-col items-center gap-2 mb-12">
        <div className="bg-ivory/[0.06] rounded-2xl p-1">
          <CustomerPhoto name="Dylan Wain" file="dylan.jpg" size={150} />
        </div>
        <h3 className="font-serif font-medium text-ivory leading-[0.95] mt-3" style={{ fontSize: "var(--display-l)" }}>
          Dylan Wain
        </h3>
        <p className="text-[15px] text-ivory/55">Founder · 2× founder</p>
        <p className="font-serif italic font-light text-ivory/75 leading-[1.3] mt-1" style={{ fontSize: "var(--paragraph-l)" }}>
          Last company: <span className="text-ivory font-medium not-italic">Dibby Tour.</span>
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mx-auto max-w-[88ch] mb-10">
        {dibby.map((d) => <StatCard key={d.label} v={d.metric} l={d.label} />)}
      </div>
      <p className="font-serif text-ivory/85 leading-[1.25] mx-auto max-w-[54ch]" style={{ fontSize: "var(--paragraph-l)" }}>
        Same organic-growth playbook, pointed at a $5B market.
      </p>
    </Slide>
  );
}

/* ───────────── SLIDE 11: VISION ───────────── */
export function S11Vision() {
  return (
    <Slide n={11} bg="ink" total={TOTAL}>
      <Eyebrow>Vision</Eyebrow>
      <h2 className="font-serif font-medium leading-[0.95] text-ivory mb-12 mx-auto max-w-[24ch]" style={{ fontSize: "var(--display-xxl)" }}>
        The default interface for AI development.
      </h2>
      <p className="text-ivory/80 leading-[1.5] mx-auto max-w-[64ch]" style={{ fontSize: "var(--paragraph-l)" }}>
        Models will keep multiplying. The winner isn&apos;t a model — it&apos;s the
        layer developers live in to use all of them. Veronum is that layer:
        every LLM, every session, every device, one subscription.
      </p>
    </Slide>
  );
}

/* ───────────── SLIDE 12: ASK ───────────── */
export function S12Ask() {
  return (
    <Slide n={12} bg="ink" total={TOTAL}>
      <Eyebrow>The ask</Eyebrow>
      <h2 className="font-serif font-medium leading-[0.9] text-ivory" style={{ fontSize: "var(--display-xxl)" }}>
        $200K
      </h2>
      <p className="font-serif italic font-light text-ivory/70 mt-2 mb-4" style={{ fontSize: "var(--display-m)" }}>
        at $5M post-money.
      </p>
      <p className="font-mono text-[13px] uppercase tracking-[0.14em] text-clay mb-12">
        25% already committed
      </p>

      <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ivory/50 mb-4">Already in</p>
      <p className="font-serif font-medium text-ivory leading-[1.15] mb-14 mx-auto max-w-[40ch]" style={{ fontSize: "var(--display-m)" }}>
        {COMMITTED_INVESTORS.join(" · ")}
      </p>

      <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ivory/50 mb-4">12-month milestones</p>
      <ul className="space-y-3 inline-block text-left">
        <Milestone label="$25K MRR · 5,000+ users" />
        <Milestone label="Every major model + session source linked" />
        <Milestone label="Team + enterprise seats" />
      </ul>
    </Slide>
  );
}

function Milestone({ label }: { label: string }) {
  return (
    <li className="flex items-baseline gap-4 text-ivory leading-tight" style={{ fontSize: "var(--paragraph-l)" }}>
      <span className="text-clay">→</span>
      <span>{label}</span>
    </li>
  );
}

/* ───────────── SLIDE 13: CONTACT ───────────── */
export function S13Contact() {
  return (
    <Slide n={13} bg="ink" total={TOTAL}>
      <div className="flex flex-col items-center gap-8 lg:gap-10">
        <VeronumMark className="h-16 w-16 lg:h-20 lg:w-20 rounded-2xl" />
        <h2 className="font-serif font-medium leading-[0.95] text-ivory" style={{ fontSize: "var(--display-xl)" }}>
          Dylan Wain
        </h2>
        <div className="flex flex-col items-center gap-2">
          <a href="mailto:dylan.veronum@gmail.com" className="font-mono text-[17px] text-clay underline underline-offset-4 decoration-1 hover:opacity-70 transition">
            dylan.veronum@gmail.com
          </a>
          <a href="https://www.thetoolswebsite.com" className="font-mono text-[15px] text-ivory/55 underline underline-offset-4 decoration-1 hover:text-ivory transition">
            thetoolswebsite.com
          </a>
        </div>
        <p className="font-serif italic font-light text-ivory/70 leading-[1.2] mt-6" style={{ fontSize: "var(--display-m)" }}>
          Every LLM, one workspace.
        </p>
      </div>
    </Slide>
  );
}

/* ───────────── shared: customer photo ───────────── */
function CustomerPhoto({ name, file, size = 56 }: { name: string; file: string; size?: number }) {
  const initials = name.split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  return (
    <div className="relative rounded-full overflow-hidden bg-clay/20 flex-shrink-0" style={{ width: size, height: size }}>
      <span className="absolute inset-0 flex items-center justify-center font-serif font-medium text-clay" style={{ fontSize: size / 2.5 }}>
        {initials}
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/customers/${file}`} alt={name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
    </div>
  );
}

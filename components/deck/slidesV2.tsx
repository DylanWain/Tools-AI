import { Slide } from "./Slide";
import { VeronumMark } from "../VeronumMark";
import { VeronumDemo } from "../VeronumDemo";

/**
 * 15-slide pitch deck — V2.
 *
 * Same shell as the V1 deck (same Slide wrapper, same chrome) but with
 * rewritten copy and ordering to lead on:
 *   1. Cross-tool collaboration (Claude / Cursor / VS Code / ChatGPT / Codex
 *      working on the same project simultaneously)
 *   2. 10-agent parallel orchestration
 *   3. Universal undo/redo across every tool
 *   4. Founder-as-hero — Dylan's prior wins + already-believing angels
 *      (Travis L. · Mahmood M. · David S. · Christian L.)
 *
 * Render strategy mirrors V1 — every slide is a Server Component except
 * S05Demo which embeds the existing client-side VeronumDemo animation.
 */

/* ───────────── SLIDE 1: COVER ───────────── */
export function S01Cover() {
  return (
    <Slide n={1}>
      <div className="flex flex-col items-start gap-10 lg:gap-14 max-w-[80ch]">
        <VeronumMark className="h-20 w-20 lg:h-24 lg:w-24 rounded-2xl" />
        <h1
          className="font-serif font-medium leading-[0.95] text-ink"
          style={{ fontSize: "var(--display-xxl)" }}
        >
          Veronum.
        </h1>
        <div>
          <p
            className="font-serif font-light text-ink leading-[1.15] max-w-[28ch]"
            style={{ fontSize: "var(--display-m)" }}
          >
            Every AI coding tool, working on the same project — at the same
            time.
          </p>
          <p
            className="mt-6 text-ink/70 leading-relaxed max-w-[46ch]"
            style={{ fontSize: "var(--paragraph-m)" }}
          >
            Claude · Cursor · VS Code · ChatGPT · Codex — connected through
            Veronum. Up to ten agents in parallel. Full undo across every
            tool.
          </p>
        </div>

        <div className="mt-auto pt-8 border-t border-ink/10 self-stretch flex flex-wrap items-baseline justify-between gap-6">
          <div>
            <p className="text-[10px] text-ink-faded font-mono uppercase tracking-[0.16em] mb-2">
              Already invested
            </p>
            <p className="font-serif text-[18px] text-ink leading-snug">
              Travis L. · Mahmood M. · David S. · Christian L.
            </p>
          </div>
          <p className="text-[12px] text-ink-faded font-mono uppercase tracking-[0.12em]">
            Pre-seed · $200K at $5M post · April 2026
          </p>
        </div>
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 2: THE BET ───────────── */
export function S02Bet() {
  return (
    <Slide n={2}>
      <div className="max-w-[44ch]">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-8">
          Our bet
        </p>
        <h2
          className="font-serif font-medium leading-[1.1] text-ink"
          style={{ fontSize: "var(--display-l)" }}
        >
          Foundation models are a{" "}
          <span className="italic font-light">commodity</span>. The
          cross-tool workspace above them is{" "}
          <span className="italic font-light">winner-take-most</span>.
        </h2>
        <p
          className="mt-8 text-ink/80 leading-relaxed max-w-[58ch]"
          style={{ fontSize: "var(--paragraph-m)" }}
        >
          Every developer uses three or more AI tools today. None of them
          talk to each other. The product that makes them work as one wins
          the category — the way Slack did with messaging, Figma did with
          design files. <strong className="font-medium">Rewind sold to
          Meta in December 2025</strong> and validated cross-tool memory as
          the next AI primitive. We're building the dev-team layer above
          it.
        </p>
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 3: PROBLEM ───────────── */
export function S03Problem() {
  return (
    <Slide n={3} bg="oat">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
        <div className="lg:col-span-7">
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-8">
            The problem
          </p>
          <h2
            className="font-serif font-medium leading-[1.05] text-ink mb-10 max-w-[24ch]"
            style={{ fontSize: "var(--display-l)" }}
          >
            Five tools. One project. No memory.
          </h2>
          <ul className="space-y-3">
            <PainStat
              n="3.4"
              label="AI tools per developer (avg)"
              detail="Claude + ChatGPT + Cursor + VS Code Copilot + a fifth"
            />
            <PainStat
              n="6.2 hrs"
              label="duplicated AI work per dev per week"
              detail="The same question asked of three different agents"
            />
            <PainStat
              n="0%"
              label="cross-tool context retained"
              detail="Switch tools = start the conversation over"
            />
            <PainStat
              n="∅"
              label="undo across the agent's whole change set"
              detail="One agent rewrites 12 files. You want it gone. Good luck."
            />
          </ul>
        </div>

        <div className="lg:col-span-5 lg:pt-32">
          <blockquote
            className="font-serif font-normal leading-[1.2] text-ink"
            style={{ fontSize: "var(--display-s)" }}
          >
            <span className="text-clay text-[1.4em] leading-none mr-2 align-top">
              "
            </span>
            This is so useful — I want to show this to my dad, he&apos;ll
            love this.
          </blockquote>
          <div className="mt-8 flex items-center gap-4">
            <CustomerPhoto name="Divleen Kaur Chugh" file="divleen.jpg" />
            <div>
              <div className="font-medium text-ink text-[15px]">
                Divleen Kaur Chugh
              </div>
              <div className="text-[13.5px] text-ink-faded">
                Veronum customer · paid since week 1
              </div>
            </div>
          </div>
        </div>
      </div>
    </Slide>
  );
}

function PainStat({
  n,
  label,
  detail,
}: {
  n: string;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex items-baseline gap-5 py-3 border-b border-ink/15 first:border-t">
      <span
        className="font-serif font-medium text-clay leading-none w-24 flex-shrink-0"
        style={{ fontSize: "var(--display-s)" }}
      >
        {n}
      </span>
      <div>
        <div className="font-medium text-ink text-[15.5px]">{label}</div>
        <div className="text-[13px] text-ink/70 leading-snug">{detail}</div>
      </div>
    </li>
  );
}

/* ───────────── SLIDE 4: SOLUTION ───────────── */
export function S04Solution() {
  const features: { headline: string; detail: string; tag: string }[] = [
    {
      tag: "Cross-tool",
      headline: "One workspace — every AI tool",
      detail:
        "Claude · Cursor · VS Code · ChatGPT · Codex — already shipped. Edit in any one, see it in all five.",
    },
    {
      tag: "Multi-agent",
      headline: "Ten agents in parallel",
      detail:
        "Tests · Refactor · Docs · Review · Deploy · Migrate · Lint · Bench · Security · E2E. Dispatch from one prompt, synthesize back to one answer.",
    },
    {
      tag: "Undo",
      headline: "Universal undo / redo",
      detail:
        "An agent rewrites twelve files across three tools. One click rolls all of it back — atomic, across tools.",
    },
    {
      tag: "Collab",
      headline: "Real-time team rooms",
      detail:
        "Your teammate's Claude knows what your Cursor said. Shared file state, presence, activity timeline.",
    },
    {
      tag: "Memory",
      headline: "Cross-tool memory",
      detail:
        "Context follows you across tools — Claude → Cursor → ChatGPT — without copy-paste.",
    },
    {
      tag: "Local",
      headline: "Local-first",
      detail:
        "Your code stays on your Mac. We sync diffs and metadata, never your repo.",
    },
  ];

  return (
    <Slide n={4}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
        <div className="lg:col-span-5">
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-8">
            What Veronum is
          </p>
          <VeronumMark className="h-16 w-16 lg:h-20 lg:w-20 rounded-2xl mb-8" />
          <h2
            className="font-serif font-medium leading-[1.05] text-ink"
            style={{ fontSize: "var(--display-l)" }}
          >
            One workspace. Every AI tool. Ten agents.
          </h2>
          <p
            className="mt-6 text-ink/80 leading-relaxed"
            style={{ fontSize: "var(--paragraph-m)" }}
          >
            One Mac app. Free for solo. $25/month when you connect with
            others or run multiple agents. 14-day Pro trial — no card.
          </p>
        </div>

        <div className="lg:col-span-7">
          <ul className="space-y-1">
            {features.map((f) => (
              <li
                key={f.tag}
                className="flex items-baseline gap-5 py-4 border-b border-ink/10 first:border-t"
              >
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-clay w-20 flex-shrink-0 pt-1">
                  {f.tag}
                </span>
                <div className="flex-1">
                  <div className="font-serif text-[18px] font-medium text-ink leading-snug">
                    {f.headline}
                  </div>
                  <div className="text-[13.5px] text-ink/70 mt-1 leading-snug">
                    {f.detail}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 5: LIVE DEMO ───────────── */
export function S05Demo() {
  return (
    <Slide n={5} bg="ivory" className="!py-0">
      {/* Screen version: storyboard above, animated agent demo below */}
      <div className="-my-8 lg:-my-16 print:hidden">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-2">
          Live demo
        </p>
        <h2
          className="font-serif font-medium leading-[1.05] text-ink mb-2"
          style={{ fontSize: "var(--display-m)" }}
        >
          Five tools. Ten agents. One project. Full undo.
        </h2>
        <p className="text-[14px] text-ink/70 max-w-[60ch] mb-6">
          Frame-by-frame storyboard, then the live agent fan-out below.
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <DemoFrame
            n="01"
            title="One prompt"
            detail="Dylan in Claude Desktop: «refactor the auth module — split into 5 files, write tests, update docs.»"
          />
          <DemoFrame
            n="02"
            title="Ten agents fan out"
            detail="Tests · Refactor · Docs · Review · Deploy · Migrate · Lint · Bench · Security · E2E — in parallel."
          />
          <DemoFrame
            n="03"
            title="Five tools sync"
            detail="Cursor, VS Code, ChatGPT, Codex — all show the agents' diffs streaming live. Teammate joins."
          />
          <DemoFrame
            n="04"
            title="One undo"
            detail="Big orange button. All ten agents' changes roll back across all five tools — atomic."
          />
        </div>

        <VeronumDemo />
      </div>

      {/* Print version: text-only narrative */}
      <div className="hidden print:block">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-6">
          Demo
        </p>
        <h2
          className="font-serif font-medium leading-[1.05] text-ink mb-6 max-w-[28ch]"
          style={{ fontSize: "var(--display-l)" }}
        >
          Five tools. Ten agents. One project. Full undo.
        </h2>
        <ul className="space-y-3 mb-10 max-w-[64ch]">
          <DemoStep
            n="1"
            title="One prompt"
            detail="Dylan in Claude Desktop: «refactor auth — split into 5 files, write tests, update docs.»"
          />
          <DemoStep
            n="2"
            title="Ten agents fan out"
            detail="Tests / Refactor / Docs / Review / Deploy / Migrate / Lint / Bench / Security / E2E — in parallel."
          />
          <DemoStep
            n="3"
            title="Five tools sync live"
            detail="Cursor · VS Code · ChatGPT · Codex see the agents' diffs streaming. Sarah joins from Cursor."
          />
          <DemoStep
            n="4"
            title="One undo, all tools roll back"
            detail="Atomic universal undo across every tool — no other product can do this."
          />
        </ul>
        <div className="p-5 bg-clay/8 border-l-4 border-clay rounded-r-lg max-w-[64ch]">
          <p className="font-serif text-[18px] leading-snug text-ink">
            <span className="text-ink-faded text-[13px] font-mono uppercase tracking-[0.14em] block mb-1">
              See it live
            </span>
            <span className="font-medium">thetoolswebsite.com/deck</span>{" "}
            — animated demo, scripted, loops every 18 seconds.
          </p>
        </div>
      </div>
    </Slide>
  );
}

function DemoFrame({
  n,
  title,
  detail,
}: {
  n: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="bg-oat/40 border border-ink/10 rounded-lg p-3.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-clay mb-1.5">
        {n}
      </div>
      <div className="font-serif text-[15px] font-medium text-ink mb-1 leading-snug">
        {title}
      </div>
      <div className="text-[12px] text-ink/70 leading-snug">{detail}</div>
    </div>
  );
}

function DemoStep({
  n,
  title,
  detail,
}: {
  n: string;
  title: string;
  detail: string;
}) {
  return (
    <li className="flex items-baseline gap-4 py-2 border-b border-ink/10 first:border-t">
      <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-clay w-6 flex-shrink-0">
        {n}
      </span>
      <div className="flex-1">
        <span className="font-serif text-[17px] text-ink font-medium mr-3">
          {title}
        </span>
        <span className="text-[13.5px] text-ink/70">{detail}</span>
      </div>
    </li>
  );
}

/* ───────────── SLIDE 6: WHY NOW ───────────── */
export function S06WhyNow() {
  const reasons = [
    {
      n: "01",
      title: "Models are commodities.",
      body: "Claude 4.6 / GPT-5 / Gemini 3 are interchangeable. Value migrated to what surrounds the model — undo, multi-agent, cross-tool memory — and that's a workspace problem, not a model problem.",
    },
    {
      n: "02",
      title: "Cross-tool is a brand-new category.",
      body: "Rewind → Meta (Dec 2025) proved cross-tool AI is investable. We're the next-gen of that thesis, focused on dev work — where the willingness-to-pay is highest and the lock-in is strongest.",
    },
    {
      n: "03",
      title: "The lane is open for 18 months.",
      body: "Anthropic optimizes for API + safety. Cursor goes vertical on code. Granola does meetings. Nobody is building the cross-tool dev workspace. Window won't stay open.",
    },
  ];

  return (
    <Slide n={6}>
      <div>
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-8">
          Why now
        </p>
        <h2
          className="font-serif font-medium leading-[1.1] text-ink mb-12 max-w-[24ch]"
          style={{ fontSize: "var(--display-l)" }}
        >
          The window is open.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10">
          {reasons.map((r) => (
            <div key={r.n} className="border-t-2 border-ink pt-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faded mb-3">
                {r.n}
              </div>
              <h3 className="font-serif text-[20px] font-medium leading-tight mb-3 text-ink">
                {r.title}
              </h3>
              <p className="text-[14.5px] text-ink/75 leading-relaxed">
                {r.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 7: VOICE OF CUSTOMER ───────────── */
export function S07Voice() {
  const quotes = [
    {
      name: "Matthias Stephens",
      file: "matthias.jpg",
      quote: "Wow Dylan, this is game-changing.",
      role: "Founder",
    },
    {
      name: "Jesse",
      file: "jesse.jpg",
      quote: "I literally switched from Cursor to this.",
      role: "Software engineer",
    },
    {
      name: "Sparsh Sharma",
      file: "sparsh.jpg",
      quote: "I would willingly pay $50 a month for this. Most certainly.",
      role: "Engineer · USC",
    },
    {
      name: "Fate",
      file: "fate.jpg",
      quote: "It's amazing seeing how this gets better every week.",
      role: "Power user",
    },
  ];

  return (
    <Slide n={7} bg="oat">
      <div>
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-8">
          Voice of customer
        </p>
        <h2
          className="font-serif font-medium leading-[1.1] text-ink mb-12 max-w-[28ch]"
          style={{ fontSize: "var(--display-l)" }}
        >
          Every paying user found us themselves.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {quotes.map((q) => (
            <div
              key={q.name}
              className="bg-ivory-light rounded-xl p-6 lg:p-8 flex flex-col gap-4"
            >
              <p
                className="font-serif font-normal leading-[1.25] text-ink flex-1"
                style={{ fontSize: "var(--display-s)" }}
              >
                <span className="text-clay text-[1.4em] leading-none mr-1 align-top">
                  "
                </span>
                {q.quote}
              </p>
              <div className="flex items-center gap-3 pt-2 border-t border-ink/10">
                <CustomerPhoto name={q.name} file={q.file} size={48} />
                <div>
                  <div className="font-medium text-[14.5px] text-ink">
                    {q.name}
                  </div>
                  <div className="text-[12.5px] text-ink-faded">{q.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 8: TRACTION ───────────── */
export function S08Traction() {
  // Order matters — we lead on retention + inbound, MRR is the LAST stat
  // so it's contextualized rather than the headline.
  const stats = [
    { v: "85%", l: "Week-4 retention", sub: "Best-in-class for SaaS" },
    { v: "0%", l: "Churn since launch", sub: "Two months in, six paying" },
    { v: "$70K", l: "Unprompted inbound", sub: "From four named angels" },
    { v: "65", l: "Tester pipeline", sub: "$25 paid · money-back · 1:1 Meet" },
    { v: "v0.1.15", l: "Shipped in 6 weeks", sub: "Zero → 15 versions, daily" },
    { v: "$0", l: "CAC to date", sub: "All organic · DMs + word of mouth" },
    { v: "300+", l: "Downloads", sub: "macOS · all organic" },
    { v: "$125", l: "MRR", sub: "Six paying · growing weekly" },
  ];

  return (
    <Slide n={8} bg="ink">
      <div>
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ivory/50 mb-8">
          Traction · 2 months in
        </p>
        <h2
          className="font-serif font-medium leading-[1.05] text-ivory mb-12 max-w-[26ch]"
          style={{ fontSize: "var(--display-l)" }}
        >
          The numbers most founders wish they had.
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8">
          {stats.map((s) => (
            <div key={s.l} className="border-t-2 border-ivory/30 pt-4">
              <div
                className="font-serif font-medium text-ivory leading-none"
                style={{ fontSize: "var(--display-l)" }}
              >
                {s.v}
              </div>
              <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-clay mt-3">
                {s.l}
              </div>
              <div className="text-[12.5px] text-ivory/70 mt-2 leading-snug">
                {s.sub}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-12 text-[14px] text-ivory/60 max-w-[68ch]">
          Acquisition entirely from inbound — DMs, friends-of-friends, no
          paid marketing. Conversion to paid happens within 24 hours of
          download. Most testers convert before their second login.
        </p>
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 9: BUSINESS MODEL ───────────── */
export function S09Model() {
  return (
    <Slide n={9}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
        <div className="lg:col-span-5">
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-8">
            Business model
          </p>
          <h2
            className="font-serif font-medium leading-[1.05] text-ink"
            style={{ fontSize: "var(--display-l)" }}
          >
            Free for solo. $25/mo when you connect.
          </h2>
          <p
            className="mt-6 text-ink/80 leading-relaxed"
            style={{ fontSize: "var(--paragraph-m)" }}
          >
            Free tier is sticky on its own — full overlay, single agent,
            local memory. Paywall fires at the moment of demand: when you
            try to share with a teammate, or run a second agent in
            parallel.
          </p>
          <ul className="mt-8 space-y-2 text-[14px] text-ink/75">
            <li className="flex items-baseline gap-2">
              <span className="text-clay">→</span> 85% gross margin
            </li>
            <li className="flex items-baseline gap-2">
              <span className="text-clay">→</span> $0 CAC (all inbound)
            </li>
            <li className="flex items-baseline gap-2">
              <span className="text-clay">→</span> 24-hour install-to-paid conversion
            </li>
            <li className="flex items-baseline gap-2">
              <span className="text-clay">→</span> 14-day Pro trial · no credit card
            </li>
          </ul>
        </div>

        <div className="lg:col-span-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faded mb-4">
            Expansion path
          </p>
          <ul className="space-y-4">
            <ExpansionRow
              now
              label="Free"
              price="$0"
              detail="Solo overlay · single agent · local-only history. Sticky on its own."
            />
            <ExpansionRow
              now
              label="Pro"
              price="$25 / mo"
              detail="Today. Connect with others (up to 5 guests free) · multi-agent (up to 10) · cross-tool memory."
            />
            <ExpansionRow
              label="Team"
              price="$25 / seat"
              detail="Q3 2026. Auto-triggers when 3+ paying hosts share a domain. Pooled rooms, central billing."
            />
            <ExpansionRow
              label="Enterprise"
              price="negotiated"
              detail="Q4 2026. SSO · audit logs · BYO Claude API · on-prem MCP · SOC 2."
            />
          </ul>
        </div>
      </div>
    </Slide>
  );
}

function ExpansionRow({
  now,
  label,
  price,
  detail,
}: {
  now?: boolean;
  label: string;
  price: string;
  detail: string;
}) {
  return (
    <li className="flex items-baseline gap-4 py-4 border-b border-ink/10 first:border-t">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faded w-12 flex-shrink-0">
        {now ? "Now" : "Next"}
      </span>
      <span className="font-serif text-[20px] text-ink w-24 flex-shrink-0">
        {label}
      </span>
      <span className="font-mono text-[14px] text-clay w-32 flex-shrink-0">
        {price}
      </span>
      <span className="text-[13.5px] text-ink/75 flex-1">{detail}</span>
    </li>
  );
}

/* ───────────── SLIDE 10: VISION ───────────── */
export function S10Vision() {
  const tools = [
    { name: "Claude", status: "shipped" },
    { name: "Cursor", status: "shipped" },
    { name: "VS Code", status: "shipped" },
    { name: "ChatGPT", status: "shipped" },
    { name: "Codex", status: "shipped" },
    { name: "Whatever ships next", status: "future" },
  ];

  const horizons = [
    {
      year: "Today",
      title: "Veronum on every AI tool",
      detail:
        "Five tools shipped. Ten-agent orchestration live. Universal undo. $125 MRR · 6 paying users · 85% retention.",
    },
    {
      year: "12 mo",
      title: "The collab layer for AI dev work",
      detail:
        "Teams plan with cross-tool memory and pooled rooms. 5,000 paying seats. $1M+ ARR. Position for seed.",
    },
    {
      year: "Beyond",
      title: "The OS for AI work",
      detail:
        "Cross-tool memory · agent marketplace · one identity · one bill — the workspace where AI work lives.",
    },
  ];

  return (
    <Slide n={10}>
      <div>
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-8">
          Vision
        </p>
        <h2
          className="font-serif font-medium leading-[1.05] text-ink mb-6 max-w-[26ch]"
          style={{ fontSize: "var(--display-l)" }}
        >
          We are the layer above the API wars.
        </h2>
        <p
          className="text-ink/80 leading-relaxed max-w-[60ch] mb-10"
          style={{ fontSize: "var(--paragraph-m)" }}
        >
          Every AI tool fights for the model layer. None of them fight for
          the team layer above them — because winning it requires being
          neutral. We're already neutral. We&apos;re already shipped on
          five tools.
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-12">
          {tools.map((t, i) => (
            <span key={t.name} className="flex items-center gap-2">
              <span
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium ${
                  t.status === "shipped"
                    ? "bg-ink text-ivory"
                    : "bg-transparent border border-ink/20 text-ink-faded"
                }`}
              >
                {t.name}
                {t.status === "shipped" && (
                  <span className="ml-2 text-[10.5px] text-ivory/60 uppercase tracking-[0.10em]">
                    ✓
                  </span>
                )}
              </span>
              {i < tools.length - 1 && (
                <span className="text-ink-faded">·</span>
              )}
            </span>
          ))}
        </div>

        <ul className="space-y-3 border-t border-ink/10 pt-6">
          {horizons.map((h) => (
            <li
              key={h.year}
              className="flex items-baseline gap-6 py-3 border-b border-ink/10 last:border-b-0"
            >
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-clay w-20 flex-shrink-0">
                {h.year}
              </span>
              <span className="font-serif text-[18px] text-ink w-72 flex-shrink-0 font-medium">
                {h.title}
              </span>
              <span className="text-[13.5px] text-ink/70 flex-1 leading-snug">
                {h.detail}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 11: MARKET ───────────── */
export function S11Market() {
  return (
    <Slide n={11}>
      <div>
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-8">
          Market
        </p>
        <h2
          className="font-serif font-medium leading-[1.05] text-ink mb-12 max-w-[30ch]"
          style={{ fontSize: "var(--display-l)" }}
        >
          A real audience that already pays — multiple times.
        </h2>

        <div className="space-y-4">
          <TamRow
            label="TAM"
            v="40M+"
            sub="Paid users across Claude / ChatGPT / Cursor / Copilot — combined"
            width="100%"
          />
          <TamRow
            label="SAM"
            v="4M"
            sub="Mac dev power users on 2+ AI tools (Claude + Cursor / ChatGPT)"
            width="40%"
          />
          <TamRow
            label="SOM"
            v="40K"
            sub="1% capture in year 2 = $12M ARR at $25/mo · 5K teams at $25/seat"
            width="20%"
          />
        </div>

        <p className="mt-12 text-[13px] text-ink-faded max-w-[64ch] leading-relaxed">
          Sources: Anthropic disclosed 100M+ Claude users in 2025;
          OpenAI 200M+ paid; Cursor reported 1M+ paid by mid-2025; GitHub
          Copilot 30M+ subscribers. Veronum sells to the overlap — devs
          who already pay for two or more.
        </p>
      </div>
    </Slide>
  );
}

function TamRow({
  label,
  v,
  sub,
  width,
}: {
  label: string;
  v: string;
  sub: string;
  width: string;
}) {
  return (
    <div className="flex items-baseline gap-6">
      <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded w-14 flex-shrink-0">
        {label}
      </span>
      <div className="flex-1">
        <div className="flex items-baseline gap-4 mb-1">
          <span
            className="font-serif font-medium text-ink leading-none"
            style={{ fontSize: "var(--display-m)" }}
          >
            {v}
          </span>
          <span className="text-[13.5px] text-ink/70">{sub}</span>
        </div>
        <div className="h-2 bg-ink/5 rounded-full overflow-hidden">
          <div className="h-full bg-clay rounded-full" style={{ width }} />
        </div>
      </div>
    </div>
  );
}

/* ───────────── SLIDE 12: COMPETITION ───────────── */
export function S12Competition() {
  const features = [
    "Cross-tool workspace",
    "Real-time team collab",
    "10-agent parallel orchestration",
    "Universal undo / redo",
    "Sits on top of (not replacing) tools",
  ];

  // ✓ = full, ~ = partial, "" = missing. Order matches features above.
  const competitors = [
    {
      name: "claude.ai",
      shape: "Single tool · single user",
      marks: ["", "", "", "~", ""],
    },
    {
      name: "Cursor",
      shape: "Code-only IDE · solo",
      marks: ["", "", "~", "✓", ""],
    },
    {
      name: "GitHub Copilot",
      shape: "Inline suggestions",
      marks: ["", "", "", "", "~"],
    },
    {
      name: "Rewind (acquired Meta)",
      shape: "Cross-tool memory · exited",
      marks: ["~", "", "", "", "✓"],
    },
    {
      name: "Granola",
      shape: "Meeting-only",
      marks: ["", "", "", "", ""],
    },
    {
      name: "Veronum",
      shape: "Cross-tool dev workspace",
      marks: ["✓", "✓", "✓", "✓", "✓"],
      us: true,
    },
  ];

  return (
    <Slide n={12} bg="oat">
      <div>
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-8">
          Competition
        </p>
        <h2
          className="font-serif font-medium leading-[1.05] text-ink mb-10 max-w-[34ch]"
          style={{ fontSize: "var(--display-l)" }}
        >
          We are the only product with all five.
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="text-left pb-3 pr-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faded font-normal w-[22ch]"></th>
                {features.map((f) => (
                  <th
                    key={f}
                    className="text-left pb-3 pr-3 align-bottom font-mono text-[10.5px] uppercase tracking-[0.10em] text-ink-faded font-normal"
                  >
                    {f}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {competitors.map((c) => (
                <tr
                  key={c.name}
                  className={`border-t border-ink/15 ${
                    c.us ? "bg-clay/10" : ""
                  }`}
                >
                  <td className="py-3 pr-4 align-top">
                    <div
                      className={`font-serif text-[16px] leading-tight ${
                        c.us ? "text-ink font-medium" : "text-ink"
                      }`}
                    >
                      {c.name}
                    </div>
                    <div className="text-[11.5px] text-ink/65 mt-0.5">
                      {c.shape}
                    </div>
                  </td>
                  {c.marks.map((m, i) => (
                    <td
                      key={i}
                      className={`py-3 pr-3 align-top font-serif text-[18px] ${
                        m === "✓"
                          ? c.us
                            ? "text-clay"
                            : "text-ink"
                          : m === "~"
                          ? "text-ink/40"
                          : "text-ink/15"
                      }`}
                    >
                      {m || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-8 text-[12.5px] text-ink-faded max-w-[64ch] leading-relaxed">
          Anthropic won&apos;t build cross-tool — lock-in incentive. Cursor
          won&apos;t — code-only. Rewind exited — they&apos;re Meta now. The
          neutral cross-tool dev workspace is empty. We&apos;re it.
        </p>
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 13: TEAM ───────────── */
export function S13Team() {
  const angels = [
    { name: "Travis L.", role: "Angel · already in" },
    { name: "Mahmood M.", role: "Angel · already in" },
    { name: "David S.", role: "Angel · already in" },
    { name: "Christian L.", role: "Angel · already in" },
  ];

  return (
    <Slide n={13}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
        <div className="lg:col-span-5">
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-8">
            Founder
          </p>
          <div className="bg-oat rounded-xl p-1 inline-block mb-6">
            <CustomerPhoto name="Dylan Wain" file="dylan.jpg" size={172} />
          </div>
          <h3
            className="font-serif font-medium text-ink leading-tight"
            style={{ fontSize: "var(--display-m)" }}
          >
            Dylan Wain
          </h3>
          <p className="text-[14px] text-ink-faded mt-1">
            Founder · 2× shipper · already-funded once
          </p>
        </div>

        <div className="lg:col-span-7 lg:pt-8">
          <h2
            className="font-serif font-medium text-ink leading-[1.1] mb-8 max-w-[36ch]"
            style={{ fontSize: "var(--display-m)" }}
          >
            Already shipped, already raised, already loved.
          </h2>
          <ul className="space-y-4 mb-10">
            <TeamRow
              year="Prior"
              title="DibbyTour"
              detail="Built from zero. 145+ paying customers. Closed UCLA + USC as B2B partners. Hired ex-Uber & retired Airbnb operators. Raised an angel round and shipped."
            />
            <TeamRow
              year="Prior"
              title="TV production project management"
              detail="Managed multi-million-dollar productions on deadline. The skill of turning chaos into a delivered asset transfers cleanly to multi-agent dev work."
            />
            <TeamRow
              year="Now"
              title="Veronum"
              detail="Idea to paying customers in 60 days. v0.1.0 → v0.1.15 in 6 weeks. 65 testers paying $25 with money-back + 1:1 Google Meet feedback. $0 marketing spend. Engineering, design, customer dev — end to end."
            />
          </ul>

          <div className="border-t-2 border-ink pt-6">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-faded mb-4">
              Angels already in
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {angels.map((a) => (
                <div
                  key={a.name}
                  className="flex items-center gap-2.5 p-2.5 bg-clay/8 rounded-lg"
                >
                  <div
                    className="w-9 h-9 rounded-full bg-clay/30 flex items-center justify-center font-serif text-[15px] font-medium text-clay flex-shrink-0"
                    aria-hidden
                  >
                    {a.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((s) => s[0])
                      .join("")}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium text-ink truncate">
                      {a.name}
                    </div>
                    <div className="text-[10.5px] text-ink-faded truncate">
                      {a.role}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Slide>
  );
}

function TeamRow({
  year,
  title,
  detail,
}: {
  year: string;
  title: string;
  detail: string;
}) {
  return (
    <li className="flex items-baseline gap-6 py-4 border-b border-ink/10 first:border-t">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faded w-16 flex-shrink-0">
        {year}
      </span>
      <div className="flex-1">
        <div className="font-serif text-[19px] font-medium text-ink mb-1">
          {title}
        </div>
        <p className="text-[14px] text-ink/75 leading-relaxed max-w-[60ch]">
          {detail}
        </p>
      </div>
    </li>
  );
}

/* ───────────── SLIDE 14: USE OF FUNDS ───────────── */
export function S14Funds() {
  return (
    <Slide n={14} bg="ink">
      <div>
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ivory/50 mb-8">
          Use of funds
        </p>
        <h2
          className="font-serif font-medium leading-[1.05] text-ivory mb-12 max-w-[28ch]"
          style={{ fontSize: "var(--display-l)" }}
        >
          $200K → 12 months → seed-ready.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-12">
          <FundsRow
            pct={60}
            label="Engineering"
            detail="Multi-agent v2 (parallel) · Teams plan · cross-tool reach polish · undo/redo across tools"
          />
          <FundsRow
            pct={20}
            label="Growth"
            detail="HN/Twitter launch · 1 GTM hire · paid acquisition test · conference circuit"
          />
          <FundsRow
            pct={20}
            label="Runway buffer"
            detail="Anthropic API at scale · infra · accounting · 12-month conservative buffer"
          />
        </div>

        <div className="pt-8 border-t border-ivory/10">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ivory/50 mb-4">
            12-month milestones
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Milestone label="$10K MRR" sub="10× from today" />
            <Milestone label="5,000 free users" sub="Top of funnel" />
            <Milestone label="100 paying teams" sub="~400 paid seats" />
            <Milestone label="Seed round" sub="$2-4M at $20-30M" />
          </div>
        </div>
      </div>
    </Slide>
  );
}

function FundsRow({
  pct,
  label,
  detail,
}: {
  pct: number;
  label: string;
  detail: string;
}) {
  const colSpan =
    pct >= 50 ? "md:col-span-7" : pct >= 30 ? "md:col-span-3" : "md:col-span-2";
  return (
    <div className={`bg-ivory/[0.04] rounded-lg p-5 ${colSpan}`}>
      <div className="flex items-baseline gap-3 mb-2">
        <span
          className="font-serif font-medium text-ivory leading-none"
          style={{ fontSize: "var(--display-m)" }}
        >
          {pct}%
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-clay">
          {label}
        </span>
      </div>
      <p className="text-[13px] text-ivory/70 leading-relaxed">{detail}</p>
    </div>
  );
}

function Milestone({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="border-t-2 border-clay pt-3">
      <div className="font-serif text-[18px] font-medium text-ivory leading-tight">
        {label}
      </div>
      {sub && (
        <div className="text-[11.5px] text-ivory/60 mt-1 v-mono">{sub}</div>
      )}
    </div>
  );
}

/* ───────────── SLIDE 15: THE ASK ───────────── */
export function S15Ask() {
  const angels = ["Travis L.", "Mahmood M.", "David S.", "Christian L."];

  return (
    <Slide n={15}>
      <div className="max-w-[64ch]">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-8">
          The ask
        </p>
        <h2
          className="font-serif font-medium leading-[0.95] text-ink mb-2"
          style={{ fontSize: "var(--display-xxl)" }}
        >
          $200K
        </h2>
        <p
          className="font-serif italic font-light text-ink/70 mb-10"
          style={{ fontSize: "var(--display-m)" }}
        >
          at $5M post-money.
        </p>

        <div className="bg-clay/10 border-l-4 border-clay rounded-r-lg p-5 mb-10">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-faded mb-2">
            Round filling
          </p>
          <p className="font-serif text-[20px] text-ink leading-snug">
            Already in:{" "}
            <span className="font-medium">{angels.join(" · ")}</span>
          </p>
          <p className="font-mono text-[12.5px] text-ink/70 mt-2">
            Closing rolling — first-mover advantage on remaining allocation.
          </p>
        </div>

        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faded mb-4">
          What this gets you
        </p>
        <ul className="space-y-2 mb-10">
          <AskBullet label="Equity in the cross-tool workspace category" />
          <AskBullet label="Founder who's shipped + raised before (DibbyTour)" />
          <AskBullet label="Product loved by the first 6 paying users (0% churn)" />
          <AskBullet label="Position alongside Travis, Mahmood, David, Christian" />
          <AskBullet label="12-month runway to seed at 10×+ markup" />
        </ul>

        <div className="pt-8 border-t border-ink/10 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span className="font-serif text-[26px] text-ink">Dylan Wain</span>
          <a
            href="mailto:dylanwain@me.com"
            className="text-[15px] text-clay underline underline-offset-4"
          >
            dylanwain@me.com
          </a>
          <a
            href="https://www.thetoolswebsite.com"
            className="text-[15px] text-clay underline underline-offset-4"
          >
            thetoolswebsite.com
          </a>
        </div>
      </div>
    </Slide>
  );
}

function AskBullet({ label }: { label: string }) {
  return (
    <li className="flex items-baseline gap-3 text-[16.5px] text-ink leading-relaxed">
      <span className="text-clay">→</span>
      <span>{label}</span>
    </li>
  );
}

/* ───────────── shared: customer photo ───────────── */
function CustomerPhoto({
  name,
  file,
  size = 56,
  shape = "circle",
  objectPosition = "center",
}: {
  name: string;
  file: string;
  size?: number;
  shape?: "circle" | "square";
  objectPosition?: string;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  const radius = shape === "square" ? "rounded-2xl" : "rounded-full";

  return (
    <div
      className={`relative ${radius} overflow-hidden bg-clay/20 flex-shrink-0`}
      style={{ width: size, height: size }}
    >
      <span
        className="absolute inset-0 flex items-center justify-center font-serif font-medium text-clay"
        style={{ fontSize: size / 2.5 }}
      >
        {initials}
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/customers/${file}`}
        alt={name}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition }}
        loading="lazy"
      />
    </div>
  );
}

import { Slide } from "./Slide";
import { VeronumMark } from "../VeronumMark";
import { VeronumDemo } from "../VeronumDemo";

/**
 * 15-slide pitch deck for Veronum. Pre-seed, $200K at $5M post.
 * Each slide is a Server Component except slide 5 which embeds
 * the live demo (client). Same source renders the live web deck
 * AND the print/PDF version.
 */

/* ───────────── SLIDE 1: COVER ───────────── */
export function S01Cover() {
  return (
    <Slide n={1}>
      <div className="flex flex-col items-start gap-12 lg:gap-16 max-w-[80ch]">
        <VeronumMark className="h-20 w-20 lg:h-24 lg:w-24 rounded-2xl" />
        <h1
          className="font-serif font-medium leading-[0.95] text-ink"
          style={{ fontSize: "var(--display-xxl)" }}
        >
          Veronum.
        </h1>
        <p
          className="font-serif italic font-light text-ink/80 leading-[1.2] max-w-[24ch]"
          style={{ fontSize: "var(--display-m)" }}
        >
          Your favorite product. Your account. Better output.
        </p>
        <p className="text-[14px] text-ink-faded font-mono uppercase tracking-[0.12em] mt-auto">
          Pre-seed · $200K at $5M post · April 2026
        </p>
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 2: THE BET ───────────── */
export function S02Bet() {
  return (
    <Slide n={2}>
      <div className="max-w-[42ch]">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-8">
          Our bet
        </p>
        <h2
          className="font-serif font-medium leading-[1.1] text-ink"
          style={{ fontSize: "var(--display-l)" }}
        >
          Foundation model AI is becoming a{" "}
          <span className="italic font-light">commodity</span>.
        </h2>
        <p
          className="mt-8 text-ink/80 leading-relaxed max-w-[55ch]"
          style={{ fontSize: "var(--paragraph-m)" }}
        >
          The workspace layer above it — version history, multi-agent
          orchestration, native data integrations — is where users stay,
          where switch costs build, and where willingness-to-pay is.
        </p>
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 3: PROBLEM ───────────── */
export function S03Problem() {
  return (
    <Slide n={3} bg="oat">
      <div className="max-w-[60ch]">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-8">
          The problem, in our customer's words
        </p>
        <blockquote
          className="font-serif font-normal leading-[1.2] text-ink"
          style={{ fontSize: "var(--display-l)" }}
        >
          <span className="text-clay text-[1.4em] leading-none mr-2 align-top">
            "
          </span>
          This is so useful — I want to show this to my dad, he'll love
          this.
        </blockquote>
        <div className="mt-10 flex items-center gap-4">
          <CustomerPhoto name="Divleen Kaur Chugh" file="divleen.jpg" />
          <div>
            <div className="font-medium text-ink text-[16px]">
              Divleen Kaur Chugh
            </div>
            <div className="text-[14px] text-ink-faded">
              Veronum customer · paid since week 1
            </div>
          </div>
        </div>
        <p className="mt-12 text-[14px] text-ink-faded max-w-[50ch]">
          Real usefulness travels by word of mouth. Divleen has been paying
          since week one.
        </p>
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 4: SOLUTION ───────────── */
export function S04Solution() {
  const features = [
    "Multi-agent composer (1–10 parallel)",
    "Version history with one-click revert",
    "Live meeting transcripts via Whisper",
    "Stripe / Supabase / Slack connectors",
    "Every Claude feature you already pay for",
    "Local-first — your data stays on your Mac",
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
            Claude with everything you wish it had.
          </h2>
          <p
            className="mt-6 text-ink/80 leading-relaxed"
            style={{ fontSize: "var(--paragraph-m)" }}
          >
            One Mac app. Seven days free. $25/month.
          </p>
        </div>

        <div className="lg:col-span-7">
          <ul className="space-y-1">
            {features.map((f) => (
              <li
                key={f}
                className="flex items-baseline gap-3 py-4 border-b border-ink/10 first:border-t"
              >
                <span className="text-clay text-[18px] font-bold leading-none">
                  ✓
                </span>
                <span className="text-[16px] text-ink">{f}</span>
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
      {/* Screen version: animated demo */}
      <div className="-my-8 lg:-my-16 print:hidden">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-2">
          Live, in this slide
        </p>
        <h2
          className="font-serif font-medium leading-[1.1] text-ink mb-6"
          style={{ fontSize: "var(--display-m)" }}
        >
          The actual product, running.
        </h2>
        <VeronumDemo />
      </div>

      {/* Print version: static description with live link */}
      <div className="hidden print:block">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-6">
          Demo
        </p>
        <h2
          className="font-serif font-medium leading-[1.05] text-ink mb-6 max-w-[26ch]"
          style={{ fontSize: "var(--display-l)" }}
        >
          One prompt. Ten agents in parallel.
        </h2>
        <p
          className="text-ink/80 leading-relaxed max-w-[60ch] mb-10"
          style={{ fontSize: "var(--paragraph-m)" }}
        >
          The actual Veronum desktop UI — claude.ai chat shell with our
          dwc-* injections. Click the @agents pill, dispatch a master task
          to a parallel fleet of 1–10 agents, watch them complete in
          parallel, ship.
        </p>
        <ul className="space-y-3 mb-10 max-w-[60ch]">
          <DemoStep
            n="1"
            title="Click @agents pill"
            detail="Bottom of composer · opens a popover above"
          />
          <DemoStep
            n="2"
            title="Master task + 1–10 agent rows"
            detail="One headline goal, up to 10 parallel sub-tasks"
          />
          <DemoStep
            n="3"
            title="Send → fan-out"
            detail="Dispatched as @dwc-agent-1..N — Claude orchestrates in parallel"
          />
          <DemoStep
            n="4"
            title="Synthesis"
            detail="One assistant message summarizing all agents' work, with PR / diffs"
          />
        </ul>
        <div className="p-5 bg-clay/8 border-l-4 border-clay rounded-r-lg max-w-[60ch]">
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
      title: "Foundation models are good enough.",
      body: "Claude 4.6 isn't the bottleneck anymore. The value migrates to what surrounds the model — undo, multi-agent, meetings, data — and that's a workspace problem, not a model problem.",
    },
    {
      n: "02",
      title: "Power users are already paying us.",
      body: "$125 MRR in two months, every customer inbound, zero paid marketing. They aren't waiting for Anthropic to ship desktop integrations — they're voting with their cards.",
    },
    {
      n: "03",
      title: "The lane is empty for 18 months.",
      body: "Cursor went vertical on code. Granola on meetings. Raycast on launchers. Anthropic optimizes for API + safety, not desktop UX. Nobody is bundling the workspace on top of Claude — yet.",
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

/* ───────────── SLIDE 7: CUSTOMER VOICE ───────────── */
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
          The first 6 users found us themselves.
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
  const stats = [
    { v: "$1,500", l: "ARR pace", sub: "$125 MRR · launched 2 mo ago" },
    { v: "300+", l: "Downloads", sub: "macOS · all organic" },
    { v: "6", l: "Paying customers", sub: "0% churn so far" },
    { v: "5", l: "Unsolicited testimonials", sub: "From the 6 paying users" },
  ];

  return (
    <Slide n={8} bg="ink">
      <div>
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ivory/50 mb-8">
          Traction · 2 months in
        </p>
        <h2
          className="font-serif font-medium leading-[1.1] text-ivory mb-12 max-w-[24ch]"
          style={{ fontSize: "var(--display-l)" }}
        >
          Small numbers, sharp signal.
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-10">
          {stats.map((s) => (
            <div key={s.l} className="border-t-2 border-ivory/30 pt-4">
              <div
                className="font-serif font-medium text-ivory leading-none"
                style={{ fontSize: "var(--display-xl)" }}
              >
                {s.v}
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-clay mt-3">
                {s.l}
              </div>
              <div className="text-[13px] text-ivory/70 mt-2 leading-snug">
                {s.sub}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-12 text-[14px] text-ivory/60 max-w-[55ch]">
          Acquisition entirely from inbound — DMs, friends-of-friends, no paid
          marketing yet. Conversion to paid happens within 24 hours of
          download.
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
            $25 / month flat.
          </h2>
          <p
            className="mt-6 text-ink/80 leading-relaxed"
            style={{ fontSize: "var(--paragraph-m)" }}
          >
            Stripe-billed. 7-day trial. ~85% gross margin after Anthropic
            API + Stripe fees.
          </p>
        </div>

        <div className="lg:col-span-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faded mb-4">
            Expansion path
          </p>
          <ul className="space-y-4">
            <ExpansionRow
              now
              label="Solo"
              price="$25 / mo"
              detail="Today. Mac desktop + soon-to-launch web app."
            />
            <ExpansionRow
              label="Teams"
              price="$75 / seat"
              detail="Q3 2026. Shared agents, shared connectors, billing on one card."
            />
            <ExpansionRow
              label="Enterprise"
              price="negotiated"
              detail="Q4 2026. SSO, audit logs, BYO Claude API key, on-prem MCP."
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
      <span className="font-serif text-[20px] text-ink w-32 flex-shrink-0">
        {label}
      </span>
      <span className="font-mono text-[14px] text-clay w-32 flex-shrink-0">
        {price}
      </span>
      <span className="text-[14px] text-ink/75 flex-1">{detail}</span>
    </li>
  );
}

/* ───────────── SLIDE 10: VISION ───────────── */
export function S10Vision() {
  const tools = [
    { name: "Claude", status: "shipped" },
    { name: "Codex", status: "next" },
    { name: "Cursor", status: "next" },
    { name: "VS Code", status: "next" },
    { name: "Whatever ships", status: "future" },
  ];

  const horizons = [
    {
      year: "Today",
      title: "Veronum on Claude",
      detail: "$25/mo · 6 paying users · $125 MRR growing weekly",
    },
    {
      year: "Next",
      title: "Veronum on every model",
      detail: "Codex, Cursor, VS Code, Gemini — same workspace, every tool. We become the layer above the API wars.",
    },
    {
      year: "Beyond",
      title: "The OS for AI work",
      detail: "Cross-tool memory · agent marketplace · one identity · one bill — the workspace where AI work lives.",
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
          Claude is the start. The workspace is the prize.
        </h2>
        <p
          className="text-ink/80 leading-relaxed max-w-[58ch] mb-10"
          style={{ fontSize: "var(--paragraph-m)" }}
        >
          Today we're the better Claude. Next we're the layer above every
          AI tool you use — one identity, one agent runtime, one bill,
          cross-tool memory. Eventually we're the platform every AI agent
          ships into.
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-12">
          {tools.map((t, i) => (
            <span
              key={t.name}
              className="flex items-center gap-3"
            >
              <span
                className={`px-4 py-2 rounded-full text-[14px] font-medium ${
                  t.status === "shipped"
                    ? "bg-ink text-ivory"
                    : t.status === "next"
                    ? "bg-oat text-ink"
                    : "bg-transparent border border-ink/20 text-ink-faded"
                }`}
              >
                {t.name}
                {t.status === "shipped" && (
                  <span className="ml-2 text-[11px] text-ivory/60">
                    Shipped
                  </span>
                )}
              </span>
              {i < tools.length - 1 && (
                <span className="text-ink-faded">→</span>
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
              <span className="font-serif text-[18px] text-ink w-64 flex-shrink-0 font-medium">
                {h.title}
              </span>
              <span className="text-[14px] text-ink/70 flex-1 leading-snug">
                {h.detail}
              </span>
            </li>
          ))}
        </ul>

        <p
          className="mt-10 font-serif italic font-light text-ink/60 max-w-[34ch]"
          style={{ fontSize: "var(--display-s)" }}
        >
          Your favorite product. Your account. Better output.
        </p>
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
          className="font-serif font-medium leading-[1.05] text-ink mb-12 max-w-[28ch]"
          style={{ fontSize: "var(--display-l)" }}
        >
          A real audience that already pays.
        </h2>

        <div className="space-y-4">
          <TamRow
            label="TAM"
            v="8M+"
            sub="Paid Claude users globally · $20–200/mo"
            width="100%"
          />
          <TamRow
            label="SAM"
            v="2M"
            sub="Mac power users · engineers / founders / vibe coders"
            width="60%"
          />
          <TamRow
            label="SOM"
            v="20K"
            sub="1% capture in year 1 = $6M ARR at $25/mo"
            width="20%"
          />
        </div>

        <p className="mt-12 text-[13.5px] text-ink-faded max-w-[60ch]">
          Sources: Anthropic disclosed 100M+ Claude users in their 2025
          investor materials; we estimate ~8% are on paid plans. Mac power
          user share extrapolated from Claude Code adoption data.
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
    "Multi-agent composer",
    "Meeting transcripts",
    "Data integrations",
    "Version history / undo",
    "Sits on top of Claude",
  ];

  // ✓ = full, ~ = partial, "" = missing. Order matches features above.
  const competitors = [
    { name: "claude.ai", shape: "The foundation", marks: ["", "", "~", "", "✓"] },
    { name: "Cursor", shape: "Code-only IDE", marks: ["~", "", "", "✓", ""] },
    { name: "Raycast", shape: "Utility launcher", marks: ["", "", "~", "", ""] },
    { name: "Granola", shape: "Meeting-only", marks: ["", "✓", "", "", ""] },
    {
      name: "Veronum",
      shape: "Workspace on Claude",
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
          className="font-serif font-medium leading-[1.05] text-ink mb-10 max-w-[30ch]"
          style={{ fontSize: "var(--display-l)" }}
        >
          The only one bundling all four.
        </h2>

        <div className="bg-ivory rounded-xl overflow-hidden">
          <div className="grid grid-cols-[minmax(200px,1.4fr)_repeat(5,minmax(0,1fr))] gap-x-4">
            {/* Header row */}
            <div className="px-5 py-4 text-[12px] font-mono uppercase tracking-[0.14em] text-ink-faded">
              Feature
            </div>
            {competitors.map((c) => (
              <div
                key={c.name}
                className={`px-3 py-4 text-center ${
                  c.us ? "bg-clay/10" : ""
                }`}
              >
                <div
                  className={`font-serif text-[15px] font-medium leading-tight ${
                    c.us ? "text-clay" : "text-ink"
                  }`}
                >
                  {c.name}
                </div>
                <div className="text-[11px] text-ink-faded mt-0.5">
                  {c.shape}
                </div>
              </div>
            ))}

            {/* Feature rows */}
            {features.map((feat, idx) => (
              <FeatureRow
                key={feat}
                feat={feat}
                marks={competitors.map((c) => ({ mark: c.marks[idx], us: !!c.us }))}
                isLast={idx === features.length - 1}
              />
            ))}
          </div>
        </div>

        <div className="mt-8 p-5 lg:p-6 bg-clay/10 border-l-4 border-clay rounded-r-lg">
          <p className="font-serif text-[18px] leading-snug text-ink max-w-[64ch]">
            Workspace + agents + meetings + data —{" "}
            <span className="font-medium">on top of the Claude you already pay for.</span>{" "}
            That row of green checkmarks is the moat.
          </p>
        </div>
      </div>
    </Slide>
  );
}

function FeatureRow({
  feat,
  marks,
  isLast,
}: {
  feat: string;
  marks: { mark: string; us: boolean }[];
  isLast: boolean;
}) {
  return (
    <>
      <div
        className={`px-5 py-3 text-[14px] text-ink/80 ${
          isLast ? "" : "border-t border-ink/10"
        }`}
      >
        {feat}
      </div>
      {marks.map((m, i) => (
        <div
          key={i}
          className={`px-3 py-3 text-center ${
            m.us ? "bg-clay/10" : ""
          } ${isLast ? "" : "border-t border-ink/10"}`}
        >
          {m.mark === "✓" ? (
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[13px] font-bold ${
                m.us
                  ? "bg-clay text-ivory"
                  : "bg-ink/10 text-ink"
              }`}
            >
              ✓
            </span>
          ) : m.mark === "~" ? (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[13px] text-ink/50 bg-ink/5">
              ~
            </span>
          ) : (
            <span className="inline-flex items-center justify-center w-6 h-6 text-[13px] text-ink/20">
              —
            </span>
          )}
        </div>
      ))}
    </>
  );
}

/* ───────────── SLIDE 13: TEAM ───────────── */
export function S13Team() {
  return (
    <Slide n={13}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
        <div className="lg:col-span-4">
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-8">
            Team
          </p>
          <div className="bg-oat rounded-xl p-1 inline-block mb-6">
            <CustomerPhoto name="Dylan Wain" file="dylan.jpg" size={140} />
          </div>
          <h3
            className="font-serif font-medium text-ink leading-tight"
            style={{ fontSize: "var(--display-m)" }}
          >
            Dylan Wain
          </h3>
          <p className="text-[14px] text-ink-faded mt-1">
            Founder · 2× founder
          </p>
        </div>

        <div className="lg:col-span-8 lg:pt-8">
          <h2
            className="font-serif font-medium text-ink leading-[1.15] mb-8 max-w-[36ch]"
            style={{ fontSize: "var(--display-m)" }}
          >
            Built a marketplace from zero to B2B contracts before AI was
            obvious.
          </h2>
          <ul className="space-y-5">
            <TeamRow
              year="Prior"
              title="Dibby Tour"
              detail="Gig-economy on-demand inspections marketplace. Hired ex-Uber city managers + retired Airbnb city managers as operators. Closed UCLA and USC as B2B partners — two universities, two contracts, real revenue."
            />
            <TeamRow
              year="Now"
              title="Veronum"
              detail="Idea to paying customers in two months. Engineering, design, and customer development end-to-end."
            />
          </ul>
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
        <p className="text-[14.5px] text-ink/75 leading-relaxed max-w-[60ch]">
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
          $200K = 12 months of acceleration toward PMF.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12">
          <FundsRow
            pct={90}
            label="Engineering + product"
            detail="Veronum desktop polish · web app at thetoolswebsite.com/app · expand beyond Claude (Codex, Cursor, VS Code)"
          />
          <FundsRow
            pct={10}
            label="Infrastructure"
            detail="Anthropic API at scale · Vercel · DB · observability"
          />
        </div>

        <div className="pt-8 border-t border-ivory/10">
          <p
            className="font-serif italic font-light text-ivory/70 max-w-[60ch]"
            style={{ fontSize: "var(--paragraph-l)" }}
          >
            Every dollar buys product. Marketing comes after PMF.
          </p>
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
  const colSpan = pct >= 50 ? "md:col-span-9" : "md:col-span-3";
  return (
    <div className={`bg-ivory/[0.04] rounded-lg p-6 ${colSpan}`}>
      <div className="flex items-baseline gap-3 mb-3">
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
      <p className="text-[14px] text-ivory/70 leading-relaxed">{detail}</p>
    </div>
  );
}

/* ───────────── SLIDE 15: THE ASK ───────────── */
export function S15Ask() {
  return (
    <Slide n={15}>
      <div className="max-w-[60ch]">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-8">
          The ask
        </p>
        <h2
          className="font-serif font-medium leading-[1.0] text-ink mb-2"
          style={{ fontSize: "var(--display-xxl)" }}
        >
          $200K
        </h2>
        <p
          className="font-serif italic font-light text-ink/70 mb-12"
          style={{ fontSize: "var(--display-m)" }}
        >
          at $5M post-money. $35K already committed.
        </p>

        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faded mb-4">
          12-month milestones
        </p>
        <ul className="space-y-3 mb-12">
          <Milestone label="$50K MRR" />
          <Milestone label="Web app launched at thetoolswebsite.com/app" />
          <Milestone label="2,000+ paid users" />
          <Milestone label="Position for seed round" />
        </ul>

        <div className="pt-8 border-t border-ink/10 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span className="font-serif text-[24px] text-ink">Dylan Wain</span>
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

function Milestone({ label }: { label: string }) {
  return (
    <li className="flex items-baseline gap-3 text-[18px] text-ink">
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
}: {
  name: string;
  file: string;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className="relative rounded-full overflow-hidden bg-clay/20 flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {/* Fallback initials behind */}
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
        loading="lazy"
      />
    </div>
  );
}

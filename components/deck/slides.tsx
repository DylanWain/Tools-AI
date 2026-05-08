import { Slide } from "./Slide";
import { VeronumMark } from "../VeronumMark";
import { VSCodeVeronumDemo } from "../demos/VSCodeVeronumDemo";

/**
 * Veronum pre-seed deck — 10 slides.
 *
 * Story-driven. One claim per slide, two-to-four sentences max. The
 * deck drags the reader into the pain (slide 2), pays it off with
 * the solution + a live demo (3–4), establishes the founder bet
 * (5), points at the bigger prize (6), bounds the market (7),
 * stacks user love + numbers (8), names the ask + investors (9),
 * and closes with contact (10). Live animated demo on web; static
 * fallback in the print/PDF.
 *
 * Order:
 *   1.  Cover
 *   2.  Problem
 *   3.  Solution
 *   4.  Demo
 *   5.  Team
 *   6.  Vision
 *   7.  Market
 *   8.  Traction + feedback (feedback above numbers)
 *   9.  Ask + committed investors
 *   10. Contact
 */

const TOTAL = 10;

const COMMITTED_INVESTORS = [
  "Travis Laderer",
  "Cristian Laderer",
  "David Simpson",
  "Mahmood Midlij",
];

/* ───────────── SLIDE 1: COVER ───────────── */
export function S01Cover() {
  return (
    <Slide n={1} total={TOTAL}>
      <div className="flex flex-col items-center gap-10 lg:gap-12">
        <VeronumMark className="h-20 w-20 lg:h-24 lg:w-24 rounded-2xl" />
        <h1
          className="font-serif font-medium leading-[0.92] text-ink"
          style={{ fontSize: "var(--display-xxl)" }}
        >
          Veronum.
        </h1>
        <p
          className="font-serif italic font-light text-ink/85 leading-[1.15] mx-auto max-w-[28ch]"
          style={{ fontSize: "var(--display-m)" }}
        >
          Code with anyone, on any platform.
        </p>
        <p className="text-[14px] text-ink-faded font-mono uppercase tracking-[0.14em] mt-6">
          Pre-seed · $200K · May 2026
        </p>
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 2: PROBLEM ───────────── */
export function S02Problem() {
  const tools = ["Cursor", "VS Code", "Warp", "Claude", "ChatGPT", "T3"];
  return (
    <Slide n={2} bg="oat" total={TOTAL}>
      <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-10">
        The problem
      </p>

      <h2
        className="font-serif font-medium leading-[0.95] text-ink mx-auto mb-14 max-w-[22ch]"
        style={{ fontSize: "var(--display-xxl)" }}
      >
        Code editors can&apos;t talk to each other.
      </h2>

      {/* Six tool chips, separated by × */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-3 mb-12">
        {tools.map((t, i) => (
          <span key={t} className="flex items-center gap-3">
            <span
              className="px-4 py-1.5 rounded-full bg-ink/[0.06] text-ink font-medium"
              style={{ fontSize: "var(--paragraph-m)" }}
            >
              {t}
            </span>
            {i < tools.length - 1 && (
              <span className="text-clay font-bold text-[18px]">×</span>
            )}
          </span>
        ))}
      </div>

      <p
        className="font-serif italic font-light text-ink/75 leading-[1.3] mx-auto max-w-[34ch]"
        style={{ fontSize: "var(--paragraph-l)" }}
      >
        Six tools. Six conversations. Same project. None of them know what
        the others said.
      </p>
    </Slide>
  );
}

/* ───────────── SLIDE 3: SOLUTION ───────────── */
export function S03Solution() {
  return (
    <Slide n={3} total={TOTAL}>
      <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-10">
        The solution
      </p>

      <h2
        className="font-serif font-medium leading-[0.92] text-ink mx-auto mb-12 max-w-[22ch]"
        style={{ fontSize: "var(--display-xxl)" }}
      >
        Veronum connects every coding tool.
      </h2>

      <p
        className="text-ink/85 leading-[1.5] mx-auto max-w-[58ch]"
        style={{ fontSize: "var(--paragraph-l)" }}
      >
        One app that bridges Cursor, VS Code, Warp, Claude, and Zed. Your
        teammate joins your session live — same chat, same files, same
        edits. No commits, no push, no link.
      </p>
    </Slide>
  );
}

/* ───────────── SLIDE 4: DEMO ───────────── */
export function S04Demo() {
  return (
    <Slide n={4} bg="ivory" className="!py-0" total={TOTAL} wide>
      <div className="-my-8 lg:-my-16 print:hidden">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-2">
          Demo · live in this slide
        </p>
        <h2
          className="font-serif font-medium leading-[1.0] text-ink mb-2 mx-auto max-w-[40ch]"
          style={{ fontSize: "var(--display-m)" }}
        >
          One engineer in VS Code. One in Veronum. Same session.
        </h2>
        <p
          className="text-ink/75 leading-[1.45] mx-auto max-w-[64ch] mb-6"
          style={{ fontSize: "var(--paragraph-s)" }}
        >
          Watch the prompt land in Veronum, Claude rewrite the file, and
          the change appear in VS Code in real time.
        </p>
        <VSCodeVeronumDemo />
      </div>

      <div className="hidden print:block">
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-6">
          Demo
        </p>
        <h2
          className="font-serif font-medium leading-[1.0] text-ink mb-6 mx-auto max-w-[30ch]"
          style={{ fontSize: "var(--display-l)" }}
        >
          One engineer in VS Code. One in Veronum. Same session.
        </h2>
        <p
          className="text-ink/85 leading-[1.5] mx-auto max-w-[62ch] mb-10"
          style={{ fontSize: "var(--paragraph-m)" }}
        >
          Dylan edits session.ts in VS Code. Katya types a prompt in Veronum.
          Claude rewrites the file. The diff appears in both windows live.
          Same Claude session — different editors.
        </p>
        <div className="p-5 bg-clay/8 border-l-4 border-clay rounded-r-lg mx-auto max-w-[60ch]">
          <p className="font-serif text-[18px] leading-snug text-ink">
            <span className="text-ink-faded text-[13px] font-mono uppercase tracking-[0.14em] block mb-1">
              See it live
            </span>
            <span className="font-medium">thetoolswebsite.com/deck</span>{" "}
            — VS Code + Veronum side by side, looping demo.
          </p>
        </div>
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 5: TEAM ───────────── */
export function S05Team() {
  const dibby = [
    { metric: "1,000,000+", label: "Organic social views" },
    { metric: "500+", label: "Paying customers" },
    { metric: "3", label: "B2B partnerships · UCLA · USC · NYU" },
    { metric: "Hilary Duff", label: "Celebrity endorsement" },
  ];

  return (
    <Slide n={5} total={TOTAL}>
      <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-8">
        Team
      </p>

      <div className="flex flex-col items-center gap-3 mb-14">
        <div className="bg-oat rounded-2xl p-1">
          <CustomerPhoto name="Dylan Wain" file="dylan.jpg" size={168} />
        </div>
        <h3
          className="font-serif font-medium text-ink leading-[0.95] mt-3"
          style={{ fontSize: "var(--display-l)" }}
        >
          Dylan Wain
        </h3>
        <p className="text-[15px] text-ink-faded">Founder · 2× founder</p>
        <p
          className="font-serif italic font-light text-ink/75 leading-[1.3] mt-1"
          style={{ fontSize: "var(--paragraph-l)" }}
        >
          Last company:{" "}
          <span className="text-ink font-medium not-italic">Dibby Tour.</span>
        </p>
      </div>

      {/* Big stat cards — 4 in a row, with massive numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mx-auto max-w-[88ch] mb-12">
        {dibby.map((d) => (
          <div
            key={d.label}
            className="bg-oat rounded-2xl p-5 lg:p-7 flex flex-col items-center text-center"
          >
            <div
              className="font-serif font-medium text-ink leading-[1.0] mb-3"
              style={{ fontSize: "var(--display-m)" }}
            >
              {d.metric}
            </div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.10em] text-ink-faded leading-[1.4]">
              {d.label}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-clay/10 border-l-4 border-clay rounded-r-lg p-5 mx-auto max-w-[58ch] text-left">
        <p
          className="font-serif text-ink leading-[1.25]"
          style={{ fontSize: "var(--paragraph-l)" }}
        >
          Same playbook. 9 weeks into Veronum:{" "}
          <span className="font-medium">
            350+ users · $325 May revenue · 0% churn.
          </span>
        </p>
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 6: VISION ───────────── */
export function S06Vision() {
  return (
    <Slide n={6} bg="ink" total={TOTAL}>
      <div>
        <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ivory/55 mb-8">
          Vision
        </p>

        <h2
          className="font-serif font-medium leading-[0.95] text-ivory mb-12 max-w-[26ch]"
          style={{ fontSize: "var(--display-xxl)" }}
        >
          The infrastructure that connects every dev tool.
        </h2>

        <p
          className="text-ivory/80 leading-[1.5] max-w-[64ch]"
          style={{ fontSize: "var(--paragraph-l)" }}
        >
          Veronum integrates fully into every coding platform — Cursor,
          VS Code, Warp, Claude, Zed today; Codex, Gemini, and whatever
          ships next on top of the same plumbing. One workspace,
          everyone&apos;s tools, every conversation in one place.
        </p>
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 7: MARKET ───────────── */
export function S07Market() {
  const peers = [
    { name: "VS Code", v: "30M+ users" },
    { name: "GitHub Copilot", v: "1.3M paid" },
    { name: "Cursor", v: "$100M ARR" },
    { name: "Claude", v: "8M+ paid" },
    { name: "ChatGPT", v: "10M+ Plus" },
    { name: "Warp", v: "Series B" },
    { name: "T3", v: "growing" },
    { name: "Replit / Zed / others", v: "—" },
  ];

  return (
    <Slide n={7} total={TOTAL}>
      <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-10">
        Market
      </p>

      <h2
        className="font-serif font-medium leading-[0.92] text-ink mx-auto mb-3 max-w-[18ch]"
        style={{ fontSize: "var(--display-xxl)" }}
      >
        50M developers. One workspace.
      </h2>

      <p
        className="font-serif italic font-light text-ink/70 mb-12 mx-auto max-w-[44ch]"
        style={{ fontSize: "var(--display-s)" }}
      >
        $5B+ a year flowing into AI dev tools — every one of them an island.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 mx-auto max-w-[68ch] text-left mb-12">
        {peers.map((p, i) => (
          <div
            key={p.name}
            className={`py-3 border-b border-ink/10 ${i < 4 ? "border-t" : ""}`}
          >
            <div className="font-serif font-medium text-ink leading-tight text-[18px]">
              {p.name}
            </div>
            <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faded mt-1">
              {p.v}
            </div>
          </div>
        ))}
      </div>

      <p
        className="text-ink/85 leading-[1.5] mx-auto max-w-[60ch]"
        style={{ fontSize: "var(--paragraph-m)" }}
      >
        Cursor crossed $100M ARR in 18 months. Copilot has 1.3M paid
        subscribers. We don&apos;t need to beat them — we connect them.
        <span className="text-ink font-medium">{" "}1% of 50M at $25/mo = $150M ARR.</span>
      </p>
    </Slide>
  );
}

/* ───────────── SLIDE 8: TRACTION + FEEDBACK ───────────── */
export function S08Traction() {
  const stats = [
    { v: "350+", l: "Users" },
    { v: "$325", l: "May revenue" },
    { v: "0%", l: "Churn" },
    { v: "$0", l: "Marketing spend" },
  ];

  const customers = [
    {
      name: "Divleen Kaur Chugh",
      file: "divleen.jpg",
      quote: "This is so useful — I want to show this to my dad.",
      role: "Customer · paid since week 1",
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
      quote: "I would willingly pay $50 a month. Most certainly.",
      role: "Engineer · USC",
    },
    {
      name: "Matthias Stephens",
      file: "matthias.jpg",
      quote: "Wow Dylan, this is game-changing.",
      role: "Founder",
    },
    {
      name: "Fate",
      file: "fate.jpg",
      quote: "Amazing seeing how this gets better every week.",
      role: "Power user",
    },
  ];

  return (
    <Slide n={8} bg="oat" total={TOTAL}>
      <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-8">
        Traction · feedback
      </p>

      {/* Akash quote — Meta validation. */}
      <div className="bg-ink rounded-2xl p-8 lg:p-10 mb-10 mx-auto max-w-[60ch] text-left">
        <p
          className="font-serif font-normal leading-[1.1] text-ivory"
          style={{ fontSize: "var(--display-m)" }}
        >
          <span className="text-clay text-[1.3em] leading-none mr-2 align-top">
            &ldquo;
          </span>
          Meta has this internally. Nothing exists for the public.
        </p>
        <div className="mt-6 flex items-center gap-3 pt-4 border-t border-ivory/15">
          <CustomerPhoto name="Akash Vishwakarma" file="akash.jpg" size={44} />
          <div>
            <div className="font-medium text-ivory text-[14.5px]">
              Akash Vishwakarma
            </div>
            <div className="text-[12px] text-ivory/65">ex-Meta engineer</div>
          </div>
        </div>
      </div>

      {/* 5 customer quotes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mx-auto max-w-[88ch] mb-10 text-left">
        {customers.map((q) => (
          <div
            key={q.name}
            className="bg-ivory-light rounded-xl p-3.5 flex flex-col gap-2"
          >
            <p
              className="font-serif font-normal leading-[1.25] text-ink flex-1"
              style={{ fontSize: "13.5px" }}
            >
              <span className="text-clay text-[1.2em] leading-none mr-1 align-top">
                &ldquo;
              </span>
              {q.quote}
            </p>
            <div className="flex items-center gap-2 pt-2 border-t border-ink/10">
              <CustomerPhoto name={q.name} file={q.file} size={26} />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-[11.5px] text-ink truncate">
                  {q.name}
                </div>
                <div className="text-[10px] text-ink-faded truncate">
                  {q.role}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Numbers row — 9 weeks emphasis */}
      <div className="mx-auto max-w-[80ch]">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-clay mb-4">
          9 weeks in · 100% organic · $0 marketing
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-10">
          {stats.map((s) => (
            <div key={s.l}>
              <div
                className="font-serif font-medium text-ink leading-[0.95]"
                style={{ fontSize: "var(--display-l)" }}
              >
                {s.v}
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.10em] text-ink-faded mt-2">
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Slide>
  );
}

/* ───────────── SLIDE 9: ASK + INVESTORS ───────────── */
export function S09Ask() {
  return (
    <Slide n={9} bg="ink" total={TOTAL}>
      <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ivory/55 mb-10">
        The ask
      </p>

      <h2
        className="font-serif font-medium leading-[0.9] text-ivory"
        style={{ fontSize: "var(--display-xxl)" }}
      >
        $200K
      </h2>
      <p
        className="font-serif italic font-light text-ivory/70 mt-2 mb-14"
        style={{ fontSize: "var(--display-m)" }}
      >
        at $5M post-money.
      </p>

      <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-clay mb-4">
        Already in
      </p>
      <p
        className="font-serif font-medium text-ivory leading-[1.15] mb-14 mx-auto max-w-[40ch]"
        style={{ fontSize: "var(--display-m)" }}
      >
        {COMMITTED_INVESTORS.join(" · ")}
      </p>

      <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ivory/55 mb-4">
        12-month milestones
      </p>
      <ul className="space-y-3 inline-block text-left">
        <Milestone label="$50K MRR · 2,000+ paid users" />
        <Milestone label="Codex + Gemini host adapters shipped" />
        <Milestone label="Web app live" />
      </ul>
    </Slide>
  );
}

function Milestone({ label }: { label: string }) {
  return (
    <li
      className="flex items-baseline gap-4 text-ivory leading-tight"
      style={{ fontSize: "var(--paragraph-l)" }}
    >
      <span className="text-clay">→</span>
      <span>{label}</span>
    </li>
  );
}

/* ───────────── SLIDE 10: CONTACT ───────────── */
export function S10Contact() {
  return (
    <Slide n={10} total={TOTAL}>
      <div className="flex flex-col items-center gap-8 lg:gap-10">
        <VeronumMark className="h-16 w-16 lg:h-20 lg:w-20 rounded-2xl" />

        <h2
          className="font-serif font-medium leading-[0.95] text-ink"
          style={{ fontSize: "var(--display-xl)" }}
        >
          Dylan Wain
        </h2>

        <div className="flex flex-col items-center gap-2">
          <a
            href="mailto:dylan.veronum@gmail.com"
            className="font-mono text-[17px] text-clay underline underline-offset-4 decoration-1 hover:opacity-70 transition"
          >
            dylan.veronum@gmail.com
          </a>
          <a
            href="https://www.thetoolswebsite.com"
            className="font-mono text-[15px] text-ink-faded underline underline-offset-4 decoration-1 hover:text-ink transition"
          >
            thetoolswebsite.com
          </a>
        </div>

        <p
          className="font-serif italic font-light text-ink/70 leading-[1.2] mt-6"
          style={{ fontSize: "var(--display-m)" }}
        >
          Code with anyone, on any platform.
        </p>
      </div>
    </Slide>
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

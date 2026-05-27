/**
 * FAQ section — anthropic.com uses similar dense, restrained Q&A blocks.
 * Native <details> for accessibility (no JS needed for open/close).
 */
const faqs = [
  {
    q: "What is Veronum?",
    a: "A macOS desktop app for working in Claude Code with anyone, on any platform. It adds real-time multiplayer sessions, ten parallel agents on one master task, undo/redo, version history, image chat, and per-project group chat to whatever Claude-powered editor you already use.",
  },
  {
    q: "Which platforms does it work with?",
    a: "Claude Desktop, Cursor, Warp, VS Code, and Zed. Veronum reads the standard Claude Code session JSONL on disk, so any client that writes to ~/.claude/projects works without setup. New clients are auto-detected on launch.",
  },
  {
    q: "How does the multiplayer session work?",
    a: "Click Share on a session — Veronum mints a magic invite link, creates a Veronum project, and starts mirroring every turn through Supabase Realtime. Your teammate joins the link and sees your conversation live, can post in the per-session group chat, and gets presence avatars showing who's looking at what file.",
  },
  {
    q: "What's the deal with the ten agents?",
    a: "Open the multi-agent composer (the icon between the paperclip and the model picker), give it one master goal plus a sub-task per agent, and Veronum dispatches up to ten @veronum-agent-N specialists in parallel via Claude's Task tool. Each agent runs in its own context window. You see live progress per agent in the chat bubble.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Claude conversations stay between your Mac and Anthropic — Veronum never proxies them. Shared session mirrors live in your own Supabase project (we host the public default; teams on enterprise can self-host). Your subscription state is anonymous via a local install token, no password, no email harvesting.",
  },
  {
    q: "How does the trial work?",
    a: "Every account starts with 25¢ of usage for free — no card needed. Once you hit the cap, pick a plan: $25/month flat (includes $15 of usage at the base rate, 2× after) or pay-as-you-go at 3× per use with no monthly fee. The plan picker appears in your chat as soon as you exceed the free amount.",
  },
  {
    q: "Can I cancel?",
    a: "Anytime, from the Stripe billing portal linked inside Settings. Veronum keeps working until the end of your paid period.",
  },
  {
    q: "Will it work on Windows or Linux?",
    a: "Not yet. Mac first (Apple-signed and notarized). Windows is on the roadmap; Linux follows if there's demand.",
  },
  {
    q: "Will Veronum keep working when Anthropic ships new Claude features?",
    a: "Yes. Veronum runs the same claude CLI you already have on your Mac — when Anthropic ships a new feature, Veronum picks it up the next time you launch.",
  },
];

export function FAQ() {
  return (
    <section className="u-container py-16 lg:py-24" id="faq">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
        <div className="lg:col-span-4">
          <p className="text-sm text-ink-faded uppercase tracking-[0.12em] mb-3">
            FAQ
          </p>
          <h2
            className="font-serif font-normal leading-[1.15] max-w-[18ch] text-ink"
            style={{ fontSize: "var(--display-m)" }}
          >
            Questions, answered.
          </h2>
        </div>

        <div className="lg:col-span-8">
          <ul className="divide-y divide-ink/10 border-t border-b border-ink/10">
            {faqs.map((item) => (
              <li key={item.q}>
                <details className="group">
                  <summary className="flex justify-between items-center gap-4 py-6 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <span className="text-[16px] font-medium text-ink">
                      {item.q}
                    </span>
                    <span
                      aria-hidden
                      className="text-ink-faded text-2xl leading-none transition-transform duration-200 group-open:rotate-45 select-none"
                    >
                      +
                    </span>
                  </summary>
                  <p className="text-[15px] text-ink/80 leading-relaxed pb-6 max-w-[60ch]">
                    {item.a}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

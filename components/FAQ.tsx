/**
 * FAQ section — anthropic.com uses similar dense, restrained Q&A blocks.
 * Native <details> for accessibility (no JS needed for open/close).
 */
const faqs = [
  {
    q: "What is Veronum?",
    a: "A macOS app that wraps Claude with the things power users keep asking for: a multi-agent composer that splits one prompt across up to 10 parallel agents, live meeting transcription, and one-input connectors for Stripe, Supabase, and Slack.",
  },
  {
    q: "Why not just use claude.ai?",
    a: "claude.ai is great. Veronum is for the moments where you need more than one Claude working at once, want meeting transcripts captured locally on your Mac, or want Claude to query Stripe / Supabase / Slack data without writing custom MCP servers. Everything claude.ai does, Veronum does — plus those.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Chats happen between your Mac and Anthropic, exactly like claude.ai. Meeting audio is processed by Whisper through our backend on thetoolswebsite.com and immediately discarded. Your subscription state lives encrypted in macOS Keychain. Veronum never sells your data, runs ads, or trains on your conversations.",
  },
  {
    q: "How does the trial work?",
    a: "First 7 days are free. No card needed during the trial. After day 7 a soft paywall appears asking for $25/month — you can subscribe through Stripe, or paste an email tied to an existing subscription to unlock.",
  },
  {
    q: "Can I cancel?",
    a: "Anytime, from the Stripe billing portal. Veronum continues working until the end of your paid period.",
  },
  {
    q: "Will it work on Windows or Linux?",
    a: "Not yet. Mac first. Windows is on the roadmap. Linux comes after that if there's demand.",
  },
  {
    q: "Will Veronum keep working when Anthropic ships new Claude features?",
    a: "Yes. Veronum loads the live Claude UI underneath, so any new feature Anthropic ships shows up the next time you launch the app. We don't lock you to a stale version.",
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

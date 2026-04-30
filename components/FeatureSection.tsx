/**
 * Feature list — mirrors anthropic.com's "At Anthropic, we build AI..."
 * pattern exactly. 4-col left-aligned heading, 8-col article-list with
 * category tags on the right.
 */
export function FeatureSection() {
  const features = [
    { name: "Multi-agent composer", category: "Composer" },
    { name: "Live meeting transcripts via Whisper", category: "Meetings" },
    { name: "Stripe, Supabase, Slack, custom MCP servers", category: "Connectors" },
    { name: "Version history with one-click revert", category: "Workspace" },
    { name: "Every Claude feature you already have", category: "Foundation" },
    { name: "Local-first — your data stays on your Mac", category: "Privacy" },
  ];

  return (
    <section className="u-container py-16 lg:py-24">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
        <div className="lg:col-span-4">
          <h2
            className="font-serif font-medium leading-[1.15] max-w-[20ch] text-ink"
            style={{ fontSize: "var(--display-s)" }}
          >
            At Veronum, we build the workspace power users keep building themselves.
          </h2>
        </div>

        <div className="lg:col-span-8">
          <ul aria-label="Veronum features">
            {features.map((f) => (
              <li
                key={f.name}
                className="flex justify-between items-baseline py-6 border-b border-ink/10 first:border-t"
              >
                <span className="text-[16px] font-medium text-ink">
                  {f.name}
                </span>
                <span className="text-[14px] text-ink-faded">{f.category}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

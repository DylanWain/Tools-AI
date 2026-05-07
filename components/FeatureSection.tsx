/**
 * Feature list — anthropic.com "At Anthropic, we build AI..." pattern.
 * 4-col left-aligned heading, 8-col article-list with category tags.
 *
 * Refreshed in v1.1.0 to match the actual shipped product:
 * multiplayer sessions, ten parallel agents, undo/redo + history,
 * inline image chat, per-project group chat. The v1.0.0 list talked
 * about Whisper transcripts and Stripe/Supabase/Slack connectors —
 * those are still in the roadmap doc but no longer in the public
 * download, so we don't list them here.
 */
export function FeatureSection() {
  const features = [
    { name: "Real-time shared Claude Code sessions", category: "Multiplayer" },
    { name: "Ten parallel agents, one master task", category: "Composer" },
    { name: "Auto-snapshots every five seconds + undo / redo", category: "History" },
    { name: "Per-project, per-session group chat", category: "Team" },
    { name: "Image paste with auto-resize to 2000 px", category: "Composer" },
    { name: "Works on Claude, Cursor, Warp, VS Code, Zed", category: "Platforms" },
    { name: "Apple-signed + notarized for macOS", category: "Distribution" },
    { name: "Local-first — your code never leaves your Mac", category: "Privacy" },
  ];

  return (
    <section className="u-container py-16 lg:py-24" id="features">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
        <div className="lg:col-span-4">
          <h2
            className="font-serif font-medium leading-[1.15] max-w-[22ch] text-ink"
            style={{ fontSize: "var(--display-s)" }}
          >
            Veronum is the workspace power users keep building themselves.
          </h2>
        </div>

        <div className="lg:col-span-8">
          <ul aria-label="Veronum features">
            {features.map((f) => (
              <li
                key={f.name}
                className="flex justify-between items-baseline py-6 border-b border-ink/10 first:border-t gap-4"
              >
                <span className="text-[16px] font-medium text-ink">
                  {f.name}
                </span>
                <span className="text-[14px] text-ink-faded flex-shrink-0">
                  {f.category}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

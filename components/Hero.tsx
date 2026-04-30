import Link from "next/link";

/**
 * Hero — mirrors anthropic.com's `home_hero_grid` exactly.
 *
 * 7-col H1 + 5-col paragraph. No buttons in the hero (they live in nav
 * and Pricing). Inline underlined links replace standalone CTAs, matching
 * their "AI [research] and [products] that put safety at the frontier"
 * pattern. The `items-end` on the grid bumps the paragraph to baseline-
 * align with the bottom of the H1, replicating their `home_hero_bump`.
 */
export function Hero() {
  return (
    <header id="main" className="u-container pt-12 sm:pt-16 lg:pt-24 pb-12 lg:pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end">
        <div className="lg:col-span-7">
          <h1
            className="font-serif font-medium text-ink leading-[1.05]"
            style={{ fontSize: "var(--display-xl)" }}
          >
            AI <Link href="#features">workspace</Link> and{" "}
            <Link href="#composer">agents</Link> designed to extend Claude
          </h1>
        </div>

        <div className="lg:col-span-5">
          <p
            className="text-ink leading-[1.45] max-w-[40ch]"
            style={{ fontSize: "var(--paragraph-l)" }}
          >
            Veronum brings a multi-agent composer, live meeting transcripts,
            and one-input connectors for Stripe, Supabase, and Slack — in one
            local-first Mac app.
          </p>
        </div>
      </div>
    </header>
  );
}

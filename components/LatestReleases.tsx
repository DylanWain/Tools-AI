import Link from "next/link";
import { ArrowRight } from "./ArrowRight";

/**
 * Latest releases — mirrors anthropic.com's `package_banner` cards
 * exactly: oat (#e3dacc) background, max-width 35ch on the headline
 * stack, mono uppercase DATE/CATEGORY labels, dark "Read X →" primary
 * button at the bottom.
 */
const releases = [
  {
    title: "Multi-agent composer",
    description:
      "One brief, up to ten agents in parallel. Claude fans out the work, returns synthesized — all on your Mac.",
    optionalLink: { label: "How the composer works", href: "#composer" },
    date: "April 30, 2026",
    category: "Feature",
    cta: "Read about composer",
    href: "#composer",
  },
  {
    title: "Live meeting transcripts",
    description:
      "Whisper-1 transcribes locally as you speak. Claude summarizes, extracts action items, and drafts the follow-up.",
    date: "April 30, 2026",
    category: "Feature",
    cta: "Read about meetings",
    href: "#meetings",
  },
  {
    title: "Connectors with one input",
    description:
      "Paste a single Stripe / Supabase / Slack token. Veronum spins up the MCP server. Claude can query your data immediately.",
    date: "April 30, 2026",
    category: "Feature",
    cta: "Read about connectors",
    href: "#connectors",
  },
];

export function LatestReleases() {
  return (
    <section className="u-container pb-16 lg:pb-24" id="features">
      <h2
        className="font-serif font-medium text-ink mb-8 lg:mb-12"
        style={{ fontSize: "var(--display-s)" }}
      >
        Latest releases
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {releases.map((r) => (
          <article
            key={r.title}
            className="bg-oat rounded-xl p-8 lg:p-10 flex flex-col min-h-[440px] lg:min-h-[500px]"
          >
            {/* Top: title + description + optional secondary link */}
            <div className="max-w-[35ch] flex-1">
              <h3
                className="font-serif font-medium text-ink mb-4 leading-[1.15]"
                style={{ fontSize: "var(--display-s)" }}
              >
                {r.title}
              </h3>
              <p
                className="text-ink/85 leading-relaxed mb-4"
                style={{ fontSize: "var(--paragraph-s)" }}
              >
                {r.description}
              </p>
              {r.optionalLink && (
                <Link
                  href={r.optionalLink.href}
                  className="inline-flex items-center gap-1 text-[14px] text-ink underline underline-offset-4 decoration-1 hover:opacity-70 transition"
                >
                  {r.optionalLink.label}
                </Link>
              )}
            </div>

            {/* Bottom: metadata + primary CTA */}
            <div className="mt-8">
              <ul className="mb-6 space-y-3">
                <li className="flex justify-between items-center">
                  <span className="font-mono uppercase text-[12px] text-ink-faded tracking-[0.08em]">
                    Date
                  </span>
                  <span className="text-[14px] text-ink">{r.date}</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="font-mono uppercase text-[12px] text-ink-faded tracking-[0.08em]">
                    Category
                  </span>
                  <span className="text-[14px] text-ink">{r.category}</span>
                </li>
              </ul>
              <Link
                href={r.href}
                className="inline-flex items-center gap-2 bg-slate-dark text-ivory pl-5 pr-2 py-2 rounded-full text-[14.5px] font-medium hover:bg-slate-medium transition"
              >
                <span>{r.cta}</span>
                <span className="bg-ivory/0 rounded-full w-7 h-7 flex items-center justify-center">
                  <ArrowRight className="w-5 h-5" />
                </span>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

import { ArrowRight } from "./ArrowRight";

/**
 * Pricing — restyled as a quiet text block (no card) to match anthropic's
 * minimalism. Subscribe + Start trial as the two CTAs.
 */
export function Pricing() {
  return (
    <section className="u-container py-16 lg:py-24" id="pricing">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
        <div className="lg:col-span-4">
          <h2
            className="font-serif font-medium leading-[1.1] text-ink"
            style={{ fontSize: "var(--display-l)" }}
          >
            $25 a month.
            <br />
            <span className="italic font-light">Seven days free.</span>
          </h2>
        </div>

        <div className="lg:col-span-8">
          <p
            className="text-ink/85 leading-relaxed max-w-[55ch] mb-8"
            style={{ fontSize: "var(--paragraph-m)" }}
          >
            One subscription unlocks the full app: Claude chat, multi-agent
            composer, live meeting transcripts, and connectors for Stripe,
            Supabase, and Slack. Cancel anytime through Stripe.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://buy.stripe.com/fZu28tb3x9aufwJeLt1sQ00"
              className="inline-flex items-center gap-1 bg-slate-dark text-ivory pl-5 pr-2 py-2 rounded-full text-[14.5px] font-medium hover:bg-slate-medium transition"
            >
              <span>Subscribe</span>
              <span className="w-7 h-7 flex items-center justify-center">
                <ArrowRight className="w-5 h-5" />
              </span>
            </a>
            <a
              href="https://github.com/DylanWain/veronum-overlay/releases/latest/download/Veronum.dmg"
              className="inline-flex items-center border border-ink/30 text-ink px-5 py-3 rounded-full text-[14.5px] font-medium hover:bg-ink/[0.04] transition"
            >
              Start free trial
            </a>
          </div>
          <p className="mt-4 text-[14px] text-ink-faded">
            No credit card required for the trial. One universal Mac
            build — works on Apple Silicon and Intel.
          </p>
        </div>
      </div>
    </section>
  );
}

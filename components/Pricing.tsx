import { ArrowRight } from "./ArrowRight";
import { DownloadLink } from "./DownloadLink";

/**
 * Pricing — two-tier model matching the actual Stripe products + free trial:
 *
 *   Free trial:  $0.25 of usage, no card needed
 *   Subscribe:   $25 / month, includes $15 of usage at 1x, 2x after
 *   Pay-as-you-go: no flat fee, billed 3x per use, card on file
 *
 * The Subscribe CTA goes straight to the Stripe Payment Link (existing
 * product). The PAYG flow needs the user to be signed in (so we know
 * their user_id for the metered subscription), so we send them to
 * /chat — once they hit the paywall there, both plan options are
 * presented.
 *
 * Both Mac downloads point at the stable /latest/download URL on
 * GitHub Releases. Each new DMG release uploads a renamed asset to
 * keep this URL working.
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
            <span className="italic font-light">Or pay as you go.</span>
          </h2>
        </div>

        <div className="lg:col-span-8">
          <p
            className="text-ink/85 leading-relaxed max-w-[55ch] mb-8"
            style={{ fontSize: "var(--paragraph-m)" }}
          >
            Try Veronum for free — every account starts with 25&cent; of
            usage, no card needed. After that, pick a plan: $25 a month
            (covers $15 of usage at the base rate, 2&times; after) or
            pay-as-you-go at 3&times; per use with no monthly fee.
            Cancel anytime through Stripe.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://buy.stripe.com/fZu28tb3x9aufwJeLt1sQ00"
              className="inline-flex items-center gap-1 bg-slate-dark text-ivory pl-5 pr-2 py-2 rounded-full text-[14.5px] font-medium hover:bg-slate-medium transition"
            >
              <span>Subscribe — $25 / month</span>
              <span className="w-7 h-7 flex items-center justify-center">
                <ArrowRight className="w-5 h-5" />
              </span>
            </a>
            <a
              href="/chat"
              className="inline-flex items-center border border-ink/30 text-ink px-5 py-3 rounded-full text-[14.5px] font-medium hover:bg-ink/[0.04] transition"
            >
              Try free (25&cent;) or pay-as-you-go
            </a>
          </div>
          <p className="mt-4 text-[14px] text-ink-faded">
            No credit card required for the free trial. Download the
            Mac app — universal binary, signed + notarized by Apple,
            works on Apple Silicon and Intel.
          </p>
          <div className="mt-3">
            <DownloadLink
              href="https://github.com/DylanWain/veronum-bridge/releases/latest/download/Veronum-Bridge.dmg"
              source="pricing"
              className="text-[14px] text-ink underline hover:opacity-70"
            >
              Download Veronum Bridge for Mac &rarr;
            </DownloadLink>
          </div>
        </div>
      </div>
    </section>
  );
}

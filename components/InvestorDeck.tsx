import { ArrowRight } from "./ArrowRight";

/**
 * Investor deck section — secondary CTA for the marketing site.
 * Links to the live web deck at /deck and offers a direct PDF download.
 */
export function InvestorDeck() {
  return (
    <section
      className="u-container py-16 lg:py-24 border-t border-ink/10"
      id="investors"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
        <div className="lg:col-span-4">
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-faded mb-4">
            For investors
          </p>
          <h2
            className="font-serif font-medium leading-[1.05] text-ink"
            style={{ fontSize: "var(--display-l)" }}
          >
            Pre-seed.
            <br />
            <span className="italic font-light">$200K at $5M post.</span>
          </h2>
        </div>

        <div className="lg:col-span-8">
          <p
            className="text-ink/85 leading-relaxed max-w-[55ch] mb-8"
            style={{ fontSize: "var(--paragraph-m)" }}
          >
            $35K already committed. $125 MRR in two months, every customer
            inbound. Live web deck below — fifteen slides covering the bet,
            the traction, the team, and the ask. PDF available for offline
            review.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/deck"
              className="inline-flex items-center gap-1 bg-slate-dark text-ivory pl-5 pr-2 py-2 rounded-full text-[14.5px] font-medium hover:bg-slate-medium transition"
            >
              <span>View live deck</span>
              <span className="w-7 h-7 flex items-center justify-center">
                <ArrowRight className="w-5 h-5" />
              </span>
            </a>
            <a
              href="/Veronum-Pitch-Deck.pdf"
              download
              className="inline-flex items-center gap-2 bg-transparent text-ink border border-ink/20 px-5 py-2 rounded-full text-[14.5px] font-medium hover:bg-ink/5 transition"
            >
              <span>Download PDF</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
          </div>
          <p className="mt-6 text-[13px] text-ink-faded">
            Direct contact:{" "}
            <a
              href="mailto:dylanwain@me.com"
              className="text-ink hover:underline"
            >
              dylanwain@me.com
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

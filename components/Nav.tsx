import Link from "next/link";
import { VeronumMark } from "./VeronumMark";

/**
 * Top nav — sticky, ivory backdrop with subtle blur. Mirrors anthropic's
 * navigation rhythm: logo + wordmark on the left, primary links centered,
 * "Try in browser" + "Download" on the right (matches their "Try Claude").
 */
export function Nav() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-ivory/80 border-b border-ink/[0.06]">
      <div className="u-container flex items-center justify-between h-[4.25rem]">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          aria-label="Veronum home"
        >
          <VeronumMark className="h-7 w-7 rounded-md" />
          <span className="font-serif text-[20px] font-medium tracking-tight text-ink">
            Veronum
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-8 text-[15px] text-ink"
        >
          <Link href="#features" className="hover:opacity-60 transition">
            Features
          </Link>
          <Link href="#pricing" className="hover:opacity-60 transition">
            Pricing
          </Link>
          <Link href="#faq" className="hover:opacity-60 transition">
            FAQ
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/deck"
            className="hidden lg:inline-block text-[15px] text-ink hover:opacity-60 transition"
          >
            See our Deck
          </Link>
          {/* Open chat — primary CTA for existing users. Redirects to
              the user's paired Mac via cloudflared tunnel after a
              quick auth check. New users land on a sign-in form. */}
          <Link
            href="/chat"
            className="inline-flex items-center bg-slate-dark text-ivory px-3 sm:px-4 py-[7px] rounded-full text-[14px] sm:text-[14.5px] font-medium hover:bg-slate-medium transition"
            title="Open chat on your paired Mac"
          >
            Open chat
          </Link>
          {/* Download — secondary. Existing users already have Bridge;
              this button is for first-time visitors. Styled as
              outlined-pill to step back from the primary 'Open chat'. */}
          <a
            href="https://github.com/DylanWain/veronum-bridge/releases/latest/download/Veronum-Bridge.dmg"
            className="hidden sm:inline-flex items-center border border-ink/30 text-ink px-3 sm:px-4 py-[6px] rounded-full text-[14px] sm:text-[14.5px] font-medium hover:bg-ink/[0.04] transition"
            title="Universal Mac build — Apple Silicon (M1–M4) and Intel · signed + notarized by Apple"
          >
            Download
          </a>
        </div>
      </div>
    </header>
  );
}

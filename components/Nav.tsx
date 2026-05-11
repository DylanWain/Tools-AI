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

        <div className="flex items-center gap-3">
          <Link
            href="/deck"
            className="hidden md:inline-block text-[15px] text-ink hover:opacity-60 transition"
          >
            See our Deck
          </Link>
          <a
            href="https://github.com/DylanWain/veronum-releases/releases/latest/download/Veronum-1.2.2-x64.dmg"
            className="hidden md:inline-block text-[13px] text-ink-soft hover:text-ink transition"
            title="For Intel Macs (Mac mini 2018, older MacBook Pros). Check Apple menu → About This Mac to confirm."
          >
            Intel?
          </a>
          <a
            href="https://github.com/DylanWain/veronum-releases/releases/latest/download/Veronum-1.2.2-arm64.dmg"
            className="inline-flex items-center bg-slate-dark text-ivory px-4 py-[7px] rounded-full text-[14.5px] font-medium hover:bg-slate-medium transition"
            title="For Apple Silicon (M1, M2, M3, M4). Default for Macs sold since 2020."
          >
            Download
          </a>
        </div>
      </div>
    </header>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Same chrome as the V1 deck (back to site, slide counter, keyboard nav)
 * with a "V2 PREVIEW" badge so it's obvious this is the rewrite, not
 * the production deck. PDF download is intentionally omitted from V2
 * preview — pdf print path can be added once content is locked.
 */
export function DeckChrome() {
  const [current, setCurrent] = useState(1);
  const total = 15;

  useEffect(() => {
    const onScroll = () => {
      const slides = document.querySelectorAll<HTMLElement>("[data-slide]");
      let active = 1;
      for (const el of slides) {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight / 2) {
          active = parseInt(el.dataset.slide || "1", 10);
        }
      }
      setCurrent(active);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("scroll", onScroll, {
      passive: true,
      capture: true,
    });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const slides = document.querySelectorAll<HTMLElement>("[data-slide]");
      const next = (delta: number) => {
        const target = Math.min(Math.max(current + delta, 1), slides.length);
        const el = document.querySelector<HTMLElement>(
          `[data-slide="${target}"]`
        );
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next(1);
      }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        next(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);

  return (
    <>
      {/* Top-left: V2 preview badge + back to site */}
      <div className="fixed top-4 left-4 z-50 flex items-center gap-2 print:hidden">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-ivory/90 backdrop-blur border border-ink/10 text-[12.5px] font-medium text-ink hover:bg-ivory transition"
        >
          ← veronum.com
        </Link>
        <span className="px-2.5 py-1.5 rounded-full bg-clay text-ivory text-[10.5px] font-mono uppercase tracking-[0.14em]">
          V2 Preview
        </span>
      </div>

      {/* Top-right: slide counter + link back to V1 for comparison */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 print:hidden">
        <a
          href="/deck"
          className="px-3 py-1.5 rounded-full bg-ivory/90 backdrop-blur border border-ink/10 text-[11.5px] font-mono uppercase tracking-[0.10em] text-ink-faded hover:text-ink transition"
        >
          Compare V1
        </a>
        <span className="px-3 py-1.5 rounded-full bg-ivory/90 backdrop-blur border border-ink/10 font-mono text-[11.5px] uppercase tracking-[0.12em] text-ink">
          {String(current).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </div>

      {/* Bottom-center: keyboard hint */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-full bg-ivory/90 backdrop-blur border border-ink/10 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faded print:hidden">
        ← / → · Space to advance
      </div>
    </>
  );
}

/**
 * DemoSection — section wrapper used by each of the four demo blocks.
 * Two variants:
 *   - "ivory" (default): page background, padded vertically only
 *   - "oat":             beige card-bg, full-bleed band that breaks
 *                        up the page rhythm between demos
 *
 * Layout:
 *   - Top: 12-col grid with 4-col eyebrow stack (eyebrow label + h2 +
 *     description) on the left and 8-col empty (matches anthropic.com
 *     pattern). On lg+ the headline reflows to fit, and on small
 *     screens it stacks vertically.
 *   - Below the headline: full-width child slot for the demo itself.
 */

import type { ReactNode } from "react";

type Props = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  variant?: "ivory" | "oat";
  children: ReactNode;
};

export function DemoSection({
  id,
  eyebrow,
  title,
  description,
  variant = "ivory",
  children,
}: Props) {
  const wrapClass =
    variant === "oat"
      ? "bg-oat py-16 lg:py-24"
      : "py-16 lg:py-24";
  return (
    <section id={id} className={wrapClass}>
      <div className="u-container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 mb-10 lg:mb-14 items-end">
          <div className="lg:col-span-7">
            <div className="font-mono text-[12px] uppercase tracking-[0.10em] text-ink-faded mb-3">
              {eyebrow}
            </div>
            <h2
              className="font-serif font-medium text-ink leading-[1.1] max-w-[22ch]"
              style={{ fontSize: "var(--display-l)" }}
            >
              {title}
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p
              className="text-ink-faded leading-[1.55] max-w-[44ch]"
              style={{ fontSize: "var(--paragraph-s)" }}
            >
              {description}
            </p>
          </div>
        </div>

        <div>{children}</div>
      </div>
    </section>
  );
}

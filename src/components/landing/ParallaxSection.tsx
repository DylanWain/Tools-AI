/* ═══════════════════════════════════════════════════════════════════════════
 * ParallaxSection — scroll-linked vertical parallax wrapper
 *
 * Children move at `rate` times the normal scroll speed. rate=1 is normal,
 * rate<1 scrolls slower (appears further away), rate>1 scrolls faster.
 *
 * Uses framer-motion's useScroll tracking offset relative to the element,
 * so the parallax is localized to when the section is in view.
 * ═══════════════════════════════════════════════════════════════════════ */
"use client";
import { useRef, ReactNode, CSSProperties } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

interface Props {
  children: ReactNode;
  rate?: number;       // 1 = normal; 0.9 = slight slow parallax; 1.1 = faster
  className?: string;
  style?: CSSProperties;
}

export default function ParallaxSection({
  children,
  rate = 0.92,
  className,
  style,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Track scroll from when the section enters the viewport bottom until it
  // leaves the viewport top.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // If rate < 1, content moves UP slower (drifts downward as we scroll) → depth effect
  // Shift in px over the section's in-view range.
  const shift = (1 - rate) * 200; // e.g. rate=0.9 → 20px over full range
  const y = useTransform(scrollYProgress, [0, 1], [shift, -shift]);

  return (
    <motion.div ref={ref} className={className} style={{ ...style, y }}>
      {children}
    </motion.div>
  );
}

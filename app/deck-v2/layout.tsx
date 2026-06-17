import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Veronum — Pitch Deck (V2 Preview)",
  description:
    "Cross-tool collaboration · 10-agent orchestration · undo/redo. Pre-seed pitch · $200K at $5M post.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DeckV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

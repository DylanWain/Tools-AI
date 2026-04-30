import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Veronum — Pitch Deck",
  description: "Pre-seed pitch · $200K at $5M post · April 2026.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DeckLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

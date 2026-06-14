import type { Metadata } from "next";
import { Newsreader, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { PageViewTracker } from "@/components/PageViewTracker";
import { ActivityTracker } from "@/components/ActivityTracker";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Veronum — every LLM, one workspace",
  description:
    "One prompt, every model. Compare Claude, GPT, Gemini & Perplexity side-by-side, continue your Claude Code / Cursor / Codex sessions, and code 3.5× faster than any one model alone.",
  metadataBase: new URL("https://www.thetoolswebsite.com"),
  openGraph: {
    title: "Veronum — every LLM, one workspace",
    description:
      "One prompt, every model. Code 3.5× faster than Claude alone. Free to start, then $25/mo or pay-as-you-go.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Veronum — every LLM, one workspace",
    description: "One prompt, every model. Code 3.5× faster than Claude alone.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${inter.variable} ${jetbrains.variable}`}
    >
      <body>
        <PageViewTracker />
        <ActivityTracker />
        {children}
      </body>
    </html>
  );
}

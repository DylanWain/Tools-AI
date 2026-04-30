import type { Metadata } from "next";
import { Newsreader, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

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
  title: "Veronum — AI workspace built on Claude",
  description:
    "Multi-agent composer, live meeting transcripts, and native connectors for Stripe, Supabase, and Slack. 7 days free, then $25/month.",
  metadataBase: new URL("https://www.thetoolswebsite.com"),
  openGraph: {
    title: "Veronum — AI workspace built on Claude",
    description:
      "Multi-agent composer, meeting transcripts, native connectors. 7 days free, then $25/month.",
    type: "website",
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
      <body>{children}</body>
    </html>
  );
}

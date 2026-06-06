import type { Metadata } from "next";
import { Newsreader, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { PageViewTracker } from "@/components/PageViewTracker";

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
  title: "Veronum — Reach your Mac's Claude Code & Cursor sessions from anywhere",
  description:
    "Pair your Mac once, then chat with all your Claude Code and Cursor Agent sessions from your phone or any device. 10¢ free trial, then $25/month or pay-as-you-go.",
  metadataBase: new URL("https://www.thetoolswebsite.com"),
  openGraph: {
    title: "Veronum — Your Mac's Claude/Cursor sessions, anywhere",
    description:
      "10¢ free trial, then $25/month flat or pay-as-you-go. Universal Mac app, signed + notarized.",
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
      <body>
        <PageViewTracker />
        {children}
      </body>
    </html>
  );
}

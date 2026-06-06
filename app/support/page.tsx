/**
 * /support — Support page for Veronum users.
 *
 * Linked from the Chrome Web Store listing's "Support URL" field.
 * Chrome requires this page to return 200 + provide a clear way for
 * users to contact us when something breaks. Brand-matched to the
 * homepage so it doesn't feel like a generic footer page.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Support — Veronum",
  description:
    "Get help with the Veronum Chrome extension or desktop app. Email, bug reports, feature requests.",
};

export default function SupportPage() {
  return (
    <>
      <Nav />
      <main className="u-container pt-12 sm:pt-16 lg:pt-20 pb-20 lg:pb-28">
        <header className="max-w-[68ch] mx-auto mb-12">
          <div className="font-mono uppercase tracking-[0.08em] text-[var(--detail-xs)] text-ink-faded mb-3">
            Support
          </div>
          <h1
            className="font-serif font-medium text-ink leading-[1.05]"
            style={{ fontSize: "var(--display-xl)" }}
          >
            Something not working? Tell us.
          </h1>
          <p
            className="text-ink leading-[1.55] mt-5 max-w-[58ch]"
            style={{ fontSize: "var(--paragraph-m)" }}
          >
            Veronum is built by a small team. Email goes straight to
            the people who write the code. Most bug reports get a reply
            within a business day.
          </p>
        </header>

        <article className="max-w-[68ch] mx-auto">
          {/* Primary contact card */}
          <div className="border border-ink/10 rounded-2xl bg-ivory-light p-7 sm:p-9 mb-12">
            <div className="font-mono uppercase tracking-[0.08em] text-[var(--detail-xs)] text-ink-faded mb-3">
              The fastest way to reach us
            </div>
            <h2
              className="font-serif font-medium text-ink leading-[1.1] mb-4"
              style={{ fontSize: "var(--display-m)" }}
            >
              <a
                href="mailto:hello@thetoolswebsite.com?subject=Veronum%20support"
                className="underline hover:text-clay transition"
              >
                hello@thetoolswebsite.com
              </a>
            </h2>
            <p
              className="text-ink leading-[1.55] max-w-[52ch]"
              style={{ fontSize: "var(--paragraph-s)" }}
            >
              Include your operating system, browser version (if
              extension-related), and steps to reproduce. Screenshots
              help. We read every message.
            </p>
          </div>

          <Section title="Common questions">
            <Faq
              q="The V button isn't appearing on ChatGPT / Claude / Gemini."
              a="Make sure you're on a supported URL (chatgpt.com, claude.ai, gemini.google.com, grok.com, www.perplexity.ai) and reload the page once after installing. The button anchors to the composer; if the site just redirected, it can take a second to appear."
            />
            <Faq
              q="I clicked Share but the link 404s for my teammate."
              a="If your machine was offline when you shared, the link is saved locally but not yet published. Open the toolbar popup, click the Recent share again — the extension retries the publish. Once your network is back, the recipient page will resolve."
            />
            <Faq
              q="How do I uninstall + delete my data?"
              a="Right-click the Veronum icon in your Chrome toolbar → Remove from Chrome. That deletes all local extension data automatically. If you've published any public shares and want them removed from our backend, email us with the share URLs."
            />
            <Faq
              q="Does Veronum work on Firefox / Safari / Edge?"
              a="Chrome and Chromium-based browsers (Edge, Brave, Arc, Opera) only for now. Firefox and Safari versions are on the roadmap but not yet shipping."
            />
            <Faq
              q="What's the difference between the Chrome extension and the desktop app?"
              a="The extension lives in your browser and works on AI conversation pages. The Mac desktop app (Veronum Bridge — 10¢ free trial, then $25/month or pay-as-you-go) pairs your Mac so you can reach all your Claude Code and Cursor Agent sessions from your phone or any device, with voice + chat."
            />
            <Faq
              q="Can I use Veronum with my company's enterprise ChatGPT or Claude account?"
              a="Yes — the extension works on the same URLs regardless of plan tier. Shares respect your existing account; nothing is sent to OpenAI/Anthropic/Google through the extension, only what you explicitly click Share on goes to Veronum's own backend."
            />
            <Faq
              q="Is my conversation data private?"
              a="See our privacy page. Short version: nothing leaves your device unless you click Share. We don't sell or trade data. Conversations stay yours."
            />
          </Section>

          <Section title="Bug reports + feature requests">
            <p>
              Best path: email{" "}
              <a
                href="mailto:hello@thetoolswebsite.com?subject=Veronum%20bug%20or%20feature"
                className="underline text-ink hover:text-clay"
              >
                hello@thetoolswebsite.com
              </a>
              . Include what you expected to happen vs what actually
              happened. If you&apos;re comfortable with the Chrome
              extension DevTools, the console output is gold for
              tracking down the failure.
            </p>
            <p>
              Feature requests get triaged into the roadmap. We ship
              updates roughly every 1-2 weeks; if your request is
              upvoted by multiple users it moves up.
            </p>
          </Section>

          <Section title="Account, billing, refunds (desktop app)">
            <p>
              Every account starts with 10¢ of free usage — no card
              needed. After that, choose <strong>$25/month flat</strong>{" "}
              (covers $25 of usage at the base rate, 2× after) or{" "}
              <strong>pay-as-you-go at 3×</strong> with no monthly fee.
              Both plans are billed through Stripe; cancel any time from
              the Stripe billing portal. Full refund within 14 days of
              purchase, no questions asked.
            </p>
          </Section>

          <Section title="Privacy + data deletion">
            <p>
              Detailed privacy practices live on the{" "}
              <Link
                href="/privacy"
                className="underline text-ink hover:text-clay"
              >
                privacy page
              </Link>
              . If you want a specific share or your account data
              deleted from our backend, email us with the share URL
              or account email — we remove it within 7 days.
            </p>
          </Section>
        </article>
      </main>
      <Footer />
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2
        className="font-serif font-medium text-ink leading-[1.15] mb-4"
        style={{ fontSize: "var(--display-s)" }}
      >
        {title}
      </h2>
      <div
        className="text-ink leading-[1.6] [&_p]:mb-4"
        style={{ fontSize: "var(--paragraph-s)" }}
      >
        {children}
      </div>
    </section>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="border-b border-ink/10 py-4 group">
      <summary
        className="cursor-pointer text-ink font-medium list-none flex items-start gap-3"
        style={{ fontSize: "var(--paragraph-s)" }}
      >
        <span className="font-mono text-ink-faded mt-0.5 group-open:rotate-90 transition-transform">
          ›
        </span>
        <span className="flex-1">{q}</span>
      </summary>
      <p
        className="text-ink leading-[1.6] mt-3 pl-6 max-w-[58ch]"
        style={{ fontSize: "var(--paragraph-s)" }}
      >
        {a}
      </p>
    </details>
  );
}

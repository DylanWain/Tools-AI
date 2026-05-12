/**
 * /privacy — Privacy statement for Veronum (Chrome extension + desktop app).
 *
 * Linked from the Chrome Web Store listing's "Privacy policy URL" field.
 * Chrome requires this page to return 200 + contain a privacy disclosure
 * accurate to what the code actually does. Reviewer will compare this
 * text against the manifest permissions + the listed data categories
 * in the CWS dashboard. Keep them aligned: the extension reads only
 * the active AI conversation tab DOM on explicit user click, stores
 * the user's own share history locally, and only transmits content
 * to our Supabase backend when the user clicks "Share this chat live."
 *
 * Brand match: same Nav/Footer + design tokens as the homepage.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy — Veronum",
  description:
    "What Veronum collects, what it doesn't, and where your AI conversation data goes. Local-first by design.",
};

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className="u-container pt-12 sm:pt-16 lg:pt-20 pb-20 lg:pb-28">
        {/* Header */}
        <header className="max-w-[68ch] mx-auto mb-12">
          <div className="font-mono uppercase tracking-[0.08em] text-[var(--detail-xs)] text-ink-faded mb-3">
            Privacy
          </div>
          <h1
            className="font-serif font-medium text-ink leading-[1.05]"
            style={{ fontSize: "var(--display-xl)" }}
          >
            Your AI conversations stay yours.
          </h1>
          <p
            className="text-ink leading-[1.55] mt-5 max-w-[58ch]"
            style={{ fontSize: "var(--paragraph-m)" }}
          >
            Veronum is built local-first. The Chrome extension only reads
            an AI conversation when you explicitly click a Veronum action.
            Public shares are one click at a time, opt-in, and never
            automatic. No tracking, no analytics on chat content.
          </p>
          <div className="font-mono text-[var(--detail-xs)] text-ink-faded mt-6">
            Last updated: May 12, 2026
          </div>
        </header>

        <article className="max-w-[68ch] mx-auto">
          <Section title="What Veronum collects">
            <p>
              The Veronum Chrome extension reads the conversation DOM of
              the active tab on the supported AI sites (ChatGPT, Claude,
              Gemini, Grok, Perplexity) only when you click one of its
              actions: <strong>Share this chat live</strong>,{" "}
              <strong>Save to version history</strong>, or{" "}
              <strong>Undo last AI edit</strong>. The extension does not
              read any other site, ever.
            </p>
            <p>
              The extension stores a local list of your recent shares
              (up to 50 entries) in <span className="font-mono text-[14px]">chrome.storage.local</span> so the popup
              can re-surface them. That storage never leaves your device.
            </p>
          </Section>

          <Section title="What Veronum does NOT collect">
            <ul>
              <li>No personally identifiable information (name, email, address, ID)</li>
              <li>No authentication tokens, passwords, or session cookies</li>
              <li>No location data (region, IP, GPS)</li>
              <li>No browsing history outside the supported AI sites</li>
              <li>No analytics on conversation content</li>
              <li>No keystroke logging, mouse tracking, or scroll telemetry</li>
              <li>No data from any site other than the ones listed above</li>
            </ul>
          </Section>

          <Section title="When data leaves your device">
            <p>
              Data leaves your device only when you{" "}
              <strong>explicitly click</strong> one of these actions:
            </p>
            <ul>
              <li>
                <strong>Share this chat live</strong> — the captured
                conversation is sent to our backend (Supabase) so the
                share URL <span className="font-mono text-[14px]">thetoolswebsite.com/s/&lt;id&gt;</span>{" "}
                can render it for the recipient. Anyone with the URL can
                read the conversation.
              </li>
              <li>
                <strong>Save to version history</strong> — same path,
                but flagged private. The recipient page returns 404.
                Only you, signed into your Veronum identity, can read it.
              </li>
            </ul>
            <p>
              No background syncing, no auto-uploads, no telemetry — if
              you never click Share or Save, nothing the extension reads
              ever leaves your browser.
            </p>
          </Section>

          <Section title="Third parties">
            <p>We use exactly two third-party services:</p>
            <ul>
              <li>
                <strong>Supabase</strong> — our database. Stores public
                share records (when you click Share) and your Veronum
                account identity if you install the desktop app. Hosted
                on Supabase, Inc. servers in the United States.
              </li>
              <li>
                <strong>Vercel</strong> — hosts thetoolswebsite.com and
                the share recipient pages. Standard request logs (URL,
                timestamp, user agent) are kept for operational
                purposes; conversation content is never logged.
              </li>
            </ul>
            <p>
              We do not sell, trade, or rent any user data to anyone,
              full stop.
            </p>
          </Section>

          <Section title="The desktop app">
            <p>
              Veronum Desktop (a separate macOS app, optional, free
              trial then paid) extends the same actions into your local
              codebase. It stores its data the same way: local-first,
              with cloud sync to Supabase only for shared sessions you
              opt into. Same privacy rules apply.
            </p>
          </Section>

          <Section title="Deleting your data">
            <p>
              In the extension: open the toolbar popup, click the gear
              icon, choose <strong>Clear all local data</strong>. This
              wipes your Recent shares list and any cached state.
            </p>
            <p>
              To delete a specific public share from Supabase, email{" "}
              <a
                href="mailto:hello@thetoolswebsite.com"
                className="underline text-ink hover:text-clay"
              >
                hello@thetoolswebsite.com
              </a>{" "}
              with the share URL or ID and we&apos;ll remove it within
              7 days. We&apos;ll keep working on a self-serve delete
              button — this is the manual path until then.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              If we materially change what data is collected or how
              it&apos;s used, this page gets updated and the &ldquo;Last
              updated&rdquo; date at the top of the page changes. We
              don&apos;t silently expand data collection.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions, concerns, or data requests:{" "}
              <a
                href="mailto:hello@thetoolswebsite.com"
                className="underline text-ink hover:text-clay"
              >
                hello@thetoolswebsite.com
              </a>
              .
            </p>
            <p>
              For bug reports and feature requests, see our{" "}
              <Link
                href="/support"
                className="underline text-ink hover:text-clay"
              >
                support page
              </Link>
              .
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
        className="text-ink leading-[1.6] [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:pl-5 [&_ul]:list-disc [&_li]:mb-1.5"
        style={{ fontSize: "var(--paragraph-s)" }}
      >
        {children}
      </div>
    </section>
  );
}

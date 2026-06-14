import { VeronumMark } from "./VeronumMark";
import { DownloadLink } from "./DownloadLink";

// Matches any href that points to a Veronum Bridge download — these
// get wrapped in <DownloadLink> instead of a plain <a> so the click
// records a download_events row before the browser navigates.
const DOWNLOAD_URL_RE = /veronum-bridge\/releases\/latest\/download/i;

/**
 * Footer — anthropic.com's `footer_grid` structure.
 * Big mark on the left + 9-col content area split into 3 column groups,
 * each with two sub-sections (Product+Models / Resources+Help / Company+Legal).
 * Dark theme (slate-dark background).
 */
export function Footer() {
  return (
    <footer id="footer" className="bg-slate-dark text-ivory">
      <div className="u-container py-12 lg:py-20">
        <nav
          aria-label="Footer"
          className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12"
        >
          {/* Big V mark + copyright + social */}
          <div className="md:col-span-3">
            <VeronumMark className="h-12 w-12 rounded-md" />
            <div className="hidden md:block mt-12">
              <p className="text-[14px] text-ivory/60 mb-4">© 2026 Veronum</p>
              <ul className="flex gap-3">
                <li>
                  <a
                    href="https://x.com/dylanwain"
                    aria-label="Veronum on X"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-9 h-9 rounded-full hover:bg-ivory/10 flex items-center justify-center transition"
                  >
                    <XIcon className="w-5 h-5" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/DylanWain"
                    aria-label="Veronum on GitHub"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-9 h-9 rounded-full hover:bg-ivory/10 flex items-center justify-center transition"
                  >
                    <GitHubIcon className="w-5 h-5" />
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* 3 column groups */}
          <div className="md:col-span-9 grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-12">
            <FooterGroup>
              <FooterColumn
                title="Product"
                items={[
                  { label: "Veronum desktop", href: "#features" },
                  { label: "Multi-agent composer", href: "#composer" },
                  { label: "Meeting transcripts", href: "#meetings" },
                  { label: "Connectors", href: "#connectors" },
                  { label: "Try in browser", href: "/app" },
                  { label: "Download for Mac", href: "https://github.com/DylanWain/veronum-desktop/releases/latest/download/Veronum.dmg" },
                  { label: "Pricing", href: "#pricing" },
                ]}
              />
              <FooterColumn
                title="Models"
                items={[
                  { label: "Opus", href: "https://www.anthropic.com/claude/opus" },
                  { label: "Sonnet", href: "https://www.anthropic.com/claude/sonnet" },
                  { label: "Haiku", href: "https://www.anthropic.com/claude/haiku" },
                ]}
              />
            </FooterGroup>

            <FooterGroup>
              <FooterColumn
                title="Resources"
                items={[
                  { label: "FAQ", href: "#faq" },
                  { label: "Changelog", href: "/changelog" },
                  { label: "Roadmap", href: "/roadmap" },
                  { label: "Status", href: "https://status.claude.com/" },
                ]}
              />
              <FooterColumn
                title="Help"
                items={[
                  { label: "Support", href: "mailto:support@thetoolswebsite.com" },
                  { label: "Contact", href: "mailto:hello@thetoolswebsite.com" },
                ]}
              />
            </FooterGroup>

            <FooterGroup>
              <FooterColumn
                title="Company"
                items={[
                  { label: "Veronum", href: "/" },
                  { label: "Built on Claude", href: "https://www.anthropic.com" },
                ]}
              />
              <FooterColumn
                title="Legal"
                items={[
                  { label: "Privacy", href: "/privacy" },
                  { label: "Terms", href: "/terms" },
                  { label: "Usage policy", href: "/usage" },
                ]}
              />
            </FooterGroup>
          </div>
        </nav>

        {/* Mobile copyright */}
        <div className="md:hidden mt-12 pt-8 border-t border-ivory/10 flex items-center justify-between">
          <p className="text-[13px] text-ivory/60">© 2026 Veronum</p>
        </div>
      </div>
      {/* Secret admin entry — looks like a typo dot in the corner. Not
          labeled, not in nav, noindex on the page itself. /admin gates
          access by Supabase sign-in + tier='admin' check. */}
      <a
        href="/admin"
        aria-label="admin"
        className="fixed right-2 bottom-2 z-50 inline-flex h-4 w-4 items-center justify-center text-[18px] leading-none text-ivory/10 no-underline"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        ·
      </a>
    </footer>
  );
}

function FooterGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-12">{children}</div>;
}

function FooterColumn({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-[14px] font-medium text-ivory mb-5">{title}</h3>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.label}>
            {DOWNLOAD_URL_RE.test(item.href) ? (
              <DownloadLink
                href={item.href}
                source="footer"
                className="text-[14px] text-ivory/70 hover:text-ivory transition"
              >
                {item.label}
              </DownloadLink>
            ) : (
              <a
                href={item.href}
                className="text-[14px] text-ivory/70 hover:text-ivory transition"
              >
                {item.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function XIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M28 28L18.6145 14.0124L18.6305 14.0255L27.0929 4H24.265L17.3713 12.16L11.8968 4H4.48021L13.2425 17.0593L13.2414 17.0582L4 28H6.82792L14.4921 18.9215L20.5834 28H28ZM10.7763 6.18182L23.9449 25.8182H21.7039L8.52468 6.18182H10.7763Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GitHubIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M16 2C8.27 2 2 8.27 2 16C2 22.18 5.99 27.4 11.59 29.21C12.29 29.34 12.55 28.92 12.55 28.55C12.55 28.22 12.54 27.42 12.54 26.39C8.66 27.18 7.83 24.46 7.83 24.46C7.19 22.82 6.27 22.41 6.27 22.41C5.01 21.55 6.37 21.57 6.37 21.57C7.77 21.66 8.51 23 8.51 23C9.76 25.13 11.78 24.51 12.59 24.16C12.71 23.27 13.07 22.65 13.46 22.31C10.36 21.97 7.1 20.78 7.1 15.41C7.1 13.86 7.65 12.6 8.54 11.61C8.4 11.27 7.91 9.85 8.68 7.94C8.68 7.94 9.86 7.56 12.53 9.36C13.65 9.05 14.82 8.9 15.99 8.89C17.16 8.9 18.34 9.05 19.46 9.36C22.13 7.56 23.31 7.94 23.31 7.94C24.08 9.85 23.59 11.27 23.45 11.61C24.34 12.6 24.89 13.86 24.89 15.41C24.89 20.79 21.62 21.96 18.51 22.3C19 22.71 19.46 23.51 19.46 24.74C19.46 26.5 19.45 27.93 19.45 28.55C19.45 28.93 19.71 29.36 20.42 29.21C26.02 27.4 30 22.18 30 16C30 8.27 23.73 2 16 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

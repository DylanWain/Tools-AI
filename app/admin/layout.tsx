import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

// noindex so crawlers + the site's existing SEO surfaces never expose
// the admin URL. The page itself is also gated by Supabase sign-in +
// tier='admin' server-side, so this is defense-in-depth.
export const metadata: Metadata = {
  title: "Admin · Veronum",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}

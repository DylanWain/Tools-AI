/**
 * Site-wide Open Graph / social card. Next auto-wires this as og:image
 * (+ twitter:image) for every route, so sharing thetoolswebsite.com on
 * LinkedIn / X / iMessage shows the Veronum V on a dark card — not a
 * random photo scraped from the page.
 *
 * Embeds the real logo (public/veronum-icon.png) as a data URI so the
 * static generation doesn't depend on a network fetch at build time.
 */
import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
export const alt = "Veronum — every LLM, one workspace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const logo = readFileSync(join(process.cwd(), "public/veronum-icon.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#171717",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={250} height={250} style={{ borderRadius: 54 }} />
        <div style={{ marginTop: 54, fontSize: 70, color: "#e8e6df", fontWeight: 600, letterSpacing: -1 }}>
          Every LLM, one workspace.
        </div>
        <div style={{ marginTop: 22, fontSize: 30, color: "#d97757" }}>
          3.5× faster than Claude alone · thetoolswebsite.com
        </div>
      </div>
    ),
    { ...size },
  );
}

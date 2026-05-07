/**
 * PlatformsStrip — single horizontal row of host-app names + glyphs.
 * Sits right below the hero so the "any platform" promise is grounded
 * before the demos begin.
 *
 * Each glyph is a small inline SVG approximation of the host app's
 * recognizable mark (no logo files, no licensing concerns). Names
 * label them so users without strong visual recall still recognize.
 */

const PLATFORMS = [
  { name: "Claude", glyph: "claude" as const },
  { name: "Cursor", glyph: "cursor" as const },
  { name: "Warp", glyph: "warp" as const },
  { name: "VS Code", glyph: "vscode" as const },
  { name: "Zed", glyph: "zed" as const },
];

export function PlatformsStrip() {
  return (
    <section
      id="platforms"
      className="u-container pb-12 lg:pb-16 -mt-2"
      aria-label="Supported platforms"
    >
      <div className="flex flex-col items-center gap-5 lg:gap-7">
        <div className="font-mono text-[12px] uppercase tracking-[0.10em] text-ink-faded">
          Works on
        </div>
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-5 lg:gap-x-12">
          {PLATFORMS.map((p) => (
            <li
              key={p.name}
              className="flex items-center gap-2.5 text-ink"
              title={p.name}
            >
              <Glyph kind={p.glyph} />
              <span className="text-[15px] font-medium">{p.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Glyph({
  kind,
}: {
  kind: "claude" | "cursor" | "warp" | "vscode" | "zed";
}) {
  const size = 22;
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  } as const;

  switch (kind) {
    case "claude":
      // Anthropic Claude — stylized "A" / asterisk burst
      return (
        <svg {...common} fill="#cc785c">
          <path d="M12 2L21.5 21h-3.4l-1.7-3.8H7.6L5.9 21H2.5L12 2Zm0 6.4L8.9 14.5h6.2L12 8.4Z" />
        </svg>
      );
    case "cursor":
      // Cursor — angular concentric chevron
      return (
        <svg {...common} fill="none" stroke="#1a1a18" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
          <path d="M4 5l8 14 3-7 7-3z" />
        </svg>
      );
    case "warp":
      // Warp — squared bracket with pixel
      return (
        <svg {...common} fill="none" stroke="#1a1a18" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="M8 10l3 2-3 2M14 14h2.5" />
        </svg>
      );
    case "vscode":
      // VS Code — angled square / pivot
      return (
        <svg {...common} fill="none" stroke="#1a1a18" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
          <path d="M16.5 3 5 12l11.5 9 4-2V5l-4-2Z" />
          <path d="M5 12l11.5 7" />
        </svg>
      );
    case "zed":
      // Zed — rotated diamond with a line, recognizable hint
      return (
        <svg {...common} fill="none" stroke="#1a1a18" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
          <path d="M12 3 21 12l-9 9-9-9 9-9Z" />
          <path d="M8 12h8" />
        </svg>
      );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * LandingLogo — Tools AI globe logo spinning counter-clockwise.
 *
 * Uses the user's icon (6).svg globe design. The corner stars from the raw
 * icon are DROPPED so the site's live starfield shows through the logo's
 * background. Only the globe itself renders, and it rotates CCW.
 * ═══════════════════════════════════════════════════════════════════════ */
export default function LandingLogo({
  size = 88,
  withFrame = false,
}: {
  size?: number;
  withFrame?: boolean; // true = show rounded-square dark frame (like the app icon)
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "inline-block",
        position: "relative",
      }}
    >
      <svg
        viewBox="0 0 680 680"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
        aria-label="Tools AI"
        role="img"
      >
        {/* Optional frame — off by default so the page's starfield shows through */}
        {withFrame && (
          <rect width="680" height="680" rx="130" fill="#080810" />
        )}

        {/* Spinning globe group. Rotates counter-clockwise around the globe center (340, 340). */}
        <g className="tai-logo-spin" style={{ transformOrigin: "340px 340px" }}>
          {/* Base sphere */}
          <circle cx="340" cy="340" r="318" fill="#e8e8e8" />
          {/* Back hemisphere shading */}
          <path d="M340,22 A318,318 0 0,1 658,340 A318,318 0 0,1 340,658 A318,318 0 0,0 340,22Z" fill="#909090" />
          {/* Front-right quadrant shadow */}
          <path d="M340,340 L658,340 A318,318 0 0,1 340,658 Z" fill="#404040" />
          {/* Deepest shadow quadrant */}
          <path d="M340,340 L564,564 A318,318 0 0,1 248,652 Z" fill="#1a1a1a" />

          {/* Latitude / longitude grid */}
          <ellipse cx="340" cy="340" rx="318" ry="96" fill="none" stroke="#080810" strokeWidth="9" />
          <ellipse cx="340" cy="206" rx="265" ry="80" fill="none" stroke="#080810" strokeWidth="9" />
          <ellipse cx="340" cy="474" rx="265" ry="80" fill="none" stroke="#080810" strokeWidth="9" />
          <line x1="340" y1="22" x2="340" y2="658" stroke="#080810" strokeWidth="9" />
          <line x1="22" y1="340" x2="658" y2="340" stroke="#080810" strokeWidth="9" />

          {/* Specular highlight — top-left shine */}
          <ellipse
            cx="226"
            cy="188"
            rx="96"
            ry="62"
            fill="#ffffff"
            opacity="0.18"
            transform="rotate(-30 226 188)"
          />
        </g>

        {/* STATIC outer ring highlight — stays fixed while the globe spins */}
        <circle
          cx="340"
          cy="340"
          r="318"
          fill="none"
          stroke="#ffffff"
          strokeWidth="11"
          opacity="0.9"
        />
      </svg>

      <style>{`
        .tai-logo-spin {
          transform-origin: 340px 340px;
          animation: taiSpinCCW 40s linear infinite;
        }
        @keyframes taiSpinCCW {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .tai-logo-spin { animation: none; }
        }
      `}</style>
    </div>
  );
}

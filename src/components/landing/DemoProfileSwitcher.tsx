/* ═══════════════════════════════════════════════════════════════════════════
 * DemoProfileSwitcher — 8 curated profiles with icon, tagline, extensions
 *
 * Cycles through profiles, highlighting each in turn. When highlighted,
 * expands to show the full extension list.
 * ═══════════════════════════════════════════════════════════════════════ */
"use client";
import { useEffect, useState, useRef } from "react";
import { useInView } from "framer-motion";

const PROFILES = [
  {
    id: "web-dev", name: "Web Developer",
    tagline: "Ship fast, ship clean",
    extensions: ["ESLint", "Prettier", "Tailwind CSS", "GitLens", "Auto Rename Tag", "Live Server"],
  },
  {
    id: "researcher", name: "Researcher",
    tagline: "Think deeply, write clearly",
    extensions: ["Markdown All in One", "LaTeX Workshop", "Foam", "PDF Viewer", "Spell Checker", "markdownlint", "Markdown Preview"],
  },
  {
    id: "vibe-coder", name: "Vibe Coder",
    tagline: "Just describe it, AI builds it",
    extensions: ["Prettier"],
  },
  {
    id: "student", name: "Student",
    tagline: "Learn by building",
    extensions: ["Error Lens", "Better Comments", "Code Runner", "Prettier", "Spell Checker"],
  },
  {
    id: "founder", name: "Founder",
    tagline: "Ship the MVP, not perfection",
    extensions: ["REST Client", "DotENV", "Prettier"],
  },
  {
    id: "data-science", name: "Data Scientist",
    tagline: "From data to insight",
    extensions: ["Python", "Jupyter", "Rainbow CSV", "Excel Viewer", "Ruff"],
  },
  {
    id: "ai-researcher", name: "AI Researcher",
    tagline: "Build models, run experiments",
    extensions: ["Python", "Jupyter", "Ruff", "Rainbow CSV", "Markdown Preview"],
  },
  {
    id: "designer", name: "Designer",
    tagline: "Design meets code",
    extensions: ["Tailwind CSS", "Color Highlight", "SVG Preview", "Prettier", "CSS Peek"],
  },
];

export default function DemoProfileSwitcher() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: false });
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const iv = setInterval(() => {
      setActiveIdx(i => (i + 1) % PROFILES.length);
    }, 2800);
    return () => clearInterval(iv);
  }, [inView]);

  return (
    <div ref={ref} style={frameStyle}>
      <div style={chromeStyle}>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ ...dotStyle, background: "#ff5f57" }} />
          <span style={{ ...dotStyle, background: "#febc2e" }} />
          <span style={{ ...dotStyle, background: "#28c840" }} />
        </div>
        <div style={titleStyle}>Profile Setup — 8 curated loadouts</div>
        <div style={{ width: 52 }} />
      </div>

      <div style={bodyStyle}>
        <div style={heroTextStyle}>
          <div style={kickerStyle}>FIRST LAUNCH</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>What kind of work do you do?</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
            Pick a profile and we&rsquo;ll install the right extensions automatically.
          </div>
        </div>

        <div style={gridStyle}>
          {PROFILES.map((p, i) => {
            const active = i === activeIdx;
            return (
              <div
                key={p.id}
                style={{
                  ...cardStyle,
                  border: active ? "1px solid #EA580C" : "1px solid rgba(255,255,255,0.08)",
                  background: active ? "rgba(234,88,12,0.08)" : "#14142a",
                  boxShadow: active ? "0 0 24px rgba(234,88,12,0.2)" : "none",
                  transform: active ? "scale(1.02)" : "scale(1)",
                }}
              >
                <div style={cardHeaderStyle}>
                  <div style={{
                    ...iconStyle,
                    background: active ? "#EA580C" : "rgba(255,255,255,0.06)",
                    color: active ? "#fff" : "rgba(255,255,255,0.7)",
                  }}>
                    {p.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={cardNameStyle}>{p.name}</div>
                    <div style={taglineStyle}>{p.tagline}</div>
                  </div>
                  <div style={extCountStyle}>{p.extensions.length} tools</div>
                </div>
                {active && (
                  <div style={extListStyle}>
                    {p.extensions.map(e => (
                      <div key={e} style={extItemStyle}>
                        <span style={checkStyle}>✓</span> {e}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes slideInUp { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}

const frameStyle: React.CSSProperties = {
  background: "#0f0f1a",
  borderRadius: 12, overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
  fontFamily: 'Inter, sans-serif',
  color: "#ededec",
  width: "100%",
  maxWidth: 1100,
  margin: "0 auto",
};
const chromeStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "10px 14px",
  background: "#1a1a2e",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};
const dotStyle: React.CSSProperties = { width: 10, height: 10, borderRadius: "50%" };
const titleStyle: React.CSSProperties = { fontSize: 12, color: "rgba(255,255,255,0.55)" };
const bodyStyle: React.CSSProperties = {
  padding: 20, display: "flex", flexDirection: "column", gap: 18,
};
const heroTextStyle: React.CSSProperties = {
  textAlign: "center", padding: "8px 0",
};
const kickerStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: 1, textTransform: "uppercase",
  color: "#EA580C", fontWeight: 600, marginBottom: 8,
};
const gridStyle: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10,
};
const cardStyle: React.CSSProperties = {
  padding: 12, borderRadius: 10,
  transition: "all 0.4s cubic-bezier(0.19, 1, 0.22, 1)",
  display: "flex", flexDirection: "column", gap: 8,
  minHeight: 72,
};
const cardHeaderStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
};
const iconStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 14, fontWeight: 700, flexShrink: 0,
  transition: "all 0.3s",
};
const cardNameStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: "#fff",
};
const taglineStyle: React.CSSProperties = {
  fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 1,
};
const extCountStyle: React.CSSProperties = {
  fontSize: 10, color: "rgba(255,255,255,0.4)",
  padding: "2px 6px", background: "rgba(255,255,255,0.04)",
  borderRadius: 4, flexShrink: 0,
};
const extListStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 3,
  paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.08)",
  animation: "slideInUp 0.3s ease-out",
};
const extItemStyle: React.CSSProperties = {
  fontSize: 11, color: "rgba(255,255,255,0.75)",
  display: "flex", alignItems: "center", gap: 6,
};
const checkStyle: React.CSSProperties = {
  color: "#40c977", fontSize: 10, fontWeight: 700,
};

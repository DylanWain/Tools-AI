/* ═══════════════════════════════════════════════════════════════════════════
 * DemoDiffReview — side-by-side diff with red/green highlights
 *
 * Shows a file diff with typical accept/reject flow. Loops through
 * unreviewed → accepting → next file.
 * ═══════════════════════════════════════════════════════════════════════ */
"use client";
import { useEffect, useState, useRef } from "react";
import { useInView } from "framer-motion";

const FILES = [
  {
    name: "src/components/Hero.tsx",
    lines: [
      { n: 12, type: "ctx", text: 'export function Hero() {' },
      { n: 13, type: "ctx", text: '  return (' },
      { n: 14, type: "del", text: '    <div className="bg-white text-black">' },
      { n: 14, type: "add", text: '    <div className="bg-slate-950 text-white">' },
      { n: 15, type: "ctx", text: '      <h1>Welcome</h1>' },
      { n: 16, type: "del", text: '      <p>Get started today</p>' },
      { n: 16, type: "add", text: '      <p className="text-slate-400">Get started in seconds</p>' },
      { n: 17, type: "ctx", text: '    </div>' },
    ],
  },
  {
    name: "src/styles/theme.css",
    lines: [
      { n: 3, type: "ctx", text: ':root {' },
      { n: 4, type: "del", text: '  --bg: #ffffff;' },
      { n: 4, type: "add", text: '  --bg: #0a0a14;' },
      { n: 5, type: "del", text: '  --fg: #000000;' },
      { n: 5, type: "add", text: '  --fg: #ededec;' },
      { n: 6, type: "add", text: '  --accent: #EA580C;' },
      { n: 7, type: "ctx", text: '}' },
    ],
  },
];

const PHASES = [
  { name: "showing",  duration: 3500 },
  { name: "accepted", duration: 1200 },
  { name: "swap",     duration: 400 },
];

export default function DemoDiffReview() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: false });
  const [phase, setPhase] = useState("showing");
  const [fileIdx, setFileIdx] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    let pIdx = 0;

    const run = () => {
      if (cancelled) return;
      const p = PHASES[pIdx];
      setPhase(p.name);
      setTimeout(() => {
        if (cancelled) return;
        pIdx = (pIdx + 1) % PHASES.length;
        if (pIdx === 0) setFileIdx(i => (i + 1) % FILES.length);
        run();
      }, p.duration);
    };

    run();
    return () => { cancelled = true; };
  }, [inView]);

  const file = FILES[fileIdx];
  const totalFiles = FILES.length;
  const remaining = phase === "accepted" ? totalFiles - fileIdx - 1 : totalFiles - fileIdx;

  return (
    <div ref={ref} style={frameStyle}>
      <div style={chromeStyle}>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ ...dotStyle, background: "#ff5f57" }} />
          <span style={{ ...dotStyle, background: "#febc2e" }} />
          <span style={{ ...dotStyle, background: "#28c840" }} />
        </div>
        <div style={titleStyle}>Diff Review — {file.name}</div>
        <div style={{ width: 52 }} />
      </div>

      <div style={reviewHeaderStyle}>
        <div style={reviewCountStyle}>
          <span style={reviewDotStyle} />
          {remaining} file{remaining === 1 ? "" : "s"} to review
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={acceptBtnStyle}>✓ Accept</div>
          <div style={rejectBtnStyle}>✕ Reject</div>
          <div style={allBtnStyle}>Accept All</div>
        </div>
      </div>

      <div style={bodyStyle}>
        <div style={fileNameBarStyle}>
          <span style={{ color: "#EA580C" }}>▸</span> {file.name}
          {phase === "accepted" && (
            <span style={acceptedBadgeStyle}>✓ Accepted</span>
          )}
        </div>
        <div style={diffStyle}>
          {file.lines.map((line, i) => (
            <div
              key={`${fileIdx}-${i}`}
              style={{
                ...diffLineStyle,
                background:
                  line.type === "add" ? "rgba(64, 201, 119, 0.15)" :
                  line.type === "del" ? "rgba(255, 103, 100, 0.15)" :
                  "transparent",
                opacity: phase === "accepted" && line.type === "del" ? 0.3 : 1,
                transition: "opacity 0.4s",
              }}
            >
              <span style={lineNumStyle}>{line.n}</span>
              <span style={signStyle}>
                {line.type === "add" ? "+" : line.type === "del" ? "−" : " "}
              </span>
              <span style={{
                color:
                  line.type === "add" ? "#40c977" :
                  line.type === "del" ? "#ff6764" :
                  "rgba(255,255,255,0.7)",
              }}>{line.text}</span>
            </div>
          ))}
        </div>
      </div>
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
};
const chromeStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "10px 14px",
  background: "#1a1a2e",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};
const dotStyle: React.CSSProperties = { width: 10, height: 10, borderRadius: "50%" };
const titleStyle: React.CSSProperties = { fontSize: 12, color: "rgba(255,255,255,0.55)" };
const reviewHeaderStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "10px 16px",
  background: "#14142a",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};
const reviewCountStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.8)",
};
const reviewDotStyle: React.CSSProperties = {
  width: 8, height: 8, borderRadius: "50%",
  background: "#EA580C",
};
const acceptBtnStyle: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 4,
  background: "rgba(64,201,119,0.15)", color: "#40c977",
  fontSize: 11, fontWeight: 600,
};
const rejectBtnStyle: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 4,
  background: "rgba(255,103,100,0.12)", color: "#ff6764",
  fontSize: 11, fontWeight: 600,
};
const allBtnStyle: React.CSSProperties = {
  padding: "4px 10px", borderRadius: 4,
  background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.8)",
  fontSize: 11, fontWeight: 600,
};
const bodyStyle: React.CSSProperties = {
  padding: 14, display: "flex", flexDirection: "column", gap: 8,
};
const fileNameBarStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  fontSize: 12, fontWeight: 500,
  color: "rgba(255,255,255,0.85)",
  fontFamily: 'Menlo, monospace',
};
const acceptedBadgeStyle: React.CSSProperties = {
  fontSize: 10, padding: "2px 8px",
  background: "rgba(64,201,119,0.15)", color: "#40c977",
  borderRadius: 4, fontWeight: 600,
  fontFamily: 'Inter, sans-serif',
  marginLeft: "auto",
};
const diffStyle: React.CSSProperties = {
  background: "#0a0a14",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: 6, padding: 8,
  fontFamily: 'Menlo, monospace', fontSize: 12, lineHeight: 1.6,
};
const diffLineStyle: React.CSSProperties = {
  display: "flex", gap: 12,
  padding: "1px 8px", borderRadius: 2,
};
const lineNumStyle: React.CSSProperties = {
  width: 28, color: "rgba(255,255,255,0.3)", textAlign: "right",
  flexShrink: 0, userSelect: "none",
};
const signStyle: React.CSSProperties = {
  width: 12, color: "rgba(255,255,255,0.5)", flexShrink: 0,
};

/* ═══════════════════════════════════════════════════════════════════════════
 * DemoLivePreview — animated replica of the Live Preview with inline AI edit
 *
 * Sequence: browser showing page (dark bg) → click floating edit button →
 *           overlay expands → user types "make the background cream and
 *           headline bigger" → "Working..." → page updates live (bg + size) →
 *           collapse back.
 * ═══════════════════════════════════════════════════════════════════════ */
"use client";
import { useEffect, useState, useRef } from "react";
import { useInView } from "framer-motion";

const PHASES = [
  { name: "idle",      duration: 1500 },
  { name: "clicking",  duration: 400 },
  { name: "expanded",  duration: 300 },
  { name: "typing",    duration: 3000 },
  { name: "working",   duration: 1800 },
  { name: "updated",   duration: 3500 },
  { name: "collapsed", duration: 1500 },
];

const PROMPT = "make the background cream and headline bigger";

export default function DemoLivePreview() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: false });
  const [phase, setPhase] = useState("idle");
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    let idx = 0;

    const run = () => {
      if (cancelled) return;
      const p = PHASES[idx];
      setPhase(p.name);

      if (p.name === "typing") {
        let i = 0;
        const iv = setInterval(() => {
          if (cancelled) { clearInterval(iv); return; }
          i++;
          setTyped(PROMPT.slice(0, i));
          if (i >= PROMPT.length) clearInterval(iv);
        }, 55);
      }
      if (p.name === "idle") {
        setTyped("");
      }

      setTimeout(() => {
        if (cancelled) return;
        idx = (idx + 1) % PHASES.length;
        run();
      }, p.duration);
    };

    run();
    return () => { cancelled = true; };
  }, [inView]);

  const overlayOpen = ["clicking", "expanded", "typing", "working"].includes(phase);
  const pageUpdated = ["updated", "collapsed"].includes(phase);

  return (
    <div ref={ref} style={frameStyle}>
      <div style={chromeStyle}>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ ...dotStyle, background: "#ff5f57" }} />
          <span style={{ ...dotStyle, background: "#febc2e" }} />
          <span style={{ ...dotStyle, background: "#28c840" }} />
        </div>
        <div style={urlBarStyle}>localhost:9173</div>
        <div style={{ width: 52 }} />
      </div>

      {/* Simulated browser page */}
      <div style={{
        ...pageStyle,
        background: pageUpdated ? "#f7f7f4" : "#0f0f1a",
        color: pageUpdated ? "#26251e" : "#ededec",
      }}>
        <div style={{
          fontSize: pageUpdated ? 64 : 36,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          marginBottom: 16,
          transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        }}>
          Ship fast with AI
        </div>
        <div style={{
          fontSize: 14,
          opacity: 0.7,
          maxWidth: 420,
          lineHeight: 1.5,
        }}>
          Build, edit, and deploy your site with natural language. No configuration required.
        </div>
        <div style={{
          marginTop: 22,
          display: "flex", gap: 10,
        }}>
          <div style={{
            padding: "8px 18px",
            borderRadius: 99,
            background: pageUpdated ? "#26251e" : "#EA580C",
            color: "#fff",
            fontSize: 13, fontWeight: 500,
          }}>Download</div>
          <div style={{
            padding: "8px 18px",
            borderRadius: 99,
            border: `1px solid ${pageUpdated ? "rgba(38,37,30,0.2)" : "rgba(255,255,255,0.2)"}`,
            fontSize: 13, fontWeight: 500,
          }}>Learn more</div>
        </div>

        {/* Floating edit button / overlay */}
        <div style={{
          position: "absolute",
          bottom: 16,
          right: 16,
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}>
          {!overlayOpen ? (
            <div style={fabStyle}>⚡</div>
          ) : (
            <div style={overlayStyle}>
              <div style={overlayTitleStyle}>
                <span>⚡</span>
                <span>Edit Live</span>
              </div>
              <div style={overlayHintStyle}>Describe changes — AI updates your code instantly</div>
              <div style={overlayInputStyle}>
                {typed || <span style={{ color: "#666" }}>Make the background red...</span>}
                {phase === "typing" && typed.length < PROMPT.length && <span style={caretStyle} />}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{
                  ...applyBtnStyle,
                  opacity: phase === "working" ? 0.6 : 1,
                }}>
                  {phase === "working" ? "Working…" : "Apply Changes"}
                </div>
                <div style={reloadBtnStyle}>⟳</div>
              </div>
              {phase === "working" && (
                <div style={statusStyle}>
                  <span style={spinnerStyle} />
                  <span>Updating 2 files…</span>
                </div>
              )}
              {phase === "updated" && (
                <div style={{ ...statusStyle, color: "#40c977" }}>
                  ✓ Updated 2 files · reloading…
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const frameStyle: React.CSSProperties = {
  background: "#0f0f1a",
  borderRadius: 12,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
  fontFamily: 'Inter, -apple-system, sans-serif',
  color: "#ededec",
  width: "100%",
  maxWidth: 1000,
  margin: "0 auto",
};
const chromeStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 14,
  padding: "10px 14px",
  background: "#1a1a2e",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};
const dotStyle: React.CSSProperties = { width: 10, height: 10, borderRadius: "50%" };
const urlBarStyle: React.CSSProperties = {
  flex: 1, background: "rgba(255,255,255,0.05)",
  borderRadius: 6, padding: "4px 12px",
  fontSize: 12, color: "rgba(255,255,255,0.7)",
  fontFamily: 'Menlo, monospace', textAlign: "center",
};
const pageStyle: React.CSSProperties = {
  minHeight: 340, padding: "48px 48px 60px",
  position: "relative",
  transition: "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
  display: "flex", flexDirection: "column",
};
const fabStyle: React.CSSProperties = {
  width: 44, height: 44, borderRadius: "50%",
  background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
  color: "#fff", fontSize: 20,
  display: "flex", alignItems: "center", justifyContent: "center",
  boxShadow: "0 4px 20px rgba(124,58,237,.5)",
  cursor: "pointer",
};
const overlayStyle: React.CSSProperties = {
  width: 320, padding: 14,
  background: "#1e1e1e", color: "#fff",
  border: "1px solid #444",
  borderRadius: 12,
  boxShadow: "0 8px 40px rgba(0,0,0,.6)",
  display: "flex", flexDirection: "column", gap: 8,
  animation: "slideIn 0.3s ease-out",
};
const overlayTitleStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6,
  fontSize: 12, fontWeight: 700, color: "#fff",
};
const overlayHintStyle: React.CSSProperties = {
  fontSize: 10, color: "#888",
};
const overlayInputStyle: React.CSSProperties = {
  minHeight: 52, padding: "8px 10px",
  background: "#2d2d2d", border: "1px solid #555",
  borderRadius: 6, fontSize: 12,
  color: "#ccc", fontFamily: 'Inter, sans-serif',
  display: "flex", alignItems: "flex-start",
};
const applyBtnStyle: React.CSSProperties = {
  flex: 1, padding: 8, borderRadius: 6,
  background: "#7c3aed", color: "#fff",
  fontSize: 12, fontWeight: 600,
  textAlign: "center", cursor: "pointer",
};
const reloadBtnStyle: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 6,
  background: "#333", color: "#ccc",
  fontSize: 11,
  border: "1px solid #555", cursor: "pointer",
};
const statusStyle: React.CSSProperties = {
  fontSize: 10, color: "#a78bfa",
  display: "flex", alignItems: "center", gap: 6,
};
const spinnerStyle: React.CSSProperties = {
  width: 10, height: 10, borderRadius: "50%",
  border: "2px solid rgba(255,255,255,0.1)",
  borderTopColor: "#a78bfa",
  animation: "spin 0.8s linear infinite", display: "inline-block",
};
const caretStyle: React.CSSProperties = {
  display: "inline-block", width: 2, height: 14,
  background: "#7c3aed", marginLeft: 2,
  animation: "blink 1s infinite",
};

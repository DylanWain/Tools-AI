/* ═══════════════════════════════════════════════════════════════════════════
 * DemoContextLibrary — file upload + analyze & suggest
 *
 * Sequence: empty library → drag file in → appears in list →
 *           click Analyze → AI analyzes → suggestion cards appear
 * ═══════════════════════════════════════════════════════════════════════ */
"use client";
import { useEffect, useState, useRef } from "react";
import { useInView } from "framer-motion";

const FILES = [
  { name: "brand-guide.pdf", size: "2.1 MB", kind: "pdf" },
  { name: "api-spec.json", size: "34 KB", kind: "data" },
  { name: "design-tokens.json", size: "12 KB", kind: "data" },
];

const SUGGESTIONS = [
  "Apply brand primary color #EA580C to all CTAs",
  "Use API spec to auto-generate TypeScript types",
  "Replace inline values with design tokens",
  "Add spec-compliant error handling for 4xx responses",
];

const PHASES = [
  { name: "empty",       duration: 1500 },
  { name: "uploading",   duration: 1800 },
  { name: "uploaded",    duration: 1500 },
  { name: "analyzing",   duration: 2200 },
  { name: "suggestions", duration: 4500 },
];

export default function DemoContextLibrary() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: false });
  const [phase, setPhase] = useState("empty");
  const [filesShown, setFilesShown] = useState(0);
  const [suggestionsShown, setSuggestionsShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    let idx = 0;

    const run = () => {
      if (cancelled) return;
      const p = PHASES[idx];
      setPhase(p.name);

      if (p.name === "uploading") {
        let i = 0;
        const iv = setInterval(() => {
          if (cancelled) { clearInterval(iv); return; }
          i++;
          setFilesShown(i);
          if (i >= FILES.length) clearInterval(iv);
        }, 500);
      }
      if (p.name === "suggestions") {
        let i = 0;
        const iv = setInterval(() => {
          if (cancelled) { clearInterval(iv); return; }
          i++;
          setSuggestionsShown(i);
          if (i >= SUGGESTIONS.length) clearInterval(iv);
        }, 650);
      }
      if (p.name === "empty") {
        setFilesShown(0);
        setSuggestionsShown(0);
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

  const showFiles = ["uploaded", "analyzing", "suggestions"].includes(phase);
  const showSuggestions = phase === "suggestions";

  return (
    <div ref={ref} style={frameStyle}>
      <div style={chromeStyle}>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ ...dotStyle, background: "#ff5f57" }} />
          <span style={{ ...dotStyle, background: "#febc2e" }} />
          <span style={{ ...dotStyle, background: "#28c840" }} />
        </div>
        <div style={titleStyle}>Context Library</div>
        <div style={{ width: 52 }} />
      </div>

      <div style={bodyStyle}>
        <div style={colStyle}>
          <div style={colHeaderStyle}>
            UPLOADED FILES
            {(phase === "uploading" || showFiles) && (
              <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>
                · {filesShown} of {FILES.length}
              </span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            {phase === "empty" || phase === "uploading" ? (
              <div style={{
                ...dropzoneStyle,
                borderColor: phase === "uploading" ? "#EA580C" : "rgba(255,255,255,0.15)",
                background: phase === "uploading" ? "rgba(234,88,12,0.06)" : "transparent",
              }}>
                {phase === "uploading" ? (
                  <>
                    <div style={uploadIconStyle}>↑</div>
                    <div>Uploading {filesShown}/{FILES.length}…</div>
                  </>
                ) : (
                  <>
                    <div style={{ ...uploadIconStyle, color: "rgba(255,255,255,0.3)" }}>+</div>
                    <div>Drop files or click to add</div>
                  </>
                )}
              </div>
            ) : null}
            {showFiles && FILES.slice(0, filesShown).map((f, i) => (
              <div key={f.name} style={{ ...fileRowStyle, animation: "slideInUp 0.3s both" }}>
                <div style={{ ...fileIconStyle, background: f.kind === "pdf" ? "#ff6764" : "#4285F4" }}>
                  {f.kind === "pdf" ? "P" : "J"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={fileNameStyle}>{f.name}</div>
                  <div style={fileMetaStyle}>{f.size} · added just now</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{
            ...analyzeBtnStyle,
            opacity: showFiles ? 1 : 0.5,
            background: phase === "analyzing" ? "#14142a" : "#EA580C",
            color: phase === "analyzing" ? "rgba(255,255,255,0.55)" : "#fff",
          }}>
            {phase === "analyzing" ? (
              <>
                <span style={spinnerStyle} />
                <span>Analyzing…</span>
              </>
            ) : (
              <span>✨ Analyze & Suggest</span>
            )}
          </div>
        </div>

        <div style={colStyle}>
          <div style={colHeaderStyle}>SUGGESTIONS</div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            {showSuggestions ? (
              SUGGESTIONS.slice(0, suggestionsShown).map((s, i) => (
                <div key={i} style={{ ...suggestionStyle, animation: "slideInUp 0.3s both" }}>
                  <span style={suggNumStyle}>{i + 1}</span>
                  <span style={{ fontSize: 12, lineHeight: 1.4 }}>{s}</span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                {phase === "analyzing" ? "Analyzing your files against the workspace…" : "Upload files to get AI-powered suggestions."}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInUp { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @keyframes spin { to { transform: rotate(360deg); } }
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
  padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
};
const colStyle: React.CSSProperties = {
  background: "#14142a", padding: 14, borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.06)",
  display: "flex", flexDirection: "column", gap: 10,
  minHeight: 300,
};
const colHeaderStyle: React.CSSProperties = {
  fontSize: 9, letterSpacing: 0.5, textTransform: "uppercase",
  color: "rgba(255,255,255,0.45)", fontWeight: 600,
  display: "flex", gap: 6,
};
const dropzoneStyle: React.CSSProperties = {
  padding: 24, borderRadius: 6,
  border: "1.5px dashed rgba(255,255,255,0.15)",
  textAlign: "center", fontSize: 11,
  color: "rgba(255,255,255,0.55)",
  transition: "all 0.3s",
};
const uploadIconStyle: React.CSSProperties = {
  fontSize: 22, marginBottom: 4, color: "#EA580C",
};
const fileRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  padding: 8, borderRadius: 6,
  background: "rgba(255,255,255,0.03)",
  marginBottom: 4,
};
const fileIconStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6,
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
};
const fileNameStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, overflow: "hidden",
  textOverflow: "ellipsis", whiteSpace: "nowrap",
};
const fileMetaStyle: React.CSSProperties = {
  fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1,
};
const analyzeBtnStyle: React.CSSProperties = {
  padding: 10, borderRadius: 6,
  textAlign: "center", fontSize: 12, fontWeight: 600,
  background: "#EA580C", color: "#fff",
  transition: "all 0.3s",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
};
const spinnerStyle: React.CSSProperties = {
  width: 12, height: 12, borderRadius: "50%",
  border: "2px solid rgba(255,255,255,0.15)",
  borderTopColor: "#EA580C",
  animation: "spin 0.9s linear infinite",
};
const suggestionStyle: React.CSSProperties = {
  display: "flex", gap: 10, padding: 10,
  background: "rgba(64,201,119,0.06)",
  border: "1px solid rgba(64,201,119,0.15)",
  borderRadius: 6,
};
const suggNumStyle: React.CSSProperties = {
  width: 20, height: 20, borderRadius: "50%",
  background: "#40c977", color: "#0a0a14",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 10, fontWeight: 700, flexShrink: 0,
};

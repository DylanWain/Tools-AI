/* ═══════════════════════════════════════════════════════════════════════════
 * DemoAIBuilder — animated replica of the real Tools AI Builder panel
 *
 * Loops a scripted sequence: empty composer → user types prompt →
 * clicks Parallel → all 5 models start streaming → Phase 2 refinement →
 * file blocks appear. Matches the colors and layout from
 * /Applications/Tools AI.app/Contents/Resources/app/extensions/tools-ai/media/webview.html
 * ═══════════════════════════════════════════════════════════════════════ */
"use client";
import { useEffect, useState, useRef } from "react";
import { useInView } from "framer-motion";

const MODELS = [
  { id: "claude",     label: "Claude",      color: "#d97706", initial: "C" },
  { id: "chatgpt",    label: "GPT-4o",      color: "#10a37f", initial: "G" },
  { id: "gemini",     label: "Gemini",      color: "#4285F4", initial: "G" },
  { id: "grok",       label: "Grok",        color: "#888888", initial: "G" },
  { id: "perplexity", label: "Perplexity",  color: "#20808d", initial: "P" },
];

const STREAM_SNIPPETS: Record<string, string[]> = {
  claude:     ["Analyzing request...", "Building clean HTML structure", "Adding Tailwind styling", "Wiring up interactive elements"],
  chatgpt:    ["Planning architecture...", "Creating responsive layout", "Optimizing for performance", "Testing accessibility"],
  gemini:     ["Understanding intent...", "Drafting component tree", "Applying design tokens", "Finalizing markup"],
  grok:       ["Processing task...", "Generating boilerplate", "Adding interactivity", "Cleaning up output"],
  perplexity: ["Researching patterns...", "Checking best practices", "Writing semantic HTML", "Validating structure"],
};

const PHASES = [
  { name: "idle",       duration: 1500 },
  { name: "typing",     duration: 2800 },
  { name: "clicking",   duration: 700 },
  { name: "streaming1", duration: 5500 },
  { name: "phase2",     duration: 3500 },
  { name: "files",      duration: 3500 },
  { name: "done",       duration: 2500 },
];

const PROMPT_TEXT = "Build a landing page with hero and pricing";

export default function DemoAIBuilder() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: false });
  const [phase, setPhase] = useState("idle");
  const [typed, setTyped] = useState("");
  const [streams, setStreams] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    let phaseIdx = 0;

    const runPhase = () => {
      if (cancelled) return;
      const p = PHASES[phaseIdx];
      setPhase(p.name);

      if (p.name === "typing") {
        // Type the prompt character-by-character
        let i = 0;
        const typeInterval = setInterval(() => {
          if (cancelled) { clearInterval(typeInterval); return; }
          i++;
          setTyped(PROMPT_TEXT.slice(0, i));
          if (i >= PROMPT_TEXT.length) clearInterval(typeInterval);
        }, 55);
      }

      if (p.name === "streaming1") {
        // Start all models at once, advance their stream index on interval
        setStreams({ claude: 0, chatgpt: 0, gemini: 0, grok: 0, perplexity: 0 });
        const streamInterval = setInterval(() => {
          if (cancelled) { clearInterval(streamInterval); return; }
          setStreams(prev => {
            const next = { ...prev };
            for (const m of MODELS) {
              const snippets = STREAM_SNIPPETS[m.id];
              const cur = prev[m.id] ?? 0;
              if (cur < snippets.length - 1) {
                // Stagger each model a bit randomly
                if (Math.random() > 0.4) next[m.id] = cur + 1;
              }
            }
            return next;
          });
        }, 600);
        setTimeout(() => clearInterval(streamInterval), p.duration);
      }

      setTimeout(() => {
        if (cancelled) return;
        phaseIdx = (phaseIdx + 1) % PHASES.length;
        if (phaseIdx === 0) {
          // Reset everything before next loop
          setTyped("");
          setStreams({});
        }
        runPhase();
      }, p.duration);
    };

    runPhase();
    return () => { cancelled = true; };
  }, [inView]);

  const isPhase = (...names: string[]) => names.includes(phase);
  const modelsActive = isPhase("streaming1", "phase2", "files", "done");
  const phase2Active = isPhase("phase2", "files", "done");
  const filesShown = isPhase("files", "done");

  return (
    <div ref={ref} style={frameStyle}>
      {/* Window chrome */}
      <div style={chromeStyle}>
        <div style={dotRowStyle}>
          <span style={{ ...dotStyle, background: "#ff5f57" }} />
          <span style={{ ...dotStyle, background: "#febc2e" }} />
          <span style={{ ...dotStyle, background: "#28c840" }} />
        </div>
        <div style={titleStyle}>Tools AI — AI Builder</div>
        <div style={{ width: 52 }} />
      </div>

      {/* Body */}
      <div style={bodyStyle}>
        {/* Composer */}
        <div style={composerStyle}>
          <div style={composerLabelStyle}>MASTER TASK</div>
          <div style={inputStyle}>
            {typed || <span style={{ color: "#666" }}>Describe what to build...</span>}
            {isPhase("typing") && <span style={caretStyle} />}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <div style={{ ...modeBtnStyle, background: isPhase("clicking", "streaming1", "phase2", "files", "done") ? "#EA580C" : "transparent", color: isPhase("clicking", "streaming1", "phase2", "files", "done") ? "#fff" : "#aaa", borderColor: "#333" }}>
              Parallel
            </div>
            <div style={{ ...modeBtnStyle, borderColor: "#333" }}>Hierarchy</div>
            <div style={{ ...modeBtnStyle, borderColor: "#333" }}>Planner</div>
            <div style={{ flex: 1 }} />
            <div style={{ ...runBtnStyle, opacity: modelsActive ? 1 : 0.5 }}>
              {modelsActive ? "Running…" : "▶ Run"}
            </div>
          </div>
        </div>

        {/* Phase indicator */}
        {(modelsActive) && (
          <div style={phaseIndicatorStyle}>
            <div style={{ ...phasePillStyle, background: isPhase("streaming1") ? "#EA580C" : "#1a1a2e", color: isPhase("streaming1") ? "#fff" : "#666" }}>
              Phase 1: Parallel
            </div>
            <div style={{ width: 24, height: 1, background: "#333" }} />
            <div style={{ ...phasePillStyle, background: phase2Active ? "#EA580C" : "#1a1a2e", color: phase2Active ? "#fff" : "#666" }}>
              Phase 2: Shared context
            </div>
          </div>
        )}

        {/* Model cards grid */}
        <div style={cardsGridStyle}>
          {MODELS.map(m => {
            const streamIdx = streams[m.id] ?? -1;
            const snippets = STREAM_SNIPPETS[m.id];
            const active = modelsActive;
            const done = filesShown;
            return (
              <div key={m.id} style={{
                ...cardStyle,
                borderColor: active ? m.color : "#2a2a3a",
                opacity: active ? 1 : 0.45,
                boxShadow: active ? `0 0 24px ${m.color}22` : "none",
              }}>
                <div style={cardHeaderStyle}>
                  <div style={{ ...cardIconStyle, background: m.color }}>{m.initial}</div>
                  <div style={cardNameStyle}>{m.label}</div>
                  {done && <div style={doneTagStyle}>✓ Final</div>}
                  {active && !done && <div style={pulseStyle} />}
                </div>
                <div style={cardBodyStyle}>
                  {active ? (
                    <div style={streamTextStyle}>
                      {snippets.slice(0, Math.max(1, streamIdx + 1)).map((s, i) => (
                        <div key={i} style={{ opacity: i === streamIdx ? 1 : 0.55, marginBottom: 4 }}>
                          {s}{i === streamIdx && !done && <span style={caretStyle} />}
                        </div>
                      ))}
                      {done && phase2Active && (
                        <div style={{ marginTop: 8, color: m.color, fontSize: 10 }}>
                          ✓ Refined with shared context
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: "#555", fontSize: 11 }}>Waiting…</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* File blocks appearing */}
        {filesShown && (
          <div style={filesOutStyle}>
            <div style={fileBlockStyle}>
              <span style={{ color: "#40c977" }}>+</span>
              <span style={fileNameStyle}>index.html</span>
              <span style={fileMetaStyle}>42 lines</span>
            </div>
            <div style={{ ...fileBlockStyle, animationDelay: "0.2s" }}>
              <span style={{ color: "#40c977" }}>+</span>
              <span style={fileNameStyle}>styles.css</span>
              <span style={fileMetaStyle}>87 lines</span>
            </div>
            <div style={{ ...fileBlockStyle, animationDelay: "0.4s" }}>
              <span style={{ color: "#40c977" }}>+</span>
              <span style={fileNameStyle}>app.js</span>
              <span style={fileMetaStyle}>24 lines</span>
            </div>
            <div style={filesMessageStyle}>
              ✓ 3 files written to workspace
            </div>
          </div>
        )}
      </div>

      {/* Blink keyframe injection */}
      <style>{`
        @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
        @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.3); opacity: 1; } }
        @keyframes slideInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}

const frameStyle: React.CSSProperties = {
  background: "#0f0f1a",
  borderRadius: 12,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 24px 80px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.3)",
  fontFamily: 'Inter, -apple-system, sans-serif',
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
const dotRowStyle: React.CSSProperties = { display: "flex", gap: 6 };
const dotStyle: React.CSSProperties = { width: 10, height: 10, borderRadius: "50%", display: "block" };
const titleStyle: React.CSSProperties = { fontSize: 12, color: "rgba(255,255,255,0.55)" };
const bodyStyle: React.CSSProperties = { padding: 18, display: "flex", flexDirection: "column", gap: 14 };
const composerStyle: React.CSSProperties = {
  background: "#14142a",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  padding: 12,
};
const composerLabelStyle: React.CSSProperties = {
  fontSize: 9, letterSpacing: 0.5, textTransform: "uppercase",
  color: "rgba(255,255,255,0.4)", marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  fontSize: 14, minHeight: 24, color: "#fff",
  display: "flex", alignItems: "center",
};
const caretStyle: React.CSSProperties = {
  display: "inline-block", width: 2, height: 14, background: "#EA580C",
  marginLeft: 2, animation: "blink 1s infinite",
};
const modeBtnStyle: React.CSSProperties = {
  padding: "5px 12px", borderRadius: 4,
  border: "1px solid #2a2a3a", fontSize: 10, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: 0.5, cursor: "default",
  transition: "all 0.2s",
};
const runBtnStyle: React.CSSProperties = {
  padding: "6px 14px", borderRadius: 4,
  background: "#EA580C", color: "#fff", fontSize: 11, fontWeight: 600,
};
const phaseIndicatorStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 0, justifyContent: "center",
  padding: "4px 0",
};
const phasePillStyle: React.CSSProperties = {
  padding: "4px 12px", borderRadius: 99, fontSize: 10, fontWeight: 600,
  transition: "all 0.4s",
};
const cardsGridStyle: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8,
};
const cardStyle: React.CSSProperties = {
  background: "#14142a", borderRadius: 8, padding: 10,
  border: "1px solid #2a2a3a", transition: "all 0.4s",
  minHeight: 130, display: "flex", flexDirection: "column",
};
const cardHeaderStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
};
const cardIconStyle: React.CSSProperties = {
  width: 18, height: 18, borderRadius: 4,
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 9, fontWeight: 700, color: "#fff",
};
const cardNameStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, flex: 1,
};
const doneTagStyle: React.CSSProperties = {
  fontSize: 9, color: "#40c977", fontWeight: 600,
};
const pulseStyle: React.CSSProperties = {
  width: 6, height: 6, borderRadius: "50%", background: "#EA580C",
  animation: "pulse 1.5s infinite",
};
const cardBodyStyle: React.CSSProperties = {
  flex: 1, overflow: "hidden",
};
const streamTextStyle: React.CSSProperties = {
  fontSize: 10, lineHeight: 1.5, fontFamily: 'Menlo, monospace',
  color: "rgba(255,255,255,0.8)",
};
const filesOutStyle: React.CSSProperties = {
  padding: 12, background: "#14142a",
  border: "1px solid rgba(64,201,119,0.2)", borderRadius: 8,
  display: "flex", flexDirection: "column", gap: 4,
};
const fileBlockStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  fontFamily: 'Menlo, monospace', fontSize: 12,
  animation: "slideInUp 0.4s ease-out both",
};
const fileNameStyle: React.CSSProperties = {
  color: "#ededec", fontWeight: 500,
};
const fileMetaStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.4)", fontSize: 10, marginLeft: "auto",
};
const filesMessageStyle: React.CSSProperties = {
  marginTop: 6, fontSize: 11, color: "#40c977", fontWeight: 500,
};

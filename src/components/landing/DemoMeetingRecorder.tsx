/* ═══════════════════════════════════════════════════════════════════════════
 * DemoMeetingRecorder — animated replica of the Meeting detail panel
 *
 * Loops: record indicator pulsing → stop → Whisper transcribing →
 * transcript scrolls in with timestamps → Claude extracting →
 * numbered actionable items appear.
 * ═══════════════════════════════════════════════════════════════════════ */
"use client";
import { useEffect, useState, useRef } from "react";
import { useInView } from "framer-motion";

const TRANSCRIPT = [
  { t: "0:04", text: "Okay so we need to refactor the checkout flow." },
  { t: "0:11", text: "The current Stripe integration is too brittle." },
  { t: "0:18", text: "Let's move to Stripe Elements and add 3D Secure." },
  { t: "0:26", text: "Also, the error handling needs work — show a retry button." },
  { t: "0:33", text: "And we should log failed attempts to our analytics." },
  { t: "0:41", text: "Tomorrow I want to see a design mockup before we build it." },
];

const TASKS = [
  "Refactor Stripe integration to use Stripe Elements",
  "Add 3D Secure authentication support",
  "Improve error handling with retry button",
  "Log failed checkout attempts to analytics",
  "Create design mockup before implementation",
];

const PHASES = [
  { name: "idle",         duration: 1500 },
  { name: "recording",    duration: 2800 },
  { name: "stopped",      duration: 600 },
  { name: "transcribing", duration: 2000 },
  { name: "transcript",   duration: 5500 },
  { name: "extracting",   duration: 1800 },
  { name: "tasks",        duration: 4500 },
  { name: "done",         duration: 2500 },
];

export default function DemoMeetingRecorder() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: false });
  const [phase, setPhase] = useState("idle");
  const [visibleLines, setVisibleLines] = useState(0);
  const [visibleTasks, setVisibleTasks] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    let phaseIdx = 0;

    const runPhase = () => {
      if (cancelled) return;
      const p = PHASES[phaseIdx];
      setPhase(p.name);

      if (p.name === "transcript") {
        let i = 0;
        const iv = setInterval(() => {
          if (cancelled) { clearInterval(iv); return; }
          i++;
          setVisibleLines(i);
          if (i >= TRANSCRIPT.length) clearInterval(iv);
        }, 800);
      }
      if (p.name === "tasks") {
        let i = 0;
        const iv = setInterval(() => {
          if (cancelled) { clearInterval(iv); return; }
          i++;
          setVisibleTasks(i);
          if (i >= TASKS.length) clearInterval(iv);
        }, 750);
      }

      setTimeout(() => {
        if (cancelled) return;
        phaseIdx = (phaseIdx + 1) % PHASES.length;
        if (phaseIdx === 0) {
          setVisibleLines(0);
          setVisibleTasks(0);
        }
        runPhase();
      }, p.duration);
    };

    runPhase();
    return () => { cancelled = true; };
  }, [inView]);

  const showTranscript = ["transcript", "extracting", "tasks", "done"].includes(phase);
  const showTasks = ["tasks", "done"].includes(phase);

  return (
    <div ref={ref} style={frameStyle}>
      <div style={chromeStyle}>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ ...dotStyle, background: "#ff5f57" }} />
          <span style={{ ...dotStyle, background: "#febc2e" }} />
          <span style={{ ...dotStyle, background: "#28c840" }} />
        </div>
        <div style={titleStyle}>Meeting — Today, 2:14 PM · 47s</div>
        <div style={{ width: 52 }} />
      </div>

      <div style={bodyStyle}>
        {/* Top controls */}
        <div style={controlsStyle}>
          <div style={{
            ...recordBtnStyle,
            background: phase === "recording" ? "#DC2626" : "#1a1a2e",
            borderColor: phase === "recording" ? "#DC2626" : "#333",
          }}>
            <span style={{
              ...recordDotStyle,
              background: phase === "recording" ? "#fff" : "#DC2626",
              animation: phase === "recording" ? "pulse 1.5s infinite" : "none",
            }} />
            <span>{phase === "recording" ? "Recording…" : phase === "stopped" ? "Stopped" : "Record"}</span>
          </div>
          {phase === "recording" && (
            <div style={waveformStyle}>
              {Array.from({ length: 32 }).map((_, i) => (
                <div key={i} style={{
                  ...barStyle,
                  height: 6 + Math.abs(Math.sin(i * 0.4)) * 18,
                  animationDelay: `${i * 0.05}s`,
                }} />
              ))}
            </div>
          )}
        </div>

        {/* Processing indicator */}
        {(phase === "transcribing" || phase === "extracting") && (
          <div style={processingStyle}>
            <div style={spinnerStyle} />
            <span>{phase === "transcribing" ? "Transcribing with Whisper…" : "Extracting tasks with Claude…"}</span>
          </div>
        )}

        {/* Two-column: transcript + tasks */}
        <div style={twoColStyle}>
          {/* Transcript column */}
          <div style={colStyle}>
            <div style={colHeaderStyle}>TRANSCRIPT</div>
            <div style={transcriptStyle}>
              {showTranscript ? (
                TRANSCRIPT.slice(0, visibleLines).map((line, i) => (
                  <div key={i} style={{
                    ...lineStyle,
                    animation: "slideInUp 0.3s ease-out both",
                  }}>
                    <span style={timestampStyle}>{line.t}</span>
                    <span>{line.text}</span>
                  </div>
                ))
              ) : (
                <div style={{ color: "#555", fontSize: 11 }}>Waiting for recording…</div>
              )}
            </div>
          </div>

          {/* Tasks column */}
          <div style={colStyle}>
            <div style={colHeaderStyle}>ACTIONABLE ITEMS</div>
            <div style={tasksStyle}>
              {showTasks ? (
                TASKS.slice(0, visibleTasks).map((task, i) => (
                  <div key={i} style={{
                    ...taskStyle,
                    animation: "slideInUp 0.3s ease-out both",
                  }}>
                    <span style={taskNumStyle}>{i + 1}</span>
                    <span style={taskTextStyle}>{task}</span>
                  </div>
                ))
              ) : (
                <div style={{ color: "#555", fontSize: 11 }}>
                  {showTranscript ? "Waiting for analysis…" : "Not yet extracted"}
                </div>
              )}
            </div>
            {phase === "done" && (
              <div style={executeBtnStyle}>Execute all →</div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.5; } }
        @keyframes slideInUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes bar { 0%, 100% { opacity: 0.3; transform: scaleY(0.4); } 50% { opacity: 1; transform: scaleY(1); } }
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
  maxWidth: 1100,
  margin: "0 auto",
};
const chromeStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "10px 14px", background: "#1a1a2e",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};
const dotStyle: React.CSSProperties = { width: 10, height: 10, borderRadius: "50%" };
const titleStyle: React.CSSProperties = { fontSize: 12, color: "rgba(255,255,255,0.55)" };
const bodyStyle: React.CSSProperties = { padding: 18, display: "flex", flexDirection: "column", gap: 14 };
const controlsStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 14,
};
const recordBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "8px 16px", borderRadius: 6,
  border: "1px solid #333",
  fontSize: 12, fontWeight: 600,
  transition: "all 0.3s",
};
const recordDotStyle: React.CSSProperties = {
  width: 8, height: 8, borderRadius: "50%", display: "block",
};
const waveformStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 2,
  height: 24, flex: 1,
};
const barStyle: React.CSSProperties = {
  width: 3, background: "#EA580C", borderRadius: 99,
  animation: "bar 0.8s ease-in-out infinite",
};
const processingStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "10px 14px", background: "#14142a",
  border: "1px solid rgba(234,88,12,0.2)", borderRadius: 8,
  fontSize: 12, color: "rgba(255,255,255,0.8)",
};
const spinnerStyle: React.CSSProperties = {
  width: 14, height: 14, borderRadius: "50%",
  border: "2px solid rgba(255,255,255,0.1)",
  borderTopColor: "#EA580C",
  animation: "spin 1s linear infinite",
};
const twoColStyle: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14,
};
const colStyle: React.CSSProperties = {
  background: "#14142a", borderRadius: 8, padding: 14,
  border: "1px solid rgba(255,255,255,0.06)",
  minHeight: 240,
  display: "flex", flexDirection: "column",
};
const colHeaderStyle: React.CSSProperties = {
  fontSize: 9, letterSpacing: 0.5, textTransform: "uppercase",
  color: "rgba(255,255,255,0.4)", marginBottom: 10, fontWeight: 600,
};
const transcriptStyle: React.CSSProperties = {
  flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 6,
};
const lineStyle: React.CSSProperties = {
  display: "flex", gap: 10, fontSize: 12, lineHeight: 1.4,
  color: "rgba(255,255,255,0.9)",
};
const timestampStyle: React.CSSProperties = {
  color: "#EA580C", fontSize: 11, fontFamily: 'Menlo, monospace',
  fontWeight: 600, flexShrink: 0,
};
const tasksStyle: React.CSSProperties = {
  flex: 1, display: "flex", flexDirection: "column", gap: 8,
};
const taskStyle: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 10,
  padding: 8, background: "rgba(234,88,12,0.08)",
  border: "1px solid rgba(234,88,12,0.2)", borderRadius: 6,
};
const taskNumStyle: React.CSSProperties = {
  width: 18, height: 18, borderRadius: "50%",
  background: "#EA580C", color: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 10, fontWeight: 700, flexShrink: 0,
};
const taskTextStyle: React.CSSProperties = {
  fontSize: 12, lineHeight: 1.4, color: "rgba(255,255,255,0.9)",
};
const executeBtnStyle: React.CSSProperties = {
  marginTop: 10, padding: "8px 12px",
  background: "#EA580C", color: "#fff",
  borderRadius: 6, textAlign: "center",
  fontSize: 11, fontWeight: 600,
};

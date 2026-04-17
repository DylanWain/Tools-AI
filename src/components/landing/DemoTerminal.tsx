/* ═══════════════════════════════════════════════════════════════════════════
 * DemoTerminal — animated replica of the AI Terminal
 *
 * Sequence: zsh prompt → user types `ls` → output →
 *           prompt → types `what is this project` → AI response streams →
 *           prompt → types `build a dark mode toggle` → streaming code →
 *           green `+ dark-mode.js` file line.
 * Matches the real terminal's zsh prompt format: user@host dir %
 * ═══════════════════════════════════════════════════════════════════════ */
"use client";
import { useEffect, useState, useRef } from "react";
import { useInView } from "framer-motion";

type Line =
  | { kind: "prompt"; typed: string; full: string }
  | { kind: "output"; text: string }
  | { kind: "ai-thinking" }
  | { kind: "ai-response"; text: string; full: string }
  | { kind: "file-added"; name: string };

const SCRIPT = [
  { type: "cmd",   text: "ls" },
  { type: "out",   text: "app.js    index.html    README.md" },
  { type: "cmd",   text: "what is this project" },
  { type: "think" },
  { type: "ai",    text: "A simple Node.js HTTP server serving a\nstatic landing page. Express + static files." },
  { type: "cmd",   text: "build a dark mode toggle" },
  { type: "think" },
  { type: "ai",    text: "Creating dark mode toggle with localStorage\npersistence and smooth theme transition..." },
  { type: "file",  text: "dark-mode.js" },
  { type: "file",  text: "theme.css" },
] as const;

const PROMPT = "dylanwain@Dylans-Laptop project % ";
const BRAILLE = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];

export default function DemoTerminal() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: false });
  const [lines, setLines] = useState<Line[]>([]);
  const [currentTyping, setCurrentTyping] = useState<string | null>(null);
  const [brailleIdx, setBrailleIdx] = useState(0);

  // Braille spinner rotation
  useEffect(() => {
    const iv = setInterval(() => setBrailleIdx(i => (i + 1) % BRAILLE.length), 90);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    let stepIdx = 0;

    const runStep = async () => {
      if (cancelled) return;
      const step = SCRIPT[stepIdx];

      if (step.type === "cmd") {
        // Type the command char-by-char
        await typeInto(step.text, setCurrentTyping, 55, () => cancelled);
        if (cancelled) return;
        setLines(prev => [...prev, { kind: "prompt", typed: step.text, full: step.text }]);
        setCurrentTyping(null);
        await sleep(300);
      } else if (step.type === "out") {
        setLines(prev => [...prev, { kind: "output", text: step.text }]);
        await sleep(600);
      } else if (step.type === "think") {
        setLines(prev => [...prev, { kind: "ai-thinking" }]);
        await sleep(1200);
      } else if (step.type === "ai") {
        // Replace the last thinking line with streaming response
        setLines(prev => {
          const last = prev[prev.length - 1];
          if (last?.kind === "ai-thinking") {
            return [...prev.slice(0, -1), { kind: "ai-response", text: "", full: step.text }];
          }
          return [...prev, { kind: "ai-response", text: "", full: step.text }];
        });
        // Stream the text
        for (let i = 1; i <= step.text.length; i++) {
          if (cancelled) return;
          setLines(prev => {
            const next = [...prev];
            for (let j = next.length - 1; j >= 0; j--) {
              const lineAt = next[j];
              if (lineAt.kind === "ai-response") {
                next[j] = { kind: "ai-response", text: step.text.slice(0, i), full: lineAt.full };
                break;
              }
            }
            return next;
          });
          await sleep(18);
        }
        await sleep(600);
      } else if (step.type === "file") {
        setLines(prev => [...prev, { kind: "file-added", name: step.text }]);
        await sleep(400);
      }

      if (cancelled) return;
      stepIdx++;
      if (stepIdx >= SCRIPT.length) {
        // Reset after a pause
        await sleep(3500);
        if (!cancelled) {
          setLines([]);
          stepIdx = 0;
          runStep();
        }
      } else {
        runStep();
      }
    };

    runStep();
    return () => { cancelled = true; };
  }, [inView]);

  return (
    <div ref={ref} style={frameStyle}>
      <div style={chromeStyle}>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ ...dotStyle, background: "#ff5f57" }} />
          <span style={{ ...dotStyle, background: "#febc2e" }} />
          <span style={{ ...dotStyle, background: "#28c840" }} />
        </div>
        <div style={titleStyle}>zsh — project — 80×24</div>
        <div style={{ width: 52 }} />
      </div>

      <div style={bodyStyle}>
        {lines.map((line, i) => {
          if (line.kind === "prompt") {
            return (
              <div key={i} style={lineRowStyle}>
                <span style={promptStyle}>{PROMPT}</span>
                <span>{line.typed}</span>
              </div>
            );
          }
          if (line.kind === "output") {
            return <div key={i} style={outputStyle}>{line.text}</div>;
          }
          if (line.kind === "ai-thinking") {
            return (
              <div key={i} style={aiThinkingStyle}>
                <span style={{ color: "#EA580C" }}>{BRAILLE[brailleIdx]}</span>
                <span style={{ color: "#888" }}>Thinking…</span>
              </div>
            );
          }
          if (line.kind === "ai-response") {
            return (
              <div key={i} style={aiResponseStyle}>
                {line.text.split("\n").map((t, j) => <div key={j}>{t}</div>)}
                {line.text.length < line.full.length && <span style={caretStyle} />}
              </div>
            );
          }
          if (line.kind === "file-added") {
            return (
              <div key={i} style={fileAddedStyle}>
                <span style={{ color: "#40c977" }}>  +</span>
                <span>{line.name}</span>
              </div>
            );
          }
          return null;
        })}
        {currentTyping !== null && (
          <div style={lineRowStyle}>
            <span style={promptStyle}>{PROMPT}</span>
            <span>{currentTyping}</span>
            <span style={caretStyle} />
          </div>
        )}
        {currentTyping === null && lines.length > 0 && (
          <div style={lineRowStyle}>
            <span style={promptStyle}>{PROMPT}</span>
            <span style={caretStyle} />
          </div>
        )}
      </div>

      <style>{`
        @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
      `}</style>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

async function typeInto(
  text: string,
  setter: (s: string) => void,
  charDelay: number,
  cancelled: () => boolean,
) {
  setter("");
  for (let i = 1; i <= text.length; i++) {
    if (cancelled()) return;
    setter(text.slice(0, i));
    await sleep(charDelay);
  }
}

const frameStyle: React.CSSProperties = {
  background: "#0f0f1a",
  borderRadius: 12,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
  fontFamily: 'Menlo, "SF Mono", Consolas, monospace',
  color: "#ededec",
  width: "100%",
  maxWidth: 900,
  margin: "0 auto",
};
const chromeStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "10px 14px",
  background: "#1a1a2e",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  fontFamily: 'Inter, sans-serif',
};
const dotStyle: React.CSSProperties = { width: 10, height: 10, borderRadius: "50%" };
const titleStyle: React.CSSProperties = { fontSize: 12, color: "rgba(255,255,255,0.55)" };
const bodyStyle: React.CSSProperties = {
  padding: 16, fontSize: 13, lineHeight: 1.55,
  minHeight: 360, maxHeight: 380, overflow: "hidden",
  display: "flex", flexDirection: "column", gap: 2,
};
const lineRowStyle: React.CSSProperties = {
  display: "flex", flexWrap: "wrap", gap: 0,
};
const promptStyle: React.CSSProperties = {
  color: "#40c977",
};
const outputStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.8)", whiteSpace: "pre",
};
const aiThinkingStyle: React.CSSProperties = {
  display: "flex", gap: 8, color: "#888",
};
const aiResponseStyle: React.CSSProperties = {
  color: "#ededec",
};
const fileAddedStyle: React.CSSProperties = {
  display: "flex", gap: 4, color: "#40c977",
};
const caretStyle: React.CSSProperties = {
  display: "inline-block", width: 8, height: 14,
  background: "#EA580C", marginLeft: 1,
  animation: "blink 1s infinite", verticalAlign: "middle",
};

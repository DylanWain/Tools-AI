import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
 * TOOLS AI — LANDING PAGE v3
 *
 * Matches Cursor.com's exact design language:
 *   - Warm brown-black palette (#14120b), NOT cold blue-black
 *   - Monochrome — NO bright accent colors, all cream/brown/gray
 *   - Ghost buttons with rgba(237,236,236,0.08) bg
 *   - Generous whitespace (120px between sections)
 *   - Each feature gets its own full-width section with a product visual
 *   - Product visuals show the ACTUAL Tools AI IDE, not generic mockups
 *
 * Color tokens (from Cursor's CSS):
 *   bg:        #14120b
 *   card:      #1c1a14
 *   primary:   #edecec
 *   secondary: rgba(237,236,236,0.55)
 *   tertiary:  rgba(237,236,236,0.35)
 *   border:    rgba(237,236,236,0.08)
 *   btn-bg:    rgba(237,236,236,0.08)
 *   btn-hover: rgba(237,236,236,0.14)
 * ═══════════════════════════════════════════════════════════════════════ */

const C = {
  bg: "#14120b",
  card: "#1c1a14",
  cardHover: "#22201a",
  primary: "#edecec",
  sec: "rgba(237,236,236,0.55)",
  tert: "rgba(237,236,236,0.35)",
  border: "rgba(237,236,236,0.08)",
  borderHover: "rgba(237,236,236,0.16)",
  btn: "rgba(237,236,236,0.08)",
  btnHover: "rgba(237,236,236,0.14)",
  check: "rgba(237,236,236,0.45)",
};

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif';
const DMG = "https://github.com/DylanWain/Tools-AI-APP/releases/latest/download/Tools-AI-1.1.0.dmg";

/* ── Hooks ──────────────────────────────────────────────────────────── */
const useInView = (t = 0.12) => {
  const ref = useRef(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); o.disconnect(); } }, { threshold: t });
    o.observe(el); return () => o.disconnect();
  }, []);
  return [ref, v];
};

const useScrolled = () => {
  const [s, setS] = useState(false);
  useEffect(() => {
    const h = () => setS(window.scrollY > 20);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  return s;
};

/* ── Animated reveal ────────────────────────────────────────────────── */
const Reveal = ({ children, delay = 0, style = {} }) => {
  const [ref, v] = useInView();
  return (
    <div ref={ref} style={{
      opacity: v ? 1 : 0,
      transform: v ? "none" : "translateY(24px)",
      transition: `opacity 0.7s cubic-bezier(.22,1,.36,1) ${delay}s, transform 0.7s cubic-bezier(.22,1,.36,1) ${delay}s`,
      ...style,
    }}>{children}</div>
  );
};

/* ── Ghost button (Cursor-style) ────────────────────────────────────── */
const GhostBtn = ({ children, href, primary, style: s = {}, ...rest }) => (
  <a href={href} style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: primary ? "10px 22px" : "10px 18px",
    borderRadius: 8,
    background: C.btn,
    color: C.primary,
    fontSize: 14, fontWeight: 500, fontFamily: FONT,
    textDecoration: "none",
    transition: "background 0.15s ease, color 0.15s ease",
    border: "none",
    cursor: "pointer",
    ...s,
  }} onMouseEnter={e => e.currentTarget.style.background = C.btnHover}
     onMouseLeave={e => e.currentTarget.style.background = C.btn}
     {...rest}>{children}</a>
);

/* ── Mac window dots ────────────────────────────────────────────────── */
const Dots = () => (
  <div style={{ display: "flex", gap: 6 }}>
    {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ═══════════════════════════════════════════════════════════════════ */
export default function ToolsAILanding() {
  const scrolled = useScrolled();

  return (
    <div style={{ background: C.bg, color: C.primary, fontFamily: FONT, minHeight: "100vh" }}>

      {/* ══ NAV ══════════════════════════════════════════════════════ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 36px",
        background: scrolled ? C.bg : "transparent",
        borderBottom: scrolled ? `1px solid ${C.border}` : "1px solid transparent",
        transition: "all 0.25s ease",
      }}>
        <a href="/" style={{ fontSize: 15, fontWeight: 700, color: C.primary, textDecoration: "none" }}>
          ⚡ Tools AI
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {["Features", "Pricing"].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} style={{ fontSize: 14, color: C.sec, textDecoration: "none", fontWeight: 500, transition: "color 0.15s ease" }}
               onMouseEnter={e => e.currentTarget.style.color = C.primary}
               onMouseLeave={e => e.currentTarget.style.color = C.sec}
            >{l}</a>
          ))}
          <GhostBtn href={DMG} primary download>↓ Download</GhostBtn>
        </div>
      </nav>

      {/* ══ HERO ═════════════════════════════════════════════════════ */}
      <section style={{ textAlign: "center", paddingTop: 160, paddingBottom: 60, maxWidth: 800, margin: "0 auto", padding: "160px 40px 60px" }}>
        <Reveal>
          <h1 style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.12, margin: 0, letterSpacing: -1.2, color: C.primary }}>
            Every AI model, orchestrated<br />in one editor.
          </h1>
        </Reveal>
        <Reveal delay={0.08}>
          <p style={{ fontSize: 18, color: C.sec, lineHeight: 1.6, margin: "24px auto 0", maxWidth: 560 }}>
            Claude, GPT-4o, Gemini, Grok, and Perplexity work together on your code. They plan, build, test, and fix errors — automatically.
          </p>
        </Reveal>
        <Reveal delay={0.16}>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 36 }}>
            <GhostBtn href={DMG} primary download>↓ Download for macOS</GhostBtn>
            <a href="#pricing" style={{ padding: "10px 18px", color: C.sec, fontSize: 14, fontWeight: 500, textDecoration: "none", transition: "color 0.15s ease" }}
               onMouseEnter={e => e.currentTarget.style.color = C.primary}
               onMouseLeave={e => e.currentTarget.style.color = C.sec}
            >See pricing →</a>
          </div>
        </Reveal>
      </section>

      {/* ══ PRODUCT: AI BUILDER (the actual IDE) ════════════════════ */}
      <section style={{ padding: "0 40px 120px", maxWidth: 980, margin: "0 auto" }}>
        <Reveal>
          <div style={{
            borderRadius: 12, overflow: "hidden", background: "#0e0d09",
            border: `1px solid ${C.border}`,
          }}>
            {/* Titlebar */}
            <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", background: "#18170f", borderBottom: `1px solid ${C.border}` }}>
              <Dots />
              <div style={{ flex: 1, textAlign: "center", fontSize: 12, color: C.tert, fontWeight: 500 }}>Tools AI — AI Builder</div>
            </div>

            {/* IDE content showing the REAL AI Builder */}
            <div style={{ display: "flex", minHeight: 380 }}>
              {/* Activity bar */}
              <div style={{ width: 48, background: "#12110a", borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 12, gap: 16 }}>
                {["📁", "🔍", "🎙️", "📚", "✨"].map((icon, i) => (
                  <div key={i} style={{ fontSize: 16, opacity: i === 4 ? 1 : 0.35, cursor: "pointer", padding: "4px 6px", borderRadius: 4, background: i === 4 ? C.btn : "transparent" }}>{icon}</div>
                ))}
              </div>

              {/* AI Builder panel */}
              <div style={{ flex: 1, padding: "20px 28px" }}>
                {/* Top bar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.sec, textTransform: "uppercase", letterSpacing: 0.8 }}>AI Builder</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {["Parallel", "Hierarchy"].map((m, i) => (
                      <div key={m} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 4, background: i === 0 ? C.btn : "transparent", color: i === 0 ? C.primary : C.tert, fontWeight: 500 }}>{m}</div>
                    ))}
                  </div>
                </div>

                {/* Master Task */}
                <div style={{ background: C.btn, borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.tert, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Master Task</div>
                  <div style={{ fontSize: 13, color: C.primary, lineHeight: 1.5 }}>
                    Build a full-stack dashboard with React + TypeScript. Include user auth, real-time charts, dark mode toggle, and CSV data export. Deploy-ready.
                  </div>
                </div>

                {/* Model assignments */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {[
                    { model: "Claude", task: "Auth + dashboard components", color: "#d97706" },
                    { model: "GPT-4o", task: "Chart library + dark theme", color: "#10a37f" },
                    { model: "Gemini", task: "Data loader + CSV export", color: "#4285f4" },
                  ].map(a => (
                    <div key={a.model} style={{ flex: 1, background: C.btn, borderRadius: 6, padding: "10px 12px", borderLeft: `2px solid ${a.color}` }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.primary, marginBottom: 4 }}>{a.model}</div>
                      <div style={{ fontSize: 10, color: C.tert, lineHeight: 1.4 }}>{a.task}</div>
                    </div>
                  ))}
                </div>

                {/* Phase status */}
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                  <div style={{ fontSize: 10, color: "#50c878", fontWeight: 600, marginBottom: 6 }}>✓ Phase 1 complete — 3 agents delivered 9 files</div>
                  <div style={{ fontSize: 10, color: C.tert, marginBottom: 3 }}>Claude → Auth.tsx, Dashboard.tsx, Sidebar.tsx, types.ts</div>
                  <div style={{ fontSize: 10, color: C.tert, marginBottom: 3 }}>GPT-4o → Charts.tsx, DarkMode.css, ThemeProvider.tsx</div>
                  <div style={{ fontSize: 10, color: C.tert, marginBottom: 8 }}>Gemini → dataLoader.ts, csvExport.ts</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#d4a017", animation: "pulse 1.5s infinite" }} />
                    <div style={{ fontSize: 10, color: "#d4a017", fontWeight: 500 }}>Phase 2 — agents refining with shared context…</div>
                  </div>
                </div>
              </div>

              {/* Terminal panel */}
              <div style={{ width: 280, borderLeft: `1px solid ${C.border}`, padding: "12px 16px", background: "#0e0d08" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.tert, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>Terminal</div>
                <pre style={{ fontSize: 10, color: C.tert, lineHeight: 1.7, margin: 0, fontFamily: "ui-monospace, Menlo, monospace", whiteSpace: "pre-wrap" }}>
{`$ npm install
added 283 packages in 12s

$ npx tsc --noEmit
src/Auth.tsx:14 - error TS2307
Cannot find module 'next-auth'

⚡ Tools AI: fixing...

$ npm install next-auth
added 12 packages in 3s

$ npx tsc --noEmit
✓ No errors found

$ npm run build
✓ Build complete (4.2s)`}
                </pre>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ══ FEATURES (Cursor-style deep-dive sections) ═══════════════ */}
      <section id="features">
        {[
          {
            tag: "Multi-model orchestration",
            title: "Assign the right model to each part of the job",
            body: "Claude writes your React components. GPT-4o handles CSS and layout. Gemini generates the utility files. They work in parallel on Phase 1, then refine together in Phase 2 with full shared context. One master task, multiple minds.",
          },
          {
            tag: "Self-healing builds",
            title: "Write code. Run the build. Fix the errors. Automatically.",
            body: "The terminal loop catches every build failure, reads the error output, feeds it back to the model, installs missing dependencies, rewrites broken imports, and tries again — up to three times. You click Execute once.",
          },
          {
            tag: "Master Planner",
            title: "Talk to the architect before the engineers start",
            body: "The Master Planner asks clarifying questions, proposes a structured plan, and recommends which AI model should handle each sub-task. Review the plan, tweak it, then hit Run. No more blind prompting.",
          },
          {
            tag: "Context Library",
            title: "Your files, always in context",
            body: "Drop API specs, design docs, brand guides into the Context Library. Every AI call includes them automatically — no re-uploading, no copy-pasting. The AI always knows your constraints.",
          },
        ].map((s, i) => (
          <div key={s.tag} style={{ padding: "120px 40px", maxWidth: 720, margin: "0 auto" }}>
            <Reveal delay={0}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.tert, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 16 }}>{s.tag}</div>
              <h2 style={{ fontSize: 32, fontWeight: 600, lineHeight: 1.2, margin: "0 0 20px", letterSpacing: -0.3, color: C.primary }}>{s.title}</h2>
              <p style={{ fontSize: 17, color: C.sec, lineHeight: 1.7, margin: 0 }}>{s.body}</p>
            </Reveal>
          </div>
        ))}
      </section>

      {/* ══ PRICING ══════════════════════════════════════════════════ */}
      <section id="pricing" style={{ padding: "120px 40px", maxWidth: 960, margin: "0 auto" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <h2 style={{ fontSize: 36, fontWeight: 600, margin: 0, letterSpacing: -0.3, color: C.primary }}>Pricing</h2>
            <p style={{ fontSize: 16, color: C.sec, marginTop: 12 }}>Start with a 14-day free trial. No credit card required.</p>
          </div>
        </Reveal>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: C.border, borderRadius: 12, overflow: "hidden" }}>
          {/* Free Trial */}
          <Reveal>
            <div style={{ background: C.card, padding: "32px 28px", display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.primary, marginBottom: 8 }}>Free Trial</div>
              <div style={{ fontSize: 40, fontWeight: 700, color: C.primary, marginBottom: 4 }}>$0</div>
              <div style={{ fontSize: 13, color: C.tert, marginBottom: 28 }}>14 days, full access</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
                {["All 5 AI models", "AI Builder + Master Planner", "Terminal auto-fix loop", "Context Library", "Meeting Recorder"].map(f => (
                  <li key={f} style={{ fontSize: 13, color: C.sec, display: "flex", gap: 8 }}>
                    <span style={{ color: C.check, flexShrink: 0 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <a href="/loginDeepControl?from=pricing" style={{
                marginTop: 28, padding: "10px 0", borderRadius: 8, textAlign: "center",
                background: C.btn, color: C.primary, fontSize: 14, fontWeight: 500,
                textDecoration: "none", display: "block", transition: "background 0.15s ease",
              }}>Start Free Trial</a>
            </div>
          </Reveal>

          {/* CHAD */}
          <Reveal delay={0.05}>
            <div style={{ background: C.card, padding: "32px 28px", display: "flex", flexDirection: "column", height: "100%", position: "relative", overflow: "hidden" }}>
              {/* GigaChad watermark — VISIBLE */}
              <img src="/chad.png" alt="" style={{
                position: "absolute", top: 8, right: 8, width: 100, height: 100,
                objectFit: "cover", objectPosition: "center top",
                opacity: 0.15, borderRadius: 12, pointerEvents: "none",
                filter: "grayscale(1) contrast(1.5) brightness(1.3)",
              }} />
              <div style={{ fontSize: 10, fontWeight: 600, color: C.tert, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Recommended</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.primary, marginBottom: 8 }}>Chad</div>
              <div style={{ fontSize: 40, fontWeight: 700, color: C.primary, marginBottom: 4 }}>$25<span style={{ fontSize: 15, fontWeight: 400, color: C.tert }}>/mo</span></div>
              <div style={{ fontSize: 13, color: C.tert, marginBottom: 28 }}>Most users never pay more</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
                {["Everything in Free Trial", "Generous AI usage included", "Small overage on heavy usage", "Set your own monthly cap", "Priority during peak hours"].map(f => (
                  <li key={f} style={{ fontSize: 13, color: C.sec, display: "flex", gap: 8 }}>
                    <span style={{ color: C.check, flexShrink: 0 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <a href="/loginDeepControl?from=pricing" style={{
                marginTop: 28, padding: "10px 0", borderRadius: 8, textAlign: "center",
                background: C.btn, color: C.primary, fontSize: 14, fontWeight: 500,
                textDecoration: "none", display: "block", transition: "background 0.15s ease",
              }}>Get Chad</a>
            </div>
          </Reveal>

          {/* PAYG */}
          <Reveal delay={0.1}>
            <div style={{ background: C.card, padding: "32px 28px", display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.primary, marginBottom: 8 }}>Pay-as-you-go</div>
              <div style={{ fontSize: 40, fontWeight: 700, color: C.primary, marginBottom: 4 }}>$0<span style={{ fontSize: 15, fontWeight: 400, color: C.tert }}>/mo</span></div>
              <div style={{ fontSize: 13, color: C.tert, marginBottom: 28 }}>Pay only when you use it</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
                {["Everything in Free Trial", "No monthly commitment", "Per-call billing", "Monthly spending limit", "Upgrade to Chad anytime"].map(f => (
                  <li key={f} style={{ fontSize: 13, color: C.sec, display: "flex", gap: 8 }}>
                    <span style={{ color: C.check, flexShrink: 0 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <a href="/loginDeepControl?from=pricing" style={{
                marginTop: 28, padding: "10px 0", borderRadius: 8, textAlign: "center",
                background: C.btn, color: C.primary, fontSize: 14, fontWeight: 500,
                textDecoration: "none", display: "block", transition: "background 0.15s ease",
              }}>Get Started</a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ FINAL CTA ════════════════════════════════════════════════ */}
      <section id="download" style={{ textAlign: "center", padding: "120px 40px 80px" }}>
        <Reveal>
          <h2 style={{ fontSize: 36, fontWeight: 600, margin: "0 0 16px", letterSpacing: -0.3, color: C.primary }}>Try Tools AI now.</h2>
          <p style={{ fontSize: 16, color: C.sec, marginBottom: 36 }}>14-day free trial. No credit card.</p>
          <GhostBtn href={DMG} primary download>↓ Download for macOS</GhostBtn>
          <p style={{ fontSize: 12, color: C.tert, marginTop: 16 }}>macOS 12+ · Apple Silicon & Intel</p>
        </Reveal>
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════════════════ */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: "56px 40px 36px", maxWidth: 1060, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 40, marginBottom: 48 }}>
          {[
            { h: "Product", links: [{ t: "Features", href: "#features" }, { t: "Pricing", href: "#pricing" }, { t: "Download", href: DMG }] },
            { h: "Resources", links: [{ t: "Documentation", href: "#" }, { t: "Blog", href: "/blog" }, { t: "Changelog", href: "#" }] },
            { h: "Company", links: [{ t: "About", href: "#" }, { t: "Contact", href: "#" }] },
            { h: "Legal", links: [{ t: "Privacy", href: "/privacy" }, { t: "Terms", href: "/terms" }] },
          ].map(col => (
            <div key={col.h}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.tert, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 16 }}>{col.h}</div>
              {col.links.map(l => (
                <a key={l.t} href={l.href} style={{ display: "block", fontSize: 13, color: C.sec, textDecoration: "none", marginBottom: 10, transition: "color 0.15s ease" }}
                   onMouseEnter={e => e.currentTarget.style.color = C.primary}
                   onMouseLeave={e => e.currentTarget.style.color = C.sec}
                >{l.t}</a>
              ))}
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", fontSize: 12, color: C.tert }}>
          © {new Date().getFullYear()} Tools AI
        </div>
      </footer>

      {/* Pulse animation for the phase indicator */}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}

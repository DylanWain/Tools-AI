import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
 * TOOLS AI — LANDING PAGE v4
 *
 * Adapted from the CURSOR_WEBSITE_SPEC.pdf design system:
 *   - Light theme (#FFFFFF bg, #F3F4F6 surface cards)
 *   - Inter font family (system fallback)
 *   - Pill-shaped buttons (border-radius: 9999px, 44px height)
 *   - Orange accent for "Learn more →" links (#EA580C)
 *   - 120-160px section padding, 1200px max-width
 *   - Reusable DemoFrame component (macOS window chrome)
 *   - 3-column feature grids with product mockups
 *   - 12-section structure (skipping testimonials/blog/changelog for launch)
 *
 * Sections: Hero → Agent Panel → 3-col Features → Dev Lifecycle →
 *           Tools → Pricing → Final CTA → Footer
 * ═══════════════════════════════════════════════════════════════════════ */

/* ── Design Tokens (from PDF spec, light mode) ──────────────────────── */
const T = {
  bg: "#FFFFFF",
  surface: "#F3F4F6",
  surfaceHover: "#E9EAED",
  text: "#111827",
  textSec: "#6B7280",
  textTert: "#9CA3AF",
  border: "#E5E7EB",
  accent: "#EA580C",
  btnBg: "#111827",
  btnText: "#FFFFFF",
  btnGhost: "transparent",
  btnGhostBorder: "#E5E7EB",
  green: "#16A34A",
  orange: "#EA580C",
  code: "#1E293B",
};
const FONT = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const DMG = "https://github.com/DylanWain/Tools-AI-APP/releases/latest/download/Tools-AI-1.1.0.dmg";

/* ── Hooks ──────────────────────────────────────────────────────────── */
const useInView = (t = 0.1) => {
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

/* ── Animated reveal (PDF spec: 400ms ease-out, staggered) ──────────── */
const Reveal = ({ children, delay = 0, style = {} }) => {
  const [ref, v] = useInView();
  return (
    <div ref={ref} style={{
      opacity: v ? 1 : 0,
      transform: v ? "none" : "translateY(20px)",
      transition: `opacity 0.4s ease-out ${delay}s, transform 0.4s ease-out ${delay}s`,
      ...style,
    }}>{children}</div>
  );
};

/* ── Pill Button (PDF spec: border-radius 9999px, 44px height) ──────── */
const Btn = ({ children, href, primary, style: s = {}, ...rest }) => (
  <a href={href} style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    height: 44, padding: "0 24px", borderRadius: 9999,
    background: primary ? T.btnBg : T.btnGhost,
    color: primary ? T.btnText : T.text,
    border: primary ? "none" : `1px solid ${T.btnGhostBorder}`,
    fontSize: 15, fontWeight: 500, fontFamily: FONT,
    textDecoration: "none", cursor: "pointer",
    transition: "background 0.15s ease, border-color 0.15s ease",
    ...s,
  }} {...rest}>{children}</a>
);

/* ── Demo Frame (PDF spec: macOS window chrome, reusable) ───────────── */
const DemoFrame = ({ title, children, style: s = {} }) => (
  <div style={{
    borderRadius: 12, overflow: "hidden",
    background: T.surface, border: `1px solid ${T.border}`,
    ...s,
  }}>
    <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ display: "flex", gap: 6 }}>
        {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
      </div>
      {title && <div style={{ flex: 1, textAlign: "center", fontSize: 12, color: T.textTert, fontWeight: 500 }}>{title}</div>}
    </div>
    <div style={{ padding: "20px 24px" }}>{children}</div>
  </div>
);

/* ── Learn More Link (PDF spec: orange accent) ──────────────────────── */
const LearnMore = ({ href = "#" }) => (
  <a href={href} style={{ color: T.accent, fontSize: 14, fontWeight: 500, textDecoration: "none" }}>Learn more →</a>
);

/* ── Feature Card (3-col grid pattern from Cursor) ──────────────────── */
const FeatureCard = ({ title, desc, children, href }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
    <div style={{ padding: "24px 24px 16px" }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: T.text, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.6, marginBottom: 12 }}>{desc}</div>
      <LearnMore href={href} />
    </div>
    <DemoFrame style={{ margin: "0 0 0 0", borderRadius: "0 0 12px 12px", borderTop: "none" }}>
      {children}
    </DemoFrame>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ═══════════════════════════════════════════════════════════════════ */
export default function ToolsAILanding() {
  const scrolled = useScrolled();

  return (
    <div style={{ background: T.bg, color: T.text, fontFamily: FONT, minHeight: "100vh" }}>

      {/* ══ NAV ══════════════════════════════════════════════════════ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 40px", maxWidth: 1200, margin: "0 auto", left: 0, right: 0,
        background: scrolled ? "rgba(255,255,255,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? `1px solid ${T.border}` : "1px solid transparent",
        transition: "all 0.25s ease",
      }}>
        <a href="/" style={{ fontSize: 16, fontWeight: 700, color: T.text, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
          ⚡ Tools AI
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {["Product", "Pricing"].map(l => (
            <a key={l} href={l === "Product" ? "#features" : "#pricing"} style={{ fontSize: 14, color: T.textSec, textDecoration: "none", fontWeight: 500 }}>{l}</a>
          ))}
          <a href="#" style={{ fontSize: 14, color: T.textSec, textDecoration: "none", fontWeight: 500 }}>Sign in</a>
          <Btn href={DMG} primary download>Download ↓</Btn>
        </div>
      </nav>

      {/* ══ SECTION 1: HERO ══════════════════════════════════════════ */}
      <section style={{ textAlign: "center", padding: "160px 40px 80px", maxWidth: 800, margin: "0 auto" }}>
        <Reveal>
          <h1 style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.1, margin: 0, letterSpacing: "-0.02em", color: T.text }}>
            Every AI model,<br />orchestrated in one editor.
          </h1>
        </Reveal>
        <Reveal delay={0.08}>
          <p style={{ fontSize: 19, color: T.textSec, lineHeight: 1.6, margin: "20px auto 0", maxWidth: 560 }}>
            Delegate implementation to focus on higher-level direction. Claude, GPT-4o, Gemini, Grok, and Perplexity work together on your code.
          </p>
        </Reveal>
        <Reveal delay={0.16}>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 36 }}>
            <Btn href={DMG} primary download>Download for macOS ↓</Btn>
            <Btn href="/loginDeepControl?from=web">Start free trial →</Btn>
          </div>
        </Reveal>
      </section>

      {/* ══ SECTION 2: AGENT TASK PANEL (full-width product demo) ════ */}
      <section style={{ padding: "0 40px 120px", maxWidth: 1100, margin: "0 auto" }}>
        <Reveal>
          <DemoFrame title="Tools AI — AI Builder">
            <div style={{ display: "flex", minHeight: 340 }}>
              {/* Sidebar: tasks in progress */}
              <div style={{ width: 220, borderRight: `1px solid ${T.border}`, paddingRight: 20, flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textTert, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>In Progress · 3</div>
                {[
                  { model: "Claude", task: "Auth + Dashboard components", status: "Writing files", color: "#d97706" },
                  { model: "GPT-4o", task: "Chart components + dark theme", status: "Fetching context", color: "#10a37f" },
                  { model: "Gemini", task: "Data loader + CSV export", status: "Reading docs", color: "#4285f4" },
                ].map(a => (
                  <div key={a.model} style={{ padding: "10px 12px", borderRadius: 8, background: T.bg, border: `1px solid ${T.border}`, marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: a.color }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{a.model}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.textSec, marginBottom: 2 }}>{a.task}</div>
                    <div style={{ fontSize: 10, color: T.textTert }}>{a.status}</div>
                  </div>
                ))}
                <div style={{ fontSize: 11, fontWeight: 600, color: T.textTert, textTransform: "uppercase", letterSpacing: 1, marginTop: 16, marginBottom: 10 }}>Ready for Review · 1</div>
                <div style={{ padding: "10px 12px", borderRadius: 8, background: T.bg, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>✓ Phase 1 delivered</div>
                  <div style={{ fontSize: 10, color: T.green }}>9 files · 3 models</div>
                </div>
              </div>

              {/* Main: Master Task + terminal */}
              <div style={{ flex: 1, paddingLeft: 24 }}>
                <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.textTert, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Master Task</div>
                  <div style={{ fontSize: 14, color: T.text, lineHeight: 1.5 }}>
                    Build a full-stack dashboard with React + TypeScript. Include user auth, real-time charts, dark mode, and CSV export.
                  </div>
                </div>

                {/* Terminal output showing self-healing */}
                <div style={{ background: T.code, borderRadius: 8, padding: "14px 16px", fontFamily: "ui-monospace, 'JetBrains Mono', Menlo, monospace" }}>
                  <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 8 }}>TERMINAL</div>
                  <pre style={{ fontSize: 12, color: "#D1D5DB", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
{`$ npx tsc --noEmit
src/Auth.tsx:14 - error TS2307
  Cannot find module 'next-auth'

`}<span style={{ color: "#FB923C" }}>⚡ Tools AI: auto-fixing...</span>{`

$ npm install next-auth
added 12 packages in 3s

$ npx tsc --noEmit
`}<span style={{ color: "#4ADE80" }}>✓ No errors found</span>{`

$ npm run build
`}<span style={{ color: "#4ADE80" }}>✓ Compiled successfully in 4.2s</span>
                  </pre>
                </div>
              </div>
            </div>
          </DemoFrame>
        </Reveal>
      </section>

      {/* ══ SECTION 3: 3-COL FEATURES ════════════════════════════════ */}
      <section id="features" style={{ padding: "120px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <Reveal>
          <div style={{ marginBottom: 56 }}>
            <h2 style={{ fontSize: 40, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Orchestrate every AI model.</h2>
            <p style={{ fontSize: 18, color: T.textSec, marginTop: 14, maxWidth: 600 }}>Tools AI deeply understands your codebase and assigns the right model for each task.</p>
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: T.border, borderRadius: 16, overflow: "hidden", border: `1px solid ${T.border}` }}>
          {[
            {
              title: "Multiple models",
              desc: "Assign Claude, GPT-4o, Gemini, Grok, and Perplexity to work in parallel — each using the best model for its sub-task.",
              demo: <div style={{ fontSize: 12, color: T.textSec }}>
                {["Claude → Auth.tsx, Dashboard.tsx", "GPT-4o → Charts.tsx, Theme.css", "Gemini → dataLoader.ts, export.ts"].map(l => (
                  <div key={l} style={{ padding: "8px 10px", background: T.bg, borderRadius: 6, marginBottom: 4, border: `1px solid ${T.border}` }}>{l}</div>
                ))}
              </div>
            },
            {
              title: "Context Library",
              desc: "Drop API specs, design docs, and brand guides in once. Every AI call includes them — no re-uploading.",
              demo: <div style={{ fontSize: 12, color: T.textSec }}>
                {["api-spec.json · 12KB", "design-system.md · 4KB", "brand-guide.pdf · 128KB"].map(f => (
                  <div key={f} style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 6 }}>📄 {f}</div>
                ))}
              </div>
            },
            {
              title: "Meeting Recorder",
              desc: "Record any call. AI extracts tasks with context. One click to execute them against your codebase.",
              demo: <div style={{ fontSize: 12, color: T.textSec }}>
                <div style={{ padding: "6px 0", fontWeight: 600, color: T.text }}>Sprint Planning · 32m</div>
                <div style={{ padding: "4px 0", display: "flex", gap: 6 }}>☐ Add auth to dashboard</div>
                <div style={{ padding: "4px 0", display: "flex", gap: 6 }}>☐ Fix chart responsiveness</div>
                <div style={{ padding: "4px 0", display: "flex", gap: 6 }}>☑ Update API endpoints</div>
              </div>
            },
          ].map(f => (
            <Reveal key={f.title}>
              <div style={{ background: T.bg, padding: "28px 24px", display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: T.text, marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.6, marginBottom: 16 }}>{f.desc}</div>
                <LearnMore />
                <div style={{ marginTop: 20, background: T.surface, borderRadius: 8, padding: "16px", border: `1px solid ${T.border}` }}>
                  {f.demo}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══ SECTION 4: DEVELOPMENT LIFECYCLE ══════════════════════════ */}
      <section style={{ padding: "120px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <Reveal>
          <div style={{ marginBottom: 56 }}>
            <h2 style={{ fontSize: 40, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Spans the full development lifecycle.</h2>
            <p style={{ fontSize: 18, color: T.textSec, marginTop: 14, maxWidth: 620 }}>Tools AI supports every phase from planning to writing to fixing code.</p>
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: T.border, borderRadius: 16, overflow: "hidden", border: `1px solid ${T.border}` }}>
          {[
            {
              title: "Plan",
              desc: "The Master Planner asks clarifying questions, builds a plan, then assigns models to each sub-task.",
              demo: <div style={{ fontSize: 12 }}>
                <div style={{ color: T.textSec, marginBottom: 8 }}>What framework should we use?</div>
                <div style={{ padding: "6px 10px", background: T.bg, borderRadius: 6, marginBottom: 4, border: `1px solid ${T.border}` }}>1. React + TypeScript</div>
                <div style={{ padding: "6px 10px", background: "#EFF6FF", borderRadius: 6, marginBottom: 4, border: "1px solid #BFDBFE", color: "#1D4ED8", fontWeight: 500 }}>2. Next.js App Router ✓</div>
                <div style={{ padding: "6px 10px", background: T.bg, borderRadius: 6, border: `1px solid ${T.border}` }}>3. Vue + Nuxt</div>
              </div>
            },
            {
              title: "Build",
              desc: "Multiple AI models write code in parallel, then refine together with shared context.",
              demo: <div style={{ fontSize: 12, color: T.textSec }}>
                <div style={{ fontWeight: 600, color: T.text, marginBottom: 6 }}>Phase 2 — Refinement</div>
                <div style={{ padding: "4px 0" }}>Claude reviewed GPT-4o's layout ✓</div>
                <div style={{ padding: "4px 0" }}>GPT-4o fixed Gemini's types ✓</div>
                <div style={{ padding: "4px 0" }}>Gemini optimized Claude's queries ✓</div>
                <div style={{ marginTop: 8, color: T.green, fontWeight: 500 }}>All agents converged · 9 files updated</div>
              </div>
            },
            {
              title: "Fix",
              desc: "The terminal loop catches errors, installs dependencies, rewrites code, and retries automatically.",
              demo: <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, color: T.text }}>
                <div style={{ color: "#DC2626" }}>error TS2307: Cannot find module</div>
                <div style={{ color: T.orange, marginTop: 4 }}>⚡ auto-fixing...</div>
                <div style={{ marginTop: 4 }}>$ npm install react-query</div>
                <div style={{ color: T.green, marginTop: 4 }}>✓ Build succeeded (attempt 2/3)</div>
              </div>
            },
          ].map(f => (
            <Reveal key={f.title}>
              <div style={{ background: T.bg, padding: "28px 24px", display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: T.text, marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.6, marginBottom: 16 }}>{f.desc}</div>
                <LearnMore />
                <div style={{ marginTop: 20, background: T.surface, borderRadius: 8, padding: "16px", border: `1px solid ${T.border}` }}>
                  {f.demo}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══ SECTION 5: TOOLS (Terminal, Context, Live Preview) ════════ */}
      <section style={{ padding: "120px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <Reveal>
          <div style={{ marginBottom: 56 }}>
            <h2 style={{ fontSize: 40, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Equipped to do real engineering.</h2>
            <p style={{ fontSize: 18, color: T.textSec, marginTop: 14, maxWidth: 600 }}>Tools AI runs commands, reads your files, previews your app, and deploys your code.</p>
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: T.border, borderRadius: 16, overflow: "hidden", border: `1px solid ${T.border}` }}>
          {[
            {
              title: "Terminal",
              desc: "Run shell commands directly. Build, test, and deploy — sandboxed by default.",
              demo: <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, background: T.code, color: "#D1D5DB", borderRadius: 6, padding: 12 }}>
                <div>$ npm run build</div>
                <div style={{ color: "#9CA3AF" }}>Generating static pages (48/48)</div>
                <div style={{ color: "#4ADE80" }}>✓ Compiled successfully in 3.8s</div>
                <div style={{ marginTop: 8, color: "#9CA3AF" }}>Build complete. Ready to deploy?</div>
              </div>
            },
            {
              title: "Live Preview",
              desc: "Your app runs in a built-in browser. Describe changes in English — AI edits the code, page reloads instantly.",
              demo: <div style={{ fontSize: 12, color: T.textSec }}>
                <div style={{ background: T.bg, borderRadius: 6, padding: "8px 10px", border: `1px solid ${T.border}`, marginBottom: 8 }}>
                  Make the header gradient <span style={{ background: "#EFF6FF", padding: "1px 4px", borderRadius: 3, color: "#2563EB", fontWeight: 500 }}>purple to blue</span> and add a <span style={{ background: "#EFF6FF", padding: "1px 4px", borderRadius: 3, color: "#2563EB", fontWeight: 500 }}>CTA button</span>
                </div>
                <div style={{ color: T.green, fontSize: 11 }}>✓ Updated 2 files — reloading...</div>
              </div>
            },
            {
              title: "Context awareness",
              desc: "Point the AI at exactly what matters with file references and the Context Library.",
              demo: <div style={{ fontSize: 12, color: T.textSec }}>
                {["📚 Context Library (3 files)", "📁 Workspace: 142 files indexed", "🎙️ Meeting tasks: 4 pending"].map(f => (
                  <div key={f} style={{ padding: "6px 0", borderBottom: `1px solid ${T.border}` }}>{f}</div>
                ))}
              </div>
            },
          ].map(f => (
            <Reveal key={f.title}>
              <div style={{ background: T.bg, padding: "28px 24px", display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: T.text, marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.6, marginBottom: 16 }}>{f.desc}</div>
                <LearnMore />
                <div style={{ marginTop: 20 }}>{f.demo}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══ SECTION 6: PRICING ════════════════════════════════════════ */}
      <section id="pricing" style={{ padding: "120px 40px", maxWidth: 1000, margin: "0 auto" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 40, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Pricing</h2>
            <p style={{ fontSize: 18, color: T.textSec, marginTop: 14 }}>Start with a 14-day free trial. No credit card required.</p>
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: T.border, borderRadius: 16, overflow: "hidden", border: `1px solid ${T.border}` }}>
          {/* Free Trial */}
          <Reveal>
            <div style={{ background: T.bg, padding: "32px 28px", display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Free Trial</div>
              <div style={{ fontSize: 42, fontWeight: 700, marginBottom: 4 }}>$0</div>
              <div style={{ fontSize: 14, color: T.textTert, marginBottom: 24 }}>14 days, full access</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
                {["All 5 AI models", "AI Builder + Master Planner", "Terminal auto-fix loop", "Context Library", "Meeting Recorder"].map(f => (
                  <li key={f} style={{ fontSize: 14, color: T.textSec, display: "flex", gap: 8 }}>
                    <span style={{ color: T.textTert }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Btn href="/loginDeepControl?from=pricing" style={{ marginTop: 28, width: "100%", justifyContent: "center" }}>Start Free Trial</Btn>
            </div>
          </Reveal>

          {/* CHAD */}
          <Reveal delay={0.05}>
            <div style={{ background: T.bg, padding: "32px 28px", display: "flex", flexDirection: "column", height: "100%", position: "relative", overflow: "hidden" }}>
              {/* GigaChad watermark */}
              <img src="/chad.png" alt="" style={{
                position: "absolute", top: 8, right: 8, width: 90, height: 90,
                objectFit: "cover", objectPosition: "center top",
                opacity: 0.15, borderRadius: 10, pointerEvents: "none",
              }} />
              <div style={{ fontSize: 11, fontWeight: 600, color: T.accent, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Recommended</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Chad</div>
              <div style={{ fontSize: 42, fontWeight: 700, marginBottom: 4 }}>$25<span style={{ fontSize: 16, fontWeight: 400, color: T.textTert }}>/mo</span></div>
              <div style={{ fontSize: 14, color: T.textTert, marginBottom: 24 }}>Most users never pay more</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
                {["Everything in Free Trial", "Generous AI usage included", "Small overage on heavy usage", "Set your own monthly cap", "Priority during peak hours"].map(f => (
                  <li key={f} style={{ fontSize: 14, color: T.textSec, display: "flex", gap: 8 }}>
                    <span style={{ color: T.textTert }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Btn href="/loginDeepControl?from=pricing" primary style={{ marginTop: 28, width: "100%", justifyContent: "center" }}>Get Chad</Btn>
            </div>
          </Reveal>

          {/* PAYG */}
          <Reveal delay={0.1}>
            <div style={{ background: T.bg, padding: "32px 28px", display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Pay-as-you-go</div>
              <div style={{ fontSize: 42, fontWeight: 700, marginBottom: 4 }}>$0<span style={{ fontSize: 16, fontWeight: 400, color: T.textTert }}>/mo</span></div>
              <div style={{ fontSize: 14, color: T.textTert, marginBottom: 24 }}>Pay only when you use it</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
                {["Everything in Free Trial", "No monthly commitment", "Per-call billing", "Monthly spending limit", "Upgrade to Chad anytime"].map(f => (
                  <li key={f} style={{ fontSize: 14, color: T.textSec, display: "flex", gap: 8 }}>
                    <span style={{ color: T.textTert }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Btn href="/loginDeepControl?from=pricing" style={{ marginTop: 28, width: "100%", justifyContent: "center" }}>Get Started</Btn>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ SECTION 7: FINAL CTA ═════════════════════════════════════ */}
      <section style={{ textAlign: "center", padding: "160px 40px", background: T.surface }}>
        <Reveal>
          <h2 style={{ fontSize: 48, fontWeight: 700, margin: "0 0 24px", letterSpacing: "-0.02em" }}>Get started with Tools AI.</h2>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Btn href={DMG} primary download>Download ↓</Btn>
            <Btn href="/loginDeepControl?from=web">Start Free Trial</Btn>
          </div>
        </Reveal>
      </section>

      {/* ══ SECTION 8: FOOTER ════════════════════════════════════════ */}
      <footer style={{ borderTop: `1px solid ${T.border}`, padding: "56px 40px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 48, marginBottom: 48 }}>
          {[
            { h: "Product", links: [{ t: "AI Builder", href: "#features" }, { t: "Pricing", href: "#pricing" }, { t: "Download", href: DMG }] },
            { h: "Resources", links: [{ t: "Documentation", href: "#" }, { t: "Blog", href: "/blog" }, { t: "Changelog", href: "#" }] },
            { h: "Company", links: [{ t: "About", href: "#" }, { t: "Contact", href: "#" }] },
            { h: "Legal", links: [{ t: "Terms of Service", href: "/terms" }, { t: "Privacy Policy", href: "/privacy" }] },
          ].map(col => (
            <div key={col.h}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 16 }}>{col.h}</div>
              {col.links.map(l => (
                <a key={l.t} href={l.href} style={{ display: "block", fontSize: 14, color: T.textSec, textDecoration: "none", marginBottom: 10, transition: "color 0.15s" }}>{l.t}</a>
              ))}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: T.textTert }}>
          © {new Date().getFullYear()} Tools AI
        </div>
      </footer>
    </div>
  );
}

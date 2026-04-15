import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
 * TOOLS AI — LANDING PAGE v5 (Cursor replica)
 *
 * Exact Cursor design patterns applied:
 *   - Warm cream bg (#f7f7f4), card surface (#FFFFFF + shadow)
 *   - Full-height demo frames (300-400px) with macOS chrome + shadow
 *   - Alternating: full-width demos ↔ 3-col grids
 *   - Multi-line poetic subheadlines
 *   - 160px+ section spacing
 *   - Orange links (#EA580C) only for "Learn more →"
 *   - Pill buttons (border-radius: 9999px)
 *   - Detailed IDE reproductions showing actual Tools AI features
 * ═══════════════════════════════════════════════════════════════════════ */

const T = {
  bg: "#f7f7f4",
  white: "#FFFFFF",
  text: "#26251e",
  textSec: "rgba(38,37,30,0.55)",
  textTert: "rgba(38,37,30,0.35)",
  border: "rgba(38,37,30,0.08)",
  borderMed: "rgba(38,37,30,0.12)",
  accent: "#EA580C",
  btnBg: "#26251e",
  btnText: "#f7f7f4",
  green: "#16A34A",
  greenLight: "#dcfce7",
  red: "#DC2626",
  blue: "#2563EB",
  blueLight: "#dbeafe",
  orange: "#EA580C",
  orangeLight: "#fff7ed",
  code: "#1E293B",
  codeBg: "#0f172a",
  shadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
  shadowLg: "0 4px 24px rgba(0,0,0,0.06), 0 12px 48px rgba(0,0,0,0.06)",
  shadowXl: "0 8px 40px rgba(0,0,0,0.08), 0 24px 80px rgba(0,0,0,0.08)",
};
const F = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, "Courier New", monospace';
const DMG = "https://github.com/DylanWain/Tools-AI-APP/releases/latest/download/Tools-AI-2.0.3.dmg";

/* ── Hooks ──────────────────────────────────────────────────────────── */
const useInView = (t = 0.08) => {
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

/* ── Reveal (PDF: 400ms ease-out, 20px Y, staggered) ───────────────── */
const Reveal = ({ children, delay = 0, style = {} }) => {
  const [ref, v] = useInView();
  return <div ref={ref} style={{ opacity: v ? 1 : 0, transform: v ? "none" : "translateY(20px)", transition: `opacity 0.4s ease-out ${delay}s, transform 0.4s ease-out ${delay}s`, ...style }}>{children}</div>;
};

/* ── Pill Button (PDF: 9999px radius, 44px height) ──────────────────── */
const Btn = ({ children, href, primary, style: s = {}, ...r }) => (
  <a href={href} style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    height: 44, padding: "0 24px", borderRadius: 9999,
    background: primary ? T.btnBg : "transparent",
    color: primary ? T.btnText : T.text,
    border: primary ? "none" : `1px solid ${T.borderMed}`,
    fontSize: 15, fontWeight: 500, fontFamily: F, textDecoration: "none", cursor: "pointer",
    transition: "all 0.15s ease", ...s,
  }} {...r}>{children}</a>
);

/* ── macOS Demo Frame (PDF: 3 dots, title bar, shadow, rounded) ────── */
const DemoFrame = ({ title, dark, children, style: s = {} }) => (
  <div style={{
    borderRadius: 12, overflow: "hidden",
    background: dark ? T.codeBg : T.white,
    border: `1px solid ${dark ? "rgba(255,255,255,0.06)" : T.border}`,
    boxShadow: T.shadowLg,
    ...s,
  }}>
    <div style={{
      display: "flex", alignItems: "center", padding: "10px 14px",
      background: dark ? "#1a1a2e" : "rgba(0,0,0,0.02)",
      borderBottom: `1px solid ${dark ? "rgba(255,255,255,0.06)" : T.border}`,
    }}>
      <div style={{ display: "flex", gap: 6 }}>
        {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
      </div>
      {title && <div style={{ flex: 1, textAlign: "center", fontSize: 12, color: dark ? "rgba(255,255,255,0.35)" : T.textTert, fontWeight: 500 }}>{title}</div>}
    </div>
    {children}
  </div>
);

/* ── Section Heading (Cursor: multi-line poetic headlines) ──────────── */
const SectionHead = ({ title, sub, center }) => (
  <div style={{ marginBottom: 56, textAlign: center ? "center" : "left", maxWidth: center ? 700 : undefined, margin: center ? "0 auto 56px" : "0 0 56px" }}>
    <h2 style={{ fontSize: 42, fontWeight: 700, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.15, color: T.text }}>{title}</h2>
    {sub && <p style={{ fontSize: 18, color: T.textSec, marginTop: 16, lineHeight: 1.6 }}>{sub}</p>}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════
 * MAIN
 * ═══════════════════════════════════════════════════════════════════ */
export default function ToolsAILanding() {
  const scrolled = useScrolled();
  return (
    <div style={{ background: T.bg, color: T.text, fontFamily: F, minHeight: "100vh" }}>

      {/* ══ NAV ══════════════════════════════════════════════════════ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 40px",
        background: scrolled ? "rgba(247,247,244,0.9)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? `1px solid ${T.border}` : "1px solid transparent",
        transition: "all 0.3s ease",
      }}>
        <a href="/" style={{ fontSize: 16, fontWeight: 700, color: T.text, textDecoration: "none" }}>⚡ Tools AI</a>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {[["Product", "#features"], ["Pricing", "#pricing"]].map(([l, h]) =>
            <a key={l} href={h} style={{ fontSize: 14, color: T.textSec, textDecoration: "none", fontWeight: 500 }}>{l}</a>
          )}
          <a href="#" style={{ fontSize: 14, color: T.textSec, textDecoration: "none", fontWeight: 500 }}>Sign in</a>
          <Btn href={DMG} primary download>Download ↓</Btn>
        </div>
      </nav>

      {/* ══ HERO ═════════════════════════════════════════════════════ */}
      <section style={{ textAlign: "center", padding: "180px 40px 80px", maxWidth: 850, margin: "0 auto" }}>
        <Reveal>
          <h1 style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.08, margin: 0, letterSpacing: "-0.03em" }}>
            Turn ideas into code
          </h1>
        </Reveal>
        <Reveal delay={0.06}>
          <p style={{ fontSize: 20, color: T.textSec, lineHeight: 1.5, margin: "24px auto 0", maxWidth: 520 }}>
            Delegate implementation to<br />focus on higher-level direction.
          </p>
        </Reveal>
        <Reveal delay={0.12}>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 40 }}>
            <Btn href={DMG} primary download>Download for macOS ↓</Btn>
            <Btn href="/loginDeepControl?from=web">Start free trial →</Btn>
          </div>
        </Reveal>
      </section>

      {/* ══ HERO DEMO: Real screenshot of Tools AI IDE ═══════════════ */}
      <section style={{ padding: "0 40px 160px", maxWidth: 1100, margin: "0 auto" }}>
        <Reveal>
          <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: T.shadowXl, border: `1px solid ${T.border}` }}>
            <img
              src="/ide-screenshot.png"
              alt="Tools AI IDE — AI Builder with Master Planner, multi-model orchestration, Context Library, and integrated terminal"
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
        </Reveal>
      </section>

      {/* ══ SECTION: ORCHESTRATE (3-col grid with demos) ═════════════ */}
      <section id="features" style={{ padding: "160px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <Reveal>
          <SectionHead title={<>Understands your codebase,{"\n"}assigns the right model.</>}
            sub="Tools AI deeply learns your project before writing a single line. Each model gets the sub-task it's best at." />
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {[
            {
              title: "Multiple models",
              desc: "Subagents run in parallel to explore your codebase, with each one using the best model for the task.",
              demo: (
                <DemoFrame dark>
                  <div style={{ padding: "16px 18px", fontSize: 12, fontFamily: MONO, color: "rgba(255,255,255,0.5)", lineHeight: 2 }}>
                    <div style={{ color: "rgba(255,255,255,0.25)", marginBottom: 6 }}>Started 4 subagents ▾</div>
                    {[
                      { icon: "✦", name: "Set up model architecture", sub: "Editing files · Opus-4.6", active: true },
                      { icon: "✦", name: "Mission Control Interface", sub: "Building dashboard · Composer 2", active: true },
                      { icon: "✦", name: "Add evaluation metrics", sub: "Writing tests · GPT 5.2 Codex", active: true },
                      { icon: "○", name: "Implement training loop with AMP", sub: "Pending · Gemini 3 Pro", active: false },
                    ].map(a => (
                      <div key={a.name} style={{ padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 6, marginBottom: 4, border: "1px solid rgba(255,255,255,0.04)" }}>
                        <div style={{ display: "flex", gap: 6, color: a.active ? "#edecec" : "rgba(255,255,255,0.25)" }}>
                          <span>{a.icon}</span><span style={{ fontWeight: 500 }}>{a.name}</span>
                        </div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginLeft: 18 }}>{a.sub}</div>
                      </div>
                    ))}
                  </div>
                </DemoFrame>
              ),
            },
            {
              title: "Context Library",
              desc: "A custom indexing system gives agents best-in-class recall across your entire project — every file, every spec.",
              demo: (
                <DemoFrame dark>
                  <div style={{ padding: "16px 18px" }}>
                    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "10px 14px", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: "#edecec" }}>How does the payment flow handle failed transactions?</div>
                    </div>
                    <div style={{ fontSize: 11, fontFamily: MONO, color: "rgba(255,255,255,0.35)", lineHeight: 1.9 }}>
                      <div>Searched <span style={{ color: "rgba(255,255,255,0.5)" }}>payment retry logic</span></div>
                      <div>Read <span style={{ color: "rgba(255,255,255,0.5)" }}>checkout/PaymentService.ts</span></div>
                      <div>Read <span style={{ color: "rgba(255,255,255,0.5)" }}>lib/stripe/webhooks.ts</span></div>
                      <div>Read <span style={{ color: "rgba(255,255,255,0.5)" }}>db/transactions.ts</span></div>
                      <div>Grepped <span style={{ color: "rgba(255,255,255,0.5)" }}>handleFailedPayment</span></div>
                    </div>
                  </div>
                </DemoFrame>
              ),
            },
            {
              title: "Meeting Recorder",
              desc: "Record any call, extract actionable tasks with full context, and execute them against your codebase in one click.",
              demo: (
                <DemoFrame dark>
                  <div style={{ padding: "16px 18px" }}>
                    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#edecec", marginBottom: 6 }}>Sprint Planning · 32m</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", lineHeight: 1.7 }}>
                        <div>☐ Add auth to dashboard — <span style={{ color: "rgba(255,255,255,0.5)" }}>assigned Claude</span></div>
                        <div>☐ Fix chart responsiveness — <span style={{ color: "rgba(255,255,255,0.5)" }}>assigned GPT-4o</span></div>
                        <div style={{ color: "#4ade80" }}>☑ Update API endpoints — <span style={{ color: "rgba(255,255,255,0.3)" }}>completed · 4 files</span></div>
                        <div>☐ Add CSV export feature — <span style={{ color: "rgba(255,255,255,0.5)" }}>assigned Gemini</span></div>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>3 tasks ready to execute · 1 completed</div>
                  </div>
                </DemoFrame>
              ),
            },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 0.06}>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: T.text, marginBottom: 8 }}>{f.title}</div>
                  <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.6, marginBottom: 12 }}>{f.desc}</div>
                  <a href="#" style={{ color: T.accent, fontSize: 14, fontWeight: 500, textDecoration: "none" }}>Learn more →</a>
                </div>
                {f.demo}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══ DEV LIFECYCLE (3-col: Plan / Build / Fix) ════════════════ */}
      <section style={{ padding: "160px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <Reveal>
          <SectionHead
            title={<>Spans the full development lifecycle</>}
            sub="Tools AI supports every phase from planning to writing to reviewing code."
          />
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {[
            {
              title: "Plan",
              desc: "For complex tasks, the Master Planner asks clarifying questions, builds a plan, then executes in the background.",
              demo: (
                <DemoFrame>
                  <div style={{ padding: "4px 8px" }}>
                    <div style={{ fontSize: 12, color: T.textSec, marginBottom: 10 }}>How should Mission Control be opened?</div>
                    {[
                      { n: 1, t: "Gesture (swipe up with 3 fingers)", sel: false },
                      { n: 2, t: "Keyboard shortcut (e.g. CMD+F3)", sel: true },
                      { n: 3, t: "Both keyboard and button", sel: false },
                    ].map(o => (
                      <div key={o.n} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                        borderRadius: 6, marginBottom: 4,
                        background: o.sel ? T.greenLight : T.bg,
                        border: `1px solid ${o.sel ? T.green : T.border}`,
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: o.sel ? T.green : T.textTert, width: 16 }}>{o.n}</span>
                        <span style={{ fontSize: 13, color: o.sel ? T.green : T.text }}>{o.t}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
                      <span style={{ fontSize: 12, color: T.textTert, padding: "6px 12px", cursor: "pointer" }}>Skip</span>
                      <span style={{ fontSize: 12, color: T.white, background: T.accent, padding: "6px 14px", borderRadius: 6, fontWeight: 500 }}>Continue</span>
                    </div>
                    <div style={{ marginTop: 12, fontSize: 11, color: T.textTert }}>Add follow-up...</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                      <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, background: T.orangeLight, color: T.accent, fontWeight: 500 }}>⚡ Plan ▾</span>
                    </div>
                  </div>
                </DemoFrame>
              ),
            },
            {
              title: "Build",
              desc: "Multiple AI models write code in parallel, then refine together with shared context in Phase 2.",
              demo: (
                <DemoFrame>
                  <div style={{ padding: "4px 8px", fontSize: 12 }}>
                    <div style={{ fontWeight: 600, color: T.text, marginBottom: 10 }}>Phase 2 — Refinement</div>
                    <div style={{ color: T.textSec, lineHeight: 1.9 }}>
                      <div>Claude reviewed GPT-4o's layout <span style={{ color: T.green }}>✓</span></div>
                      <div>GPT-4o fixed Gemini's types <span style={{ color: T.green }}>✓</span></div>
                      <div>Gemini optimized Claude's queries <span style={{ color: T.green }}>✓</span></div>
                    </div>
                    <div style={{ marginTop: 12, padding: "8px 10px", background: T.greenLight, borderRadius: 6, fontSize: 12, color: T.green, fontWeight: 500 }}>
                      All agents converged · 12 files · deployed to workspace
                    </div>
                  </div>
                </DemoFrame>
              ),
            },
            {
              title: "Fix",
              desc: "The terminal loop instruments your code and uses real build output to pinpoint and apply the fix.",
              demo: (
                <DemoFrame dark>
                  <div style={{ padding: "16px 18px", fontFamily: MONO, fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.9 }}>
                    <div style={{ color: "#f87171" }}>Chart tooltips freeze when hovering over data points.</div>
                    <div style={{ marginTop: 6, color: "rgba(255,255,255,0.35)" }}>
                      Checked <span style={{ color: "rgba(255,255,255,0.5)" }}>server output</span><br />
                      Added <span style={{ color: "rgba(255,255,255,0.5)" }}>console logs</span><br />
                      Took <span style={{ color: "rgba(255,255,255,0.5)" }}>screenshot</span><br />
                      Read <span style={{ color: "rgba(255,255,255,0.5)" }}>ChartRenderer.tsx</span><br />
                    </div>
                    <div style={{ marginTop: 6, color: "#edecec" }}>Found it: stale closure in the hover handler.</div>
                    <div style={{ marginTop: 6, background: "rgba(255,255,255,0.04)", borderRadius: 4, padding: "6px 8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <span style={{ color: "rgba(255,255,255,0.3)" }}>📄</span> Tooltip.tsx <span style={{ color: "#4ade80" }}>+3</span> <span style={{ color: "#f87171" }}>-1</span>
                    </div>
                    <div style={{ marginTop: 6, color: "rgba(255,255,255,0.5)" }}>Fixed. Tooltips should update smoothly now.</div>
                  </div>
                </DemoFrame>
              ),
            },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 0.06}>
              <div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: T.text, marginBottom: 8 }}>{f.title}</div>
                  <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.6, marginBottom: 12 }}>{f.desc}</div>
                  <a href="#" style={{ color: T.accent, fontSize: 14, fontWeight: 500, textDecoration: "none" }}>Learn more →</a>
                </div>
                {f.demo}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══ TOOLS (Terminal / Live Preview / Context) ════════════════ */}
      <section style={{ padding: "160px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <Reveal>
          <SectionHead title="Equipped to do real engineering."
            sub={<>Tools AI edits files, runs terminal{"\n"}commands, previews your app, and more.</>} />
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {[
            {
              title: "Terminal",
              desc: "Run shell commands directly from the editor. Build, test, and deploy — sandboxed by default.",
              demo: (
                <DemoFrame>
                  <div style={{ padding: "4px 8px", fontSize: 12, color: T.textSec }}>
                    <div style={{ background: T.bg, borderRadius: 6, padding: "8px 10px", border: `1px solid ${T.border}`, marginBottom: 8, color: T.text }}>build this project</div>
                    <div style={{ lineHeight: 1.7, fontSize: 11, color: T.textTert }}>
                      Read <span style={{ color: T.textSec }}>package.json</span><br />
                      Ran <span style={{ color: T.textSec }}>terminal command</span>
                    </div>
                    <div style={{ background: T.codeBg, borderRadius: 6, padding: "10px 12px", fontFamily: MONO, fontSize: 11, color: "#D1D5DB", marginTop: 8, lineHeight: 1.7 }}>
                      <div>$ npm run build</div>
                      <div style={{ color: "rgba(255,255,255,0.3)" }}>Collecting page data...</div>
                      <div style={{ color: "rgba(255,255,255,0.3)" }}>Generating static pages (48/48)</div>
                      <div style={{ color: "rgba(255,255,255,0.3)" }}>Finalizing page optimization...</div>
                      <div style={{ color: "#4ade80" }}>✓ Compiled successfully in 3.8s</div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: T.text }}>Build complete. Ready to deploy?</div>
                  </div>
                </DemoFrame>
              ),
            },
            {
              title: "Live Preview",
              desc: "Your app runs in a built-in browser. Describe changes in English — AI edits the code, page reloads.",
              demo: (
                <DemoFrame>
                  <div style={{ padding: "4px 8px" }}>
                    <div style={{ background: T.bg, borderRadius: 8, padding: "10px 14px", border: `1px solid ${T.border}`, fontSize: 13, color: T.text, marginBottom: 8 }}>
                      Make <span style={{ background: T.blueLight, padding: "1px 5px", borderRadius: 4, color: T.blue, fontWeight: 500, fontFamily: MONO, fontSize: 12 }}>drawer.tsx</span> use <span style={{ background: T.blueLight, padding: "1px 5px", borderRadius: 4, color: T.blue, fontWeight: 500, fontFamily: MONO, fontSize: 12 }}>vaul.emilkowal.ski</span> and match our <span style={{ background: T.blueLight, padding: "1px 5px", borderRadius: 4, color: T.blue, fontWeight: 500, fontFamily: MONO, fontSize: 12 }}>brand</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: `1px solid ${T.border}`, color: T.textTert }}>⚡ Agent ▾</span>
                      <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, border: `1px solid ${T.border}`, color: T.textTert }}>Composer 2 ▾</span>
                    </div>
                  </div>
                </DemoFrame>
              ),
            },
            {
              title: "Git & checkpoints",
              desc: "See how your code has evolved, and roll back to a previous snapshot anytime.",
              demo: (
                <DemoFrame>
                  <div style={{ padding: "4px 8px", fontSize: 12, color: T.textSec }}>
                    {[
                      { t: "Set up Next.js project", d: "Jan 8", line: true },
                      { t: "Add Google OAuth", d: "Jan 12", line: true },
                      { t: "Build canvas editor", d: "Jan 18", line: true },
                      { t: "Add multiplayer", d: "Yesterday", line: false, active: true },
                      { t: "Improve performance", d: "3h ago", line: false },
                      { t: "Ship to production", d: "Now", line: false },
                    ].map(e => (
                      <div key={e.t} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
                        <span style={{ color: e.active ? T.text : T.textSec, fontWeight: e.active ? 500 : 400 }}>{e.t}</span>
                        <span style={{ fontSize: 11, color: T.textTert }}>{e.d} —</span>
                      </div>
                    ))}
                  </div>
                </DemoFrame>
              ),
            },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 0.06}>
              <div>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: T.text, marginBottom: 8 }}>{f.title}</div>
                  <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.6, marginBottom: 12 }}>{f.desc}</div>
                  <a href="#" style={{ color: T.accent, fontSize: 14, fontWeight: 500, textDecoration: "none" }}>Learn more →</a>
                </div>
                {f.demo}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══ PRICING ══════════════════════════════════════════════════ */}
      <section id="pricing" style={{ padding: "160px 40px", maxWidth: 1000, margin: "0 auto" }}>
        <Reveal><SectionHead title="Pricing" sub="Start with a 14-day free trial. No credit card required." center /></Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: T.border, borderRadius: 16, overflow: "hidden", border: `1px solid ${T.border}` }}>
          {[
            { name: "Free Trial", price: "$0", sub: "14 days, full access", features: ["All 5 AI models", "AI Builder + Master Planner", "Terminal auto-fix loop", "Context Library", "Meeting Recorder"], cta: "Start Free Trial", primary: false },
            { name: "Chad", price: "$25", priceSub: "/mo", sub: "Most users never pay more", features: ["Everything in Free Trial", "Generous AI usage included", "Small overage on heavy usage", "Set your own monthly cap", "Priority during peak hours"], cta: "Get Chad", primary: true, recommended: true, chad: true },
            { name: "Pay-as-you-go", price: "$0", priceSub: "/mo", sub: "Pay only when you use it", features: ["Everything in Free Trial", "No monthly commitment", "Per-call billing", "Monthly spending limit", "Upgrade to Chad anytime"], cta: "Get Started", primary: false },
          ].map((t, i) => (
            <Reveal key={t.name} delay={i * 0.05}>
              <div style={{ background: T.white, padding: "36px 28px", display: "flex", flexDirection: "column", height: "100%", position: "relative", overflow: "hidden" }}>
                {t.recommended && <div style={{ fontSize: 10, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Recommended</div>}
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>{t.name}</div>
                {t.chad && <img src="/chad.png" alt="Chad" style={{
                  position: "absolute", top: -30, right: -20,
                  width: 150, height: 150,
                  objectFit: "cover", objectPosition: "center top",
                  borderRadius: "50%",
                  border: "4px solid #E5E7EB",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
                  filter: "grayscale(1) contrast(1.1)",
                  zIndex: 2,
                }} />}
                <div style={{ fontSize: 48, fontWeight: 700, marginBottom: 4, lineHeight: 1 }}>{t.price}{t.priceSub && <span style={{ fontSize: 16, fontWeight: 400, color: T.textTert }}>{t.priceSub}</span>}</div>
                <div style={{ fontSize: 14, color: T.textTert, marginBottom: 28 }}>{t.sub}</div>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
                  {t.features.map(f => <li key={f} style={{ fontSize: 14, color: T.textSec, display: "flex", gap: 8 }}><span style={{ color: T.textTert }}>✓</span>{f}</li>)}
                </ul>
                <Btn href="/loginDeepControl?from=pricing" primary={t.primary} style={{ marginTop: 32, width: "100%", justifyContent: "center" }}>{t.cta}</Btn>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══ FINAL CTA ════════════════════════════════════════════════ */}
      <section style={{ textAlign: "center", padding: "200px 40px 160px" }}>
        <Reveal>
          <h2 style={{ fontSize: 52, fontWeight: 700, margin: "0 0 32px", letterSpacing: "-0.02em" }}>Get started with Tools AI.</h2>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Btn href={DMG} primary download>Download ↓</Btn>
            <Btn href="/loginDeepControl?from=web">Start Free Trial</Btn>
          </div>
        </Reveal>
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════════════════ */}
      <footer style={{ borderTop: `1px solid ${T.border}`, padding: "56px 40px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 40, marginBottom: 48 }}>
          {[
            { h: "Product", links: ["AI Builder", "Master Planner", "Terminal Loop", "Context Library", "Meeting Recorder", "Live Preview"] },
            { h: "Resources", links: ["Download", "Changelog", "Documentation", "Blog"] },
            { h: "Company", links: ["About", "Careers", "Contact"] },
            { h: "Legal", links: ["Terms of Service", "Privacy Policy", "Security"] },
            { h: "Connect", links: ["X", "LinkedIn", "YouTube", "GitHub"] },
          ].map(col => (
            <div key={col.h}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 16 }}>{col.h}</div>
              {col.links.map(l => <a key={l} href={l === "Download" ? DMG : l === "Terms of Service" ? "/terms" : l === "Privacy Policy" ? "/privacy" : "#"} style={{ display: "block", fontSize: 14, color: T.textSec, textDecoration: "none", marginBottom: 10 }}>{l}</a>)}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: T.textTert }}>
          <span>© {new Date().getFullYear()} Tools AI</span>
        </div>
      </footer>
    </div>
  );
}

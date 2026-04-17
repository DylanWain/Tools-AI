import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

/* ═══════════════════════════════════════════════════════════════════════════
 * TOOLS AI — LANDING PAGE v6 (Dark + Starfield + Product Demos)
 *
 * Linear/SpaceX aesthetic:
 *   - Deep navy-black background (#0a0a14)
 *   - 3-layer parallax starfield (behind everything, 25/35/50% scroll rates)
 *   - Full-width animated product demos replicating the real app
 *   - Framer Motion parallax on key sections
 *   - Orange accent (#EA580C) preserved as brand
 * ═══════════════════════════════════════════════════════════════════════ */

// Lazy-load heavy components so first paint is quick and SSR doesn't choke on
// browser-only APIs (canvas, window, matchMedia).
const Starfield           = dynamic(() => import("./landing/Starfield"),           { ssr: false });
const ParallaxSection     = dynamic(() => import("./landing/ParallaxSection"),     { ssr: false });
const DemoAIBuilder       = dynamic(() => import("./landing/DemoAIBuilder"),       { ssr: false });
const DemoMeetingRecorder = dynamic(() => import("./landing/DemoMeetingRecorder"), { ssr: false });
const DemoTerminal        = dynamic(() => import("./landing/DemoTerminal"),        { ssr: false });
const DemoLivePreview     = dynamic(() => import("./landing/DemoLivePreview"),     { ssr: false });
const DemoContextLibrary  = dynamic(() => import("./landing/DemoContextLibrary"),  { ssr: false });
const DemoDiffReview      = dynamic(() => import("./landing/DemoDiffReview"),      { ssr: false });
const DemoProfileSwitcher = dynamic(() => import("./landing/DemoProfileSwitcher"), { ssr: false });

const T = {
  bg: "#0a0a14",
  bgElev: "#12121f",
  surface: "#1a1a2e",
  text: "#ededec",
  textSec: "rgba(237,236,236,0.65)",
  textTert: "rgba(237,236,236,0.35)",
  border: "rgba(255,255,255,0.08)",
  borderMed: "rgba(255,255,255,0.14)",
  accent: "#EA580C",
  accentSoft: "rgba(234,88,12,0.14)",
  btnBg: "#ededec",
  btnText: "#0a0a14",
  btnSec: "rgba(255,255,255,0.06)",
  success: "#40c977",
  error: "#ff6764",
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

/* ── Reveal (400ms ease-out, 20px Y, staggered) ───────────────────── */
const Reveal = ({ children, delay = 0, style = {} }) => {
  const [ref, v] = useInView();
  return (
    <div ref={ref} style={{
      opacity: v ? 1 : 0,
      transform: v ? "none" : "translateY(20px)",
      transition: `opacity 0.6s ease-out ${delay}s, transform 0.6s ease-out ${delay}s`,
      ...style,
    }}>{children}</div>
  );
};

/* ── Pill Button ───────────────────────────────────────────────────── */
const Btn = ({ children, href, primary, style: s = {}, ...r }) => (
  <a href={href} style={{
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    height: 46, padding: "0 26px", borderRadius: 9999,
    background: primary ? T.btnBg : T.btnSec,
    color: primary ? T.btnText : T.text,
    border: primary ? "none" : `1px solid ${T.borderMed}`,
    fontSize: 15, fontWeight: 500, fontFamily: F, textDecoration: "none", cursor: "pointer",
    transition: "all 0.2s ease",
    backdropFilter: primary ? "none" : "blur(12px)",
    ...s,
  }} {...r}>{children}</a>
);

/* ── Section wrapper ───────────────────────────────────────────────── */
const Section = ({ children, style = {}, id, paddingY = 140 }) => (
  <section id={id} style={{
    position: "relative", zIndex: 2,
    padding: `${paddingY}px 24px`,
    ...style,
  }}>
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>{children}</div>
  </section>
);

/* ── Section headline (kicker + multi-line title + subtitle) ──────── */
const SectionHead = ({ kicker, title, subtitle, align = "left" }) => (
  <div style={{ textAlign: align, maxWidth: 780, marginLeft: align === "center" ? "auto" : 0, marginRight: align === "center" ? "auto" : 0 }}>
    {kicker && (
      <div style={{
        fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase",
        color: T.accent, fontWeight: 600, marginBottom: 18,
      }}>{kicker}</div>
    )}
    <h2 style={{
      fontSize: 54, lineHeight: 1.05, fontWeight: 600,
      letterSpacing: "-0.02em", color: T.text, marginBottom: 20,
    }}>{title}</h2>
    {subtitle && (
      <p style={{
        fontSize: 19, lineHeight: 1.55, color: T.textSec,
        maxWidth: 620, marginLeft: align === "center" ? "auto" : 0, marginRight: align === "center" ? "auto" : 0,
      }}>{subtitle}</p>
    )}
  </div>
);

/* ═══════════════════════════════════════════════════════════════════ */
export default function ToolsAILanding() {
  const scrolled = useScrolled();

  return (
    <div style={{
      fontFamily: F,
      background: T.bg,
      color: T.text,
      minHeight: "100vh",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Fixed starfield background — behind everything */}
      <Starfield />

      {/* Ambient radial glow behind hero */}
      <div style={{
        position: "fixed",
        top: "-40vh", left: "50%",
        transform: "translateX(-50%)",
        width: "120vw", height: "120vh",
        background: "radial-gradient(ellipse at center, rgba(234,88,12,0.06) 0%, transparent 60%)",
        pointerEvents: "none",
        zIndex: 1,
      }} />

      {/* ─── NAV ─── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "16px 24px",
        background: scrolled ? "rgba(10,10,20,0.7)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? `1px solid ${T.border}` : "1px solid transparent",
        transition: "all 0.3s ease",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: T.text }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L14.5 8.5H21L15.5 13L17.5 20L12 16L6.5 20L8.5 13L3 8.5H9.5Z" fill={T.accent} stroke={T.accent} />
            </svg>
            <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" }}>Tools AI</span>
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <a href="#features" style={{ fontSize: 14, color: T.textSec, textDecoration: "none" }}>Product</a>
            <a href="#pricing" style={{ fontSize: 14, color: T.textSec, textDecoration: "none" }}>Pricing</a>
            <a href="/login" style={{ fontSize: 14, color: T.textSec, textDecoration: "none" }}>Sign in</a>
            <Btn href={DMG} primary download>Download</Btn>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <Section style={{ paddingTop: 180, paddingBottom: 100 }} paddingY={0}>
        <div style={{ textAlign: "center", position: "relative" }}>
          <Reveal>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 14px", borderRadius: 99,
              background: T.btnSec, border: `1px solid ${T.borderMed}`,
              fontSize: 13, color: T.textSec, marginBottom: 28,
              backdropFilter: "blur(12px)",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.success }} />
              v2.0.3 — 5 AI models, now available on macOS
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 style={{
              fontSize: "clamp(44px, 7vw, 88px)",
              lineHeight: 1.02,
              fontWeight: 600,
              letterSpacing: "-0.035em",
              marginBottom: 24,
              color: T.text,
              maxWidth: 900, marginLeft: "auto", marginRight: "auto",
            }}>
              Every AI.
              <br />
              <span style={{ color: T.accent }}>One workspace.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p style={{
              fontSize: 20, lineHeight: 1.55,
              color: T.textSec,
              maxWidth: 600, margin: "0 auto 36px",
            }}>
              Claude, GPT-4o, Gemini, Grok, and Perplexity — collaborating on your code in parallel. One subscription, five models, no decision fatigue.
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Btn href={DMG} primary download>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                Download for macOS
              </Btn>
              <Btn href="#features">See what&apos;s inside →</Btn>
            </div>
          </Reveal>
          <Reveal delay={0.28}>
            <div style={{
              fontSize: 13, color: T.textTert, marginTop: 22,
              display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap",
            }}>
              <span>✓ 14-day free trial</span>
              <span>✓ No credit card</span>
              <span>✓ Universal (Intel + Apple Silicon)</span>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ─── DEMO 1: AI Builder ─── */}
      <Section id="features" paddingY={100}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <SectionHead
              kicker="AI Builder"
              title={<>5 AI models,<br />collaborating.</>}
              subtitle="Claude plans, GPT-4o scaffolds, Gemini refines, Grok stress-tests, Perplexity verifies. All in parallel, sharing context between phases. You get the best of every model, not a coin toss."
              align="center"
            />
          </div>
        </Reveal>
        <ParallaxSection rate={0.94}>
          <Reveal delay={0.1}><DemoAIBuilder /></Reveal>
        </ParallaxSection>
      </Section>

      {/* ─── DEMO 2: Meeting Recorder ─── */}
      <Section paddingY={100}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <SectionHead
              kicker="Meeting Recorder"
              title={<>From meeting<br />to code.</>}
              subtitle="Record your calls. Whisper transcribes. Claude extracts actionable tasks. Execute them against your codebase with one click. Your standups become commits."
              align="center"
            />
          </div>
        </Reveal>
        <ParallaxSection rate={0.94}>
          <Reveal delay={0.1}><DemoMeetingRecorder /></Reveal>
        </ParallaxSection>
      </Section>

      {/* ─── DEMO 3: Terminal ─── */}
      <Section paddingY={100}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <SectionHead
              kicker="AI Terminal"
              title={<>A terminal that<br />understands you.</>}
              subtitle="Type shell commands like always. Type naturally and you&apos;re talking to AI. Same prompt, same keys, same history — now infinitely smarter."
              align="center"
            />
          </div>
        </Reveal>
        <ParallaxSection rate={0.94}>
          <Reveal delay={0.1}><DemoTerminal /></Reveal>
        </ParallaxSection>
      </Section>

      {/* ─── DEMO 4: Live Preview ─── */}
      <Section paddingY={100}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <SectionHead
              kicker="Live Preview"
              title={<>Edit your site<br />like a document.</>}
              subtitle="Describe the change. AI rewrites the code. Page updates in real time. No more hunting for the right CSS file."
              align="center"
            />
          </div>
        </Reveal>
        <ParallaxSection rate={0.94}>
          <Reveal delay={0.1}><DemoLivePreview /></Reveal>
        </ParallaxSection>
      </Section>

      {/* ─── DEMO 5+6: Context Library + Diff Review ─── */}
      <Section paddingY={100}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <SectionHead
              kicker="Context + Review"
              title={<>Inputs in,<br />reviewed outputs out.</>}
              subtitle="Upload design specs, docs, or reference code. Every AI call has context. Review every change with red/green diffs. Accept what&apos;s right, reject what isn&apos;t."
              align="center"
            />
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 28 }}>
          <ParallaxSection rate={0.96}>
            <Reveal delay={0.1}><DemoContextLibrary /></Reveal>
          </ParallaxSection>
          <ParallaxSection rate={0.98}>
            <Reveal delay={0.15}><DemoDiffReview /></Reveal>
          </ParallaxSection>
        </div>
      </Section>

      {/* ─── DEMO 7: Profile Switcher ─── */}
      <Section paddingY={100}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <SectionHead
              kicker="Profiles"
              title={<>8 workflows.<br />Zero setup.</>}
              subtitle="We pick the best-in-class extensions for each type of work — web dev, research, data science, design — so you don&apos;t have to. Switch profiles any time."
              align="center"
            />
          </div>
        </Reveal>
        <ParallaxSection rate={0.94}>
          <Reveal delay={0.1}><DemoProfileSwitcher /></Reveal>
        </ParallaxSection>
      </Section>

      {/* ─── PRICING ─── */}
      <Section id="pricing" paddingY={140}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <SectionHead
              kicker="Pricing"
              title={<>Simple. Honest.<br />All models included.</>}
              subtitle="Other tools charge you for each model separately. We don&apos;t."
              align="center"
            />
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {/* Free Trial */}
          <Reveal delay={0.05}>
            <PricingCard
              name="Free Trial"
              price="$0"
              period="for 14 days"
              description="Try everything. No credit card."
              features={["All 5 AI models", "Unlimited usage during trial", "All features unlocked", "Converts to Chad if you love it"]}
              cta="Start free trial"
              ctaHref="/login"
            />
          </Reveal>
          {/* Chad — highlighted */}
          <Reveal delay={0.1}>
            <PricingCard
              name="Chad"
              price="$25"
              period="per month"
              description="For developers who ship."
              features={["All 5 AI models, always", "$15 of usage included", "Meeting recorder + transcription", "All 8 profiles", "Priority updates"]}
              cta="Get Chad"
              ctaHref={DMG}
              highlighted
            />
          </Reveal>
          {/* PAYG */}
          <Reveal delay={0.15}>
            <PricingCard
              name="Pay-as-you-go"
              price="$0"
              period="base + usage"
              description="For occasional use."
              features={["Pay only for what you use", "All 5 AI models available", "$0.03/credit metered", "No minimum commitment"]}
              cta="Start PAYG"
              ctaHref="/login"
            />
          </Reveal>
        </div>
      </Section>

      {/* ─── FINAL CTA ─── */}
      <Section paddingY={120}>
        <div style={{
          textAlign: "center", maxWidth: 720, margin: "0 auto",
          padding: "80px 40px",
          background: "linear-gradient(180deg, rgba(234,88,12,0.08) 0%, rgba(234,88,12,0.02) 100%)",
          border: `1px solid ${T.border}`,
          borderRadius: 24,
          position: "relative", overflow: "hidden",
        }}>
          <Reveal>
            <h2 style={{
              fontSize: 48, lineHeight: 1.1, fontWeight: 600,
              letterSpacing: "-0.02em", marginBottom: 16,
            }}>
              Ready to meet your<br />new AI team?
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p style={{
              fontSize: 17, color: T.textSec, marginBottom: 32,
              maxWidth: 480, margin: "0 auto 32px", lineHeight: 1.55,
            }}>
              Download Tools AI and get 14 days of unlimited access to all 5 models. No credit card.
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Btn href={DMG} primary download>Download for macOS</Btn>
              <Btn href="/login">Sign in</Btn>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ─── FOOTER ─── */}
      <footer style={{
        position: "relative", zIndex: 2,
        padding: "60px 24px 40px",
        borderTop: `1px solid ${T.border}`,
        background: "rgba(10,10,20,0.5)",
        backdropFilter: "blur(12px)",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 40,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L14.5 8.5H21L15.5 13L17.5 20L12 16L6.5 20L8.5 13L3 8.5H9.5Z" fill={T.accent} stroke={T.accent} />
              </svg>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Tools AI</span>
            </div>
            <div style={{ fontSize: 13, color: T.textTert, lineHeight: 1.6, maxWidth: 280 }}>
              The AI IDE for people who want all the models, not just one.
            </div>
          </div>
          {[
            { title: "Product", links: [["Download", DMG], ["Pricing", "#pricing"], ["Features", "#features"]] },
            { title: "Resources", links: [["Blog", "/blog"], ["Release notes", "https://github.com/DylanWain/Tools-AI-APP/releases"]] },
            { title: "Company", links: [["About", "#"], ["Contact", "mailto:hello@thetoolswebsite.com"]] },
            { title: "Legal", links: [["Terms", "/terms"], ["Privacy", "/privacy"]] },
          ].map(col => (
            <div key={col.title}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 12,
                textTransform: "uppercase", letterSpacing: 0.5,
              }}>{col.title}</div>
              {col.links.map(([label, href]) => (
                <a key={label} href={href} style={{
                  display: "block", fontSize: 13, color: T.textSec,
                  textDecoration: "none", marginBottom: 8,
                }}>{label}</a>
              ))}
            </div>
          ))}
        </div>
        <div style={{
          maxWidth: 1200, margin: "40px auto 0",
          paddingTop: 24, borderTop: `1px solid ${T.border}`,
          display: "flex", justifyContent: "space-between",
          fontSize: 12, color: T.textTert,
        }}>
          <div>© 2026 Tools AI · Made in California</div>
          <div>v2.0.3</div>
        </div>
      </footer>
    </div>
  );
}

/* ── Pricing card ─────────────────────────────────────────────────── */
function PricingCard({ name, price, period, description, features, cta, ctaHref, highlighted }) {
  return (
    <div style={{
      position: "relative",
      padding: 32,
      background: highlighted ? "linear-gradient(180deg, rgba(234,88,12,0.08) 0%, rgba(234,88,12,0.02) 100%)" : T.bgElev,
      border: `1px solid ${highlighted ? "rgba(234,88,12,0.3)" : T.border}`,
      borderRadius: 16,
      display: "flex", flexDirection: "column",
      boxShadow: highlighted ? "0 12px 48px rgba(234,88,12,0.12)" : "none",
    }}>
      {highlighted && (
        <div style={{
          position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
          padding: "4px 12px", background: T.accent, color: "#fff",
          fontSize: 11, fontWeight: 600, borderRadius: 99,
          textTransform: "uppercase", letterSpacing: 0.5,
        }}>Most popular</div>
      )}
      <div style={{ fontSize: 13, fontWeight: 600, color: T.textSec, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {name}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 48, fontWeight: 600, letterSpacing: "-0.02em" }}>{price}</span>
        <span style={{ fontSize: 14, color: T.textTert }}>{period}</span>
      </div>
      <div style={{ fontSize: 14, color: T.textSec, marginBottom: 24, lineHeight: 1.5 }}>{description}</div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {features.map(f => (
          <div key={f} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14, color: T.textSec, lineHeight: 1.5 }}>
            <span style={{ color: highlighted ? T.accent : T.success, flexShrink: 0 }}>✓</span>
            <span>{f}</span>
          </div>
        ))}
      </div>
      <Btn href={ctaHref} primary={highlighted} download={ctaHref === DMG} style={{ width: "100%" }}>
        {cta}
      </Btn>
    </div>
  );
}

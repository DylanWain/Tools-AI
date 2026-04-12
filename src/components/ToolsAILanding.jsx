import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
 * TOOLS AI — LANDING PAGE (Cursor-quality dark redesign)
 *
 * Structure: Nav → Hero → App Mockup → Features → Product Showcase →
 *            Pricing (#pricing) → Download CTA → Footer
 * ═══════════════════════════════════════════════════════════════════════ */

const IC = {
  chatgpt: "data:image/png;base64,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",
  claude: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAYAAAByDd+UAAAABmJLR0QA/wD/AP+gvaeTAAAFO0lEQVRIiaWWeWxUVRTGf+dOKUyxLFoFDWggTFtAQCLBEJWEQFwSSqI4nQoorsQokRjCTIEQn0igHUsgbkTQSoIK0xFcICGAxhKNOxL+qHSmbMYFaoBSih1KZ+7xj5lpp8sUjN9f957z3fO97773zr1CFjQ48wfZWPw74HoRXVxYUbOzO+fEikeHtdvEgvwBsU23OLtbs9XKhMmWSMTanwPGAcNVpUIdpwe3PW6rUalqaXUvuxaxPgVRcyJjNiYSO1rSJe04BmFWkmou/2/BSxcGfQbUpeciLM3MR1si1wO5AGJtJDMXCfgejAR89RG/b8s1C07ZvLndWPtCR0C5N+L3Tu1YmBu/KT22Lvm1Q8xfNhP4BChCeCa6zHtHr4JRv+/hiL90b9TvezId87wWPigQ7mSbVR3jODemRi3F/cceSzmbhOguoH8qd8kdp4v7DkEV/Ig8oEJ1fcBX/ftLXjdAPO5aBsRSLmdHl5fdBWCNuTm5Uo6I49ijyx+6IeVsUOeuyPMjN4RjvQoiEuoYwpOtuebbaPm80ePWf/SbIus7ts/q6iSdkcma9hf1el3G5u4ARnXW482i4I5tdINkTur9ZXNE9D2gIBVqVnQRenmviLsBGJZUlenqso+IyouiPKVGPKguzyj1Q9xtp493wle6C3b5aIqDOz5XlUkK+1OhwYKEBHcVEOx8TC1HpSDpkEJUAxkOmhJxl683sR4O01CQaLnvaZQqYHCK2KDgSVHagHpgUo+CytzCYGhXb3WzCqZxbGXZSBvXLQr398XLqLanqCJU8pdTknexzT1ZEjIZkYmgE4CxCrtEQQQ0Ww0FaSgve1ZVq4D8q0h+BQwBJgA5PZ9HqiUS8NUDtwJNopxX4TzQhMgFxTaLmkbQP1Q0T1Q2AAOuyS20AIdBD4H8mHD1Ozhu7Qenc0T0FbU8jsgQFfKBEQITrGp/QfLS5kX73H2As4LWWuQbl+XrMafsEQmHEz1dXgOOB7yD40buxsqnQL8stATQCPwtSAJAsc1gzgp6TuGYab341lUFG/zzR1iTWIPqYyR/ozY6W1cmvhRhn8J0Ue5WGNqdoLA/a/Ouc7zXRctLVyckHkF1IWijoKtItrm2XpbMRCkorAjN8bjHFljsRJDFwA7gT6Bd0IZeHUb8pQsR1oHcDKjCViOuNaqJA8AoFdaKshLkHOgNqWVtQH+F90+7GxfNcGrj3Q2Md8KXugjWLfMOdxmzWSB92J4SNYs8we1fRAK+zwRKUNar0WOiskmFUpStAnmCfqzIEGAWwp78Aa2+3q4dnaeF45gcYw6nxKyKvn45kXt7YXD7gWjAF0jFf4rn2RVGpQjAtrt+RKUi+X5kriAbFd5Bmd0SG7jveMA7OKtgLbUG+B741Bh7T3FFzZJJVdv+iZaXzgLWAM0irrLxTviKplqaOz+30RVrDgJHAVHVTS53jl8EP+i0OKb2xIpHh2UK9vmV/rp03m2unMTPQIGivuLKmhp1HBONHW0CbFFlaChAw3LvNGvNN4BBebcoGHq23l86Q4QPQZqKKkPjezjsjpPOEwNycuxOoAD0reLKmhqASGudh+QheybN9awLfwdsTFl4uqHcd19xsOarfi7XZODjzBtfj36XRlus9VVB7hQIe07oks6MmZLamjOZfNN6cYUdOGgWykSrzAf2j167vRF4uQsvm6AgRmFnu9su6NKijE4FUKUxk+95Y2+bUTNPkEPAkWx1szosqgwt7S0uylgAka4OATyV2+uAKdlqQl8X4WxQ3gZOqsru/7wW+Bc3Thv/NSKR4QAAAABJRU5ErkJggg==",
  gemini: "data:image/png;base64,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",
  grok: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAYAAAByDd+UAAADBElEQVR4nL3WPYhdVRAH8N97u9FEozGEYIKLQY1uFCOIiiKibmEREBEERU0h2BiwsNHK0iYWlhICfiAhsOUKio0fIAbxA0VjEEVioaJG0Sghxt3sszgz756971520zhwOPecMzP/+Tgz5/L/0CDmXcNzFJrCdMxTrfWgR24aIzyEM2sBTKARzmIp5rOt9Sj4aloX58/E2fHpVcCGWA6FF2EOd+AqbMBJfI338H7w1WCLeAr3xGgbtILy8Lvwom98hn3YGDKwN86ubens9Ex48uEqQPX4GLMhe3/svVmDdYU0w7gT72Im1kN8ggV8roRzM27H1XgRb4eOPZiP7wXlHnReqkEovhBHw8JlnMAjfeFo0RxOK/lcjvXYwzbl5v4AW8KPmhwMdZfF+XF+G/4NoKXQcXMfYOZtBqfCwkUlZDQXoU2ZlhvwuyafWSp39gGm4NOV0MHYW9cDlkmuqcDm8XMF+GhL/5hSw3eUkCxit6bw+8Aux28BeF/sPVkZ/XwXYN6gC/BDMB6rjOgD265cqI+wozq7TpPDt1oyK7y7DH8H4+tdjNV6Wxj3UiWfod+MXzUNYQIoabraO22ydoZKbmbwhhKux0PxMLwSc353lkMq3qLkY6Qp4mGLZwdew92VkYMWb970ET5oya8AHeCLYPxFadjZDAZKGJ9QQp9gNSX4Hk3TeLWHd7xxQHPD9sZeFvisJk9doUodhysdj/UBpoK5yrpvcXHlZVJXX0yFN+LfkD+JrX0yubFJqaks3FcqhfXrnmNo5e08VsnubznTCbhRU4vf4Rb9naamWXyqCeXxMD7zP0FTcbgrBL5UukjSVjwc59msNyjd6DklfAl2Kgylv3mMvZgPsC2V5S/gp1C2qLz+R2PO8OU4oSmZ3hc+E/4AjuCSSuBWJS9refEXcOVqYHlwE15Wcshk7O/FIXyDv/AP/sRXyqtyV4fOXtqJZ5WXPsF0fFOisR1X4NIO3lV/PbfhQazvAUjKF/5czyboes2F6ft7rilrL0O+Fpkx/QcHAsqnAxpyJAAAAABJRU5ErkJggg==",
  perplexity: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAF9klEQVR4nM2aW4iVVRTHf+fMVWcshBx1uphUJIQ4WnihC5VojkHRVbQegiAKIlHopXBQFCyEHnrIiughMkodsh6SzIKEFAmiB7u8VGP10Exl2kyTembm62GvNXudPd/1zJmhBR/fd9bee63/f1++vdb+DiRLSe5XAM8bXSm++oR2C4HP5FoYlGW1b5DnDcAN8lzO0TYWyHwgAvYafZoxLVsm7SJ5zgOibPxukba3yO+G2BYpYgmcFWPvAk0ZYFTfBYzK1ZXRxgIsA6/gya8IynOLJTAIjIjBw8CsFKOWgILoCspCaZT7bLEfARflvirFV6F5pQbWAUeAubjeLdwzgTTiOmcR8LnYV32mFF0YnwAVYCVucV6NI5HLWYwo+DU48IuB88DrwAWpE9Vou2oKnRNDy4EH8dPpJ3GqYCDfFLJvmifw0+UMsBq4DBgT3UqpN6k1oATuFt39wD+iG8C/KRpzELCj/oKp8z2wRPSLcSNbdwJ3GUO3Ab+LftCQa0kh0Cz3NmC/Kf8U6DAkF00lAYBWuS8B+qZd0Kq0j9Rr+VTmKy6nvk7KkUVeb6wOf4XXcYg6NDQD9VOfEDbhoMutsfxTXw28DDwegLgEOAE8Dr4o+LbtDyvvFrmJpEoyJMhOXULeL03bgWpLPhezzpbhjd+2pI7hD2xFcIq96fVXaEbN2uqXeOfFtscwSjIWkI4WA3ufhjkziDrZGcLnsQVOun6uUSByBs/jz0txSMpf2UGcCAZ1+1wDfGXCbRX+j0emHureMrhe3w6u9OAKdAZY8HxmryED64e4y4Bcpuwg8KfrwcFc/8gG8aPTHcOsLfIppCcwPsBSSrOP1O4A/RT9E9vF6CR8abDFlp3BzHRzxKSWgIB/AH9QOALeKvon0Dxx26m0E/pXyX/FnoPdMJYHlwEP4d3QftX1i0rprcLttBPwN3C4+6k5gUIzqR74I+Ab3kc8CykvAtlmKO/9UEgfMc90J6HUCd2oNE3flIt+JlcQC4OvAx2AeAkVyYk1cPsaFuv34HbhWGREbp4E78YdWk7E5LnF/NXiPqfmrgY5iM+7vDLoG5gVYCsl0/9nDhhYvS7u6rIHp/LuN7ZxngMuz2v0Hu64ruGvEYGEAAAAASUVORK5CYII=",
};

const useInView = (t = 0.15) => {
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
    const h = () => setS(window.scrollY > 40);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  return s;
};

const Reveal = ({ children, delay = 0, y = 30, style = {} }) => {
  const [ref, v] = useInView();
  return <div ref={ref} style={{ opacity: v ? 1 : 0, transform: v ? "none" : `translateY(${y}px)`, transition: `all 0.8s cubic-bezier(.22,1,.36,1) ${delay}s`, ...style }}>{children}</div>;
};

const PIcon = ({ id, size = 18 }) => <img src={IC[id]} alt={id} width={size} height={size} style={{ borderRadius: 3 }} />;
const Dots = () => <div style={{ display: "flex", gap: 6 }}>{["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}</div>;

const DMG = "https://github.com/DylanWain/Tools-AI-APP/releases/latest/download/Tools-AI-1.1.0.dmg";
const MODELS = [{ id: "chatgpt", label: "GPT-4o" }, { id: "claude", label: "Claude" }, { id: "gemini", label: "Gemini" }, { id: "grok", label: "Grok" }, { id: "perplexity", label: "Perplexity" }];

export default function ToolsAILanding() {
  const scrolled = useScrolled();
  return (
    <div style={{ background: "#0a0a0f", color: "#f0f0f5", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', minHeight: "100vh" }}>

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", background: scrolled ? "rgba(10,10,15,0.92)" : "transparent", backdropFilter: scrolled ? "blur(12px)" : "none", borderBottom: scrolled ? "1px solid #1e1e2e" : "1px solid transparent", transition: "all 0.3s" }}>
        <a href="/" style={{ fontSize: 15, fontWeight: 700, color: "#f0f0f5", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 18 }}>⚡</span> Tools AI</a>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {["Features", "Pricing", "Download"].map(l => <a key={l} href={`#${l.toLowerCase()}`} style={{ fontSize: 13, color: "#9090aa", textDecoration: "none", fontWeight: 500 }}>{l}</a>)}
          <a href="/loginDeepControl?from=desktop" style={{ fontSize: 12, fontWeight: 600, padding: "7px 16px", borderRadius: 6, background: "#818cf8", color: "#0a0a0f", textDecoration: "none" }}>Start Free Trial</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ textAlign: "center", paddingTop: 140, paddingBottom: 40, position: "relative" }}>
        <div style={{ position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(129,140,248,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
        <Reveal><h1 style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.1, margin: "0 auto", maxWidth: 720, letterSpacing: -1.5 }}><span style={{ background: "linear-gradient(135deg, #818cf8, #a78bfa, #c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Every AI model.</span><br />One powerful editor.</h1></Reveal>
        <Reveal delay={0.1}><p style={{ fontSize: 18, color: "#9090aa", maxWidth: 540, margin: "20px auto 0", lineHeight: 1.6 }}>Claude, GPT-4o, Gemini, Grok, and Perplexity — orchestrated together. Build faster with AI that plans, codes, tests, and fixes errors automatically.</p></Reveal>
        <Reveal delay={0.2}><div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32 }}>
          <a href={DMG} download style={{ padding: "12px 28px", borderRadius: 8, background: "#818cf8", color: "#0a0a0f", fontSize: 14, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 16 }}>↓</span> Download for macOS</a>
          <a href="#pricing" style={{ padding: "12px 28px", borderRadius: 8, border: "1px solid #2a2a3e", color: "#9090aa", fontSize: 14, fontWeight: 500, textDecoration: "none" }}>See Pricing</a>
        </div></Reveal>
        <Reveal delay={0.3}><div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 40 }}>{MODELS.map(m => <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 6 }}><PIcon id={m.id} size={16} /><span style={{ fontSize: 11, color: "#5a5a7a", fontWeight: 500 }}>{m.label}</span></div>)}</div></Reveal>
      </section>

      {/* APP MOCKUP */}
      <section style={{ padding: "40px 40px 100px", maxWidth: 960, margin: "0 auto", position: "relative" }}>
        <Reveal>
          <div style={{ borderRadius: 12, overflow: "hidden", background: "#0e0e11", boxShadow: "0 40px 120px rgba(129,140,248,0.08), 0 15px 40px rgba(0,0,0,0.3)", border: "1px solid #1e1e2e" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "9px 13px", background: "#14141a", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <Dots />
              <div style={{ flex: 1, display: "flex", justifyContent: "center", gap: 2 }}>{MODELS.map((m, i) => <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 4, background: i === 0 ? "rgba(255,255,255,0.05)" : "transparent" }}><PIcon id={m.id} size={12} /><span style={{ fontSize: 10, color: i === 0 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)", fontWeight: i === 0 ? 600 : 400 }}>{m.label}</span></div>)}</div>
            </div>
            <div style={{ padding: "32px 40px", display: "flex", gap: 24, minHeight: 300 }}>
              <div style={{ width: 180, borderRight: "1px solid rgba(255,255,255,0.04)", paddingRight: 20, flexShrink: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#5a5a7a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>AI Builder</div>
                {["Master Task", "Claude", "GPT-4o", "Gemini"].map((s, i) => <div key={s} style={{ fontSize: 11, color: i === 0 ? "#818cf8" : "#5a5a7a", padding: "6px 8px", borderRadius: 4, background: i === 0 ? "rgba(129,140,248,0.08)" : "transparent", marginBottom: 2 }}>{s}</div>)}
                <div style={{ marginTop: 20, fontSize: 9, fontWeight: 700, color: "#5a5a7a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Context Library</div>
                {["api-spec.json", "design.md"].map(f => <div key={f} style={{ fontSize: 10, color: "#5a5a7a", padding: "4px 8px" }}>{f}</div>)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ background: "rgba(129,140,248,0.06)", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "#818cf8", fontWeight: 600, marginBottom: 6 }}>Master Task</div>
                  <div style={{ fontSize: 12, color: "#9090aa" }}>Build a customer dashboard with React + TypeScript. Include dark mode, responsive charts, and CSV export.</div>
                </div>
                <div style={{ borderLeft: "2px solid rgba(129,140,248,0.2)", paddingLeft: 16 }}>
                  <div style={{ fontSize: 10, color: "#50d080", fontWeight: 600, marginBottom: 8 }}>✓ Phase 1 complete — all 3 agents delivered</div>
                  <div style={{ fontSize: 11, color: "#5a5a7a", marginBottom: 4 }}>Claude → Dashboard.tsx, ChartCard.tsx, types.ts</div>
                  <div style={{ fontSize: 11, color: "#5a5a7a", marginBottom: 4 }}>GPT-4o → DarkTheme.css, responsive layout</div>
                  <div style={{ fontSize: 11, color: "#5a5a7a", marginBottom: 4 }}>Gemini → csvExport.ts, DataLoader.ts</div>
                  <div style={{ fontSize: 10, color: "#818cf8", marginTop: 12 }}>⏳ Phase 2 — agents refining with shared context…</div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: "80px 40px", maxWidth: 1060, margin: "0 auto" }}>
        <Reveal><div style={{ textAlign: "center", marginBottom: 60 }}><h2 style={{ fontSize: 36, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Built for how you actually work</h2><p style={{ fontSize: 15, color: "#9090aa", marginTop: 12, maxWidth: 500, margin: "12px auto 0" }}>Six tools that work together. Every AI call stays in your editor.</p></div></Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { icon: "🎯", title: "AI Builder", desc: "Assign multiple models to one task. They share context, refine each other's output, and auto-deploy the result." },
            { icon: "💡", title: "Master Planner", desc: "Chat with an AI architect before coding starts. It asks questions, proposes a plan, and recommends which model handles what." },
            { icon: "🔄", title: "Terminal Loop", desc: "Writes code, runs the build, reads errors, fixes them, retries. Up to 3 attempts, zero copy-paste." },
            { icon: "📚", title: "Context Library", desc: "Drop files in. The AI reads them before every task — your API specs, design docs, brand guides become permanent context." },
            { icon: "🎙️", title: "Meeting Recorder", desc: "Record any call. AI extracts tasks. One click to execute them against your codebase with the right models." },
            { icon: "👁️", title: "Live Preview", desc: "Your app runs in a built-in browser. Type a change in plain English — AI edits the code, page reloads instantly." },
          ].map((f, i) => <Reveal key={f.title} delay={i * 0.07}><div style={{ background: "#12121a", border: "1px solid #1e1e2e", borderRadius: 10, padding: "24px 22px", height: "100%" }}><div style={{ fontSize: 24, marginBottom: 12 }}>{f.icon}</div><div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{f.title}</div><div style={{ fontSize: 12, color: "#9090aa", lineHeight: 1.6 }}>{f.desc}</div></div></Reveal>)}
        </div>
      </section>

      {/* PRODUCT SHOWCASE */}
      <section style={{ padding: "80px 40px", maxWidth: 800, margin: "0 auto" }}>
        {[
          { tag: "Multi-model orchestration", title: "Agents turn ideas into code", desc: "Assign Claude for logic, GPT-4o for styling, Gemini for utilities. They work in parallel on Phase 1, then refine together in Phase 2 with full shared context. One click, five minds." },
          { tag: "Self-healing builds", title: "Errors fix themselves", desc: "The terminal loop catches build failures, reads the error output, feeds it back to the model, and tries again — installing missing dependencies and rewriting broken code along the way." },
          { tag: "Plan before you build", title: "Talk to the architect first", desc: "The Master Planner asks clarifying questions, recommends which models to use for each sub-task, and pre-fills the AI Builder with a structured plan. Review it, tweak it, then hit Run." },
        ].map((s, i) => <Reveal key={s.tag} delay={i * 0.05} style={{ marginBottom: 80 }}><div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>{s.tag}</div><h3 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 12px", letterSpacing: -0.3 }}>{s.title}</h3><p style={{ fontSize: 15, color: "#9090aa", lineHeight: 1.7, margin: 0 }}>{s.desc}</p></Reveal>)}
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: "80px 40px", maxWidth: 900, margin: "0 auto" }}>
        <Reveal><div style={{ textAlign: "center", marginBottom: 48 }}><h2 style={{ fontSize: 36, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Simple pricing</h2><p style={{ fontSize: 15, color: "#9090aa", marginTop: 10 }}>Start free. Upgrade when you're ready.</p></div></Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {/* Free Trial */}
          <Reveal><div style={{ background: "#12121a", border: "1px solid #1e1e2e", borderRadius: 12, padding: "28px 24px", display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Free Trial</div>
            <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 4 }}>$0</div>
            <div style={{ fontSize: 12, color: "#5a5a7a", marginBottom: 20 }}>14 days · no card required</div>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 auto", display: "flex", flexDirection: "column", gap: 8 }}>{["Full access to all 5 models", "AI Builder + Master Planner", "Terminal loop + auto-fix", "Context Library + Meetings"].map(f => <li key={f} style={{ fontSize: 12, color: "#9090aa", display: "flex", gap: 8 }}><span style={{ color: "#50d080", flexShrink: 0 }}>✓</span>{f}</li>)}</ul>
            <a href="/loginDeepControl?from=desktop" style={{ marginTop: 24, padding: "10px 0", borderRadius: 6, textAlign: "center", border: "1px solid #2a2a3e", color: "#9090aa", fontSize: 13, fontWeight: 600, textDecoration: "none", display: "block" }}>Start Free Trial</a>
          </div></Reveal>
          {/* CHAD */}
          <Reveal delay={0.07}><div style={{ background: "#12121a", border: "1px solid #818cf8", borderRadius: 12, padding: "28px 24px", display: "flex", flexDirection: "column", height: "100%", boxShadow: "0 0 0 1px #818cf8 inset, 0 0 40px rgba(129,140,248,0.06)", position: "relative", overflow: "hidden" }}>
            <img src="/chad.png" alt="" style={{ position: "absolute", top: -10, right: -10, width: 120, height: 120, objectFit: "cover", objectPosition: "center top", opacity: 0.07, borderRadius: "50%", pointerEvents: "none", filter: "grayscale(1) contrast(1.4)" }} />
            <div style={{ position: "absolute", top: 12, right: 16, fontSize: 9, fontWeight: 700, background: "#818cf8", color: "#0a0a0f", padding: "3px 8px", borderRadius: 99, textTransform: "uppercase", letterSpacing: 0.5 }}>Recommended</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Chad</div>
            <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 4 }}>$25<span style={{ fontSize: 14, fontWeight: 500, color: "#5a5a7a" }}>/mo</span></div>
            <div style={{ fontSize: 12, color: "#5a5a7a", marginBottom: 20 }}>Most users never pay more</div>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 auto", display: "flex", flexDirection: "column", gap: 8 }}>{["Everything in Free Trial", "Generous AI usage included", "Small overage rate on heavy days", "Set your own monthly cap", "Priority during peak hours"].map(f => <li key={f} style={{ fontSize: 12, color: "#9090aa", display: "flex", gap: 8 }}><span style={{ color: "#50d080", flexShrink: 0 }}>✓</span>{f}</li>)}</ul>
            <a href="/loginDeepControl?from=pricing" style={{ marginTop: 24, padding: "10px 0", borderRadius: 6, textAlign: "center", background: "#818cf8", color: "#0a0a0f", fontSize: 13, fontWeight: 600, textDecoration: "none", display: "block" }}>Subscribe to Chad</a>
          </div></Reveal>
          {/* PAYG */}
          <Reveal delay={0.14}><div style={{ background: "#12121a", border: "1px solid #1e1e2e", borderRadius: 12, padding: "28px 24px", display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Pay-as-you-go</div>
            <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 4 }}>$0<span style={{ fontSize: 14, fontWeight: 500, color: "#5a5a7a" }}>/mo</span></div>
            <div style={{ fontSize: 12, color: "#5a5a7a", marginBottom: 20 }}>Pay only when you use it</div>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 auto", display: "flex", flexDirection: "column", gap: 8 }}>{["Everything in Free Trial", "No monthly commitment", "Per-call billing", "Set a monthly hard limit", "Switch to Chad anytime"].map(f => <li key={f} style={{ fontSize: 12, color: "#9090aa", display: "flex", gap: 8 }}><span style={{ color: "#50d080", flexShrink: 0 }}>✓</span>{f}</li>)}</ul>
            <a href="/loginDeepControl?from=pricing" style={{ marginTop: 24, padding: "10px 0", borderRadius: 6, textAlign: "center", border: "1px solid #2a2a3e", color: "#9090aa", fontSize: 13, fontWeight: 600, textDecoration: "none", display: "block" }}>Get Started</a>
          </div></Reveal>
        </div>
      </section>

      {/* DOWNLOAD CTA */}
      <section id="download" style={{ textAlign: "center", padding: "100px 40px 60px" }}>
        <Reveal>
          <h2 style={{ fontSize: 36, fontWeight: 700, margin: "0 0 12px", letterSpacing: -0.5 }}>Ready to build?</h2>
          <p style={{ fontSize: 15, color: "#9090aa", marginBottom: 32 }}>14-day free trial. No credit card. Cancel anytime.</p>
          <a href={DMG} download style={{ padding: "14px 36px", borderRadius: 8, background: "#818cf8", color: "#0a0a0f", fontSize: 15, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 18 }}>↓</span> Download Tools AI for macOS</a>
          <p style={{ fontSize: 11, color: "#5a5a7a", marginTop: 16 }}>macOS 12+ · Apple Silicon & Intel · 248 MB</p>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #1e1e2e", padding: "48px 40px 32px", maxWidth: 1060, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 32, marginBottom: 40 }}>
          {[
            { h: "Product", links: ["Features", "Pricing", "Download", "Changelog"] },
            { h: "Resources", links: ["Documentation", "Blog", "Community", "Status"] },
            { h: "Company", links: ["About", "Careers", "Contact"] },
            { h: "Legal", links: [{ t: "Privacy Policy", href: "/privacy" }, { t: "Terms of Service", href: "/terms" }] },
          ].map(col => <div key={col.h}><div style={{ fontSize: 10, fontWeight: 700, color: "#5a5a7a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>{col.h}</div>{col.links.map(l => { const t = typeof l === "string" ? l : l.t; const href = typeof l === "string" ? `#${l.toLowerCase()}` : l.href; return <a key={t} href={href} style={{ display: "block", fontSize: 12, color: "#9090aa", textDecoration: "none", marginBottom: 8 }}>{t}</a>; })}</div>)}
        </div>
        <div style={{ textAlign: "center", fontSize: 11, color: "#3a3a5a" }}>© {new Date().getFullYear()} Tools AI. All rights reserved.</div>
      </footer>
    </div>
  );
}

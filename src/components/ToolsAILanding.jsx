import { useState, useEffect, useRef } from "react";

/* ═══ REAL ICONS FROM THE APP (base64 PNGs) ═══ */
const IC = {
  chatgpt: "data:image/png;base64,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",
  claude: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAYAAAByDd+UAAAABmJLR0QA/wD/AP+gvaeTAAAFO0lEQVRIiaWWeWxUVRTGf+dOKUyxLFoFDWggTFtAQCLBEJWEQFwSSqI4nQoorsQokRjCTIEQn0igHUsgbkTQSoIK0xFcICGAxhKNOxL+qHSmbMYFaoBSih1KZ+7xj5lpp8sUjN9f957z3fO97773zr1CFjQ48wfZWPw74HoRXVxYUbOzO+fEikeHtdvEgvwBsU23OLtbs9XKhMmWSMTanwPGAcNVpUIdpwe3PW6rUalqaXUvuxaxPgVRcyJjNiYSO1rSJe04BmFWkmou/2/BSxcGfQbUpeciLM3MR1si1wO5AGJtJDMXCfgejAR89RG/b8s1C07ZvLndWPtCR0C5N+L3Tu1YmBu/KT22Lvm1Q8xfNhP4BChCeCa6zHtHr4JRv+/hiL90b9TvezId87wWPigQ7mSbVR3jODemRi3F/cceSzmbhOguoH8qd8kdp4v7DkEV/Ig8oEJ1fcBX/ftLXjdAPO5aBsRSLmdHl5fdBWCNuTm5Uo6I49ijyx+6IeVsUOeuyPMjN4RjvQoiEuoYwpOtuebbaPm80ePWf/SbIus7ts/q6iSdkcma9hf1el3G5u4ARnXW482i4I5tdINkTur9ZXNE9D2gIBVqVnQRenmviLsBGJZUlenqso+IyouiPKVGPKguzyj1Q9xtp493wle6C3b5aIqDOz5XlUkK+1OhwYKEBHcVEOx8TC1HpSDpkEJUAxkOmhJxl683sR4O01CQaLnvaZQqYHCK2KDgSVHagHpgUo+CytzCYGhXb3WzCqZxbGXZSBvXLQr398XLqLanqCJU8pdTknexzT1ZEjIZkYmgE4CxCrtEQQQ0Ww0FaSgve1ZVq4D8q0h+BQwBJgA5PZ9HqiUS8NUDtwJNopxX4TzQhMgFxTaLmkbQP1Q0T1Q2AAOuyS20AIdBD4H8mHD1Ozhu7Qenc0T0FbU8jsgQFfKBEQITrGp/QfLS5kX73H2As4LWWuQbl+XrMafsEQmHEz1dXgOOB7yD40buxsqnQL8stATQCPwtSAJAsc1gzgp6TuGYab341lUFG/zzR1iTWIPqYyR/ozY6W1cmvhRhn8J0Ue5WGNqdoLA/a/Ouc7zXRctLVyckHkF1IWijoKtItrm2XpbMRCkorAjN8bjHFljsRJDFwA7gT6Bd0IZeHUb8pQsR1oHcDKjCViOuNaqJA8AoFdaKshLkHOgNqWVtQH+F90+7GxfNcGrj3Q2Md8KXugjWLfMOdxmzWSB92J4SNYs8we1fRAK+zwRKUNar0WOiskmFUpStAnmCfqzIEGAWwp78Aa2+3q4dnaeF45gcYw6nxKyKvn45kXt7YXD7gWjAF0jFf4rn2RVGpQjAtrt+RKUi+X5kriAbFd5Bmd0SG7jveMA7OKtgLbUG+B741Bh7T3FFzZJJVdv+iZaXzgLWAM0irrLxTviKplqaOz+30RVrDgJHAVHVTS53jl8EP+i0OKb2xIpHh2UK9vmV/rp03m2unMTPQIGivuLKmhp1HBONHW0CbFFlaChAw3LvNGvNN4BBebcoGHq23l86Q4QPQZqKKkPjezjsjpPOEwNycuxOoAD0reLKmhqASGudh+QheybN9awLfwdsTFl4uqHcd19xsOarfi7XZODjzBtfj36XRlus9VVB7hQIe07oks6MmZLamjOZfNN6cYUdOGgWykSrzAf2j167vRF4uQsvm6AgRmFnu9su6NKijE4FUKUxk+95Y2+bUTNPkEPAkWx1szosqgwt7S0uylgAka4OATyV2+uAKdlqQl8X4WxQ3gZOqsru/7wW+Bc3Thv/NSKR4QAAAABJRU5ErkJggg==",
  gemini: "data:image/png;base64,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",
  grok: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAYAAAByDd+UAAADBElEQVR4nL3WPYhdVRAH8N97u9FEozGEYIKLQY1uFCOIiiKibmEREBEERU0h2BiwsNHK0iYWlhICfiAhsOUKio0fIAbxA0VjEEVioaJG0Sghxt3sszgz756971520zhwOPecMzP/+Tgz5/L/0CDmXcNzFJrCdMxTrfWgR24aIzyEM2sBTKARzmIp5rOt9Sj4aloX58/E2fHpVcCGWA6FF2EOd+AqbMBJfI338H7w1WCLeAr3xGgbtILy8Lyw8Pvwom98hn3YGDKwN86ubens9Ex48uEqQPX4GLMhe3/svVmDdYU0w7gT72Im1kN8ggV8roRzM27H1XgRb4eOPZiP7wXlHnReqkEovhBHw8JlnMAjfeFo0RxOK/lcjvXYwzbl5v4AW8KPmhwMdZfF+XF+G/4IoKXQcXMfYOZtBqfCwkUlZDQXoU2ZlhvwuyafWSp39gGm4NOV0MHYW9cDlkquqcDm8XMF+GhL/5jSw3eUkCxit6bw+8Aux28BeF/sPVkZ/XwXYN6gC/BDMB6rjOgD265cqI+wozq7TpPDt1oyK7y7DH8H4+tdjNV6Wxj3UiWfod+MXzUNYQIoabraO22ydoZKbmbwhhKux0PxMLwSc353lkMq3qLkY6Qp4mGLZwdew92VkYMWb970ET5oya8AHeCLYPxFadjZDAZKGJ9QQp9gNSX4Hk3TeLWHd7xxQHPD9sZeFvisJk9doUodhysdj/UBpoK5yrpvcXHlZVJXX0yFN+LfkD+JrX0yubFJqaks3FcqhfXrnmNo5e08VsnubznTCbhRU4vf4Rb9naamWXyqCeXxMD7zP0FTcbgrBL5UukjSVjwc59msNyjd6DklfAl2Kgylv3mMvZgPsC2V5S/gp1C2qLz+R2PO8OU4oSmZ3hc+E/4AjuCSSuBWJS9refEXcOVqYHlwE15Wcshk7O/FIXyDv/AP/sRXyqtyV4fOXtqJZ5WXPsF0fFOisR1X4NIO3lV/PbfhQazvAUjKF/5czyboes2F6ft7rilrL0O+Fpkx/QcHAsqnAxpyJAAAAABJRU5ErkJggg==",
  perplexity: "data:image/png;base64,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",
  app: "data:image/png;base64,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",
};

/* ═══ HOOKS ═══ */
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

const Reveal = ({ children, delay = 0, y = 40, style = {} }) => {
  const [ref, v] = useInView();
  return <div ref={ref} style={{ opacity: v ? 1 : 0, transform: v ? "translateY(0)" : `translateY(${y}px)`, transition: `all 0.9s cubic-bezier(.22,1,.36,1) ${delay}s`, willChange: "transform, opacity", ...style }}>{children}</div>;
};

const RevealX = ({ children, delay = 0, x = 50, style = {} }) => {
  const [ref, v] = useInView();
  return <div ref={ref} style={{ opacity: v ? 1 : 0, transform: v ? "translateX(0)" : `translateX(${x}px)`, transition: `all 1s cubic-bezier(.22,1,.36,1) ${delay}s`, willChange: "transform, opacity", ...style }}>{children}</div>;
};

/* ═══ ICON COMPONENT ═══ */
const PIcon = ({ platform, size = 20, style = {} }) => (
  <img src={IC[platform]} alt={platform} style={{ width: size, height: size, borderRadius: size * 0.2, objectFit: "contain", ...style }} />
);

/* ═══ MAC WINDOW DOTS ═══ */
const Dots = () => (
  <div style={{ display: "flex", gap: 6 }}>
    {["#ff5f57","#febc2e","#28c840"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
  </div>
);

/* ═══ HYPER-DETAILED MAIN APP MOCKUP ═══ */
const AppMockup = () => (
  <div style={{ borderRadius: 12, overflow: "hidden", background: "#0e0e11", boxShadow: "0 40px 100px rgba(0,0,0,0.2), 0 15px 40px rgba(0,0,0,0.1)" }}>
    {/* Titlebar with real platform tabs */}
    <div style={{ display: "flex", alignItems: "center", padding: "9px 13px", background: "#18181c", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <Dots />
      <div style={{ flex: 1, display: "flex", justifyContent: "center", gap: 2 }}>
        {[
          { id: "chatgpt", active: true }, { id: "claude" }, { id: "gemini" }, { id: "grok" }, { id: "perplexity" },
        ].map(t => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 5, background: t.active ? "rgba(255,255,255,0.06)" : "transparent" }}>
            <PIcon platform={t.id} size={13} />
            <span style={{ fontSize: 10, color: t.active ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)", fontWeight: t.active ? 600 : 400, textTransform: "capitalize" }}>{t.id === "chatgpt" ? "ChatGPT" : t.id.charAt(0).toUpperCase() + t.id.slice(1)}</span>
          </div>
        ))}
        <div style={{ padding: "4px 8px", fontSize: 12, color: "rgba(255,255,255,0.2)" }}>+</div>
      </div>
    </div>
    {/* Body */}
    <div style={{ display: "flex", height: 340 }}>
      {/* Sidebar */}
      <div style={{ width: 174, background: "#111116", borderRight: "1px solid rgba(255,255,255,0.05)", padding: "10px 8px", flexShrink: 0 }}>
        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 8px", marginBottom: 6, borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)", fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          Search everything...
        </div>
        {/* Nav items */}
        {[
          { n: "AI Helper", c: "#6366f1", a: true },
          { n: "Notes", c: "#22c55e" },
          { n: "Library", c: "#3b82f6", badge: "847" },
          { n: "Projects", c: "#f59e0b" },
          { n: "Code", c: "#e879f9" },
          { n: "Files", c: "#ef4444" },
        ].map(i => (
          <div key={i.n} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 6, fontSize: 10.5, color: i.a ? "#e5e5e5" : "rgba(255,255,255,0.28)", background: i.a ? "rgba(99,102,241,0.1)" : "transparent", fontWeight: i.a ? 600 : 400, marginBottom: 1 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: i.c, opacity: i.a ? 1 : 0.4 }} />
            {i.n}
            {i.badge && <span style={{ marginLeft: "auto", fontSize: 8, color: "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)", padding: "1px 5px", borderRadius: 3 }}>{i.badge}</span>}
          </div>
        ))}
        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.12)", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, padding: "10px 8px 4px" }}>Platforms</div>
        {["chatgpt","claude","gemini","grok","perplexity"].map(p => (
          <div key={p} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 6, fontSize: 10, color: "rgba(255,255,255,0.2)", marginBottom: 1 }}>
            <PIcon platform={p} size={12} style={{ opacity: 0.5 }} />
            {p === "chatgpt" ? "ChatGPT" : p.charAt(0).toUpperCase() + p.slice(1)}
          </div>
        ))}
      </div>
      {/* Chat */}
      <div style={{ flex: 1, padding: "20px 24px", display: "flex", flexDirection: "column", justifyContent: "center", background: "#0a0a0e" }}>
        <div style={{ maxWidth: 400 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <div style={{ padding: "9px 14px", background: "#6366f1", color: "white", borderRadius: "12px 12px 3px 12px", fontSize: 11.5, lineHeight: 1.5, maxWidth: "80%" }}>
              What's the best way to structure a SaaS pricing page?
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <PIcon platform="chatgpt" size={20} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: "12px 12px 12px 3px", fontSize: 11.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.65, borderLeft: "2px solid rgba(16,163,127,0.25)" }}>
              Great question! Here are the key principles for a high-converting SaaS pricing page:<br/><br/>
              <b style={{ color: "rgba(255,255,255,0.65)" }}>1. Anchor with 3 tiers</b> — Free, Pro, Enterprise<br/>
              <b style={{ color: "rgba(255,255,255,0.65)" }}>2. Highlight the recommended plan</b> — visual emphasis<br/>
              <b style={{ color: "rgba(255,255,255,0.65)" }}>3. Annual vs monthly toggle</b> — show savings...
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

/* ═══ COMPARE MOCKUP ═══ */
const CompareMockup = () => (
  <div style={{ borderRadius: 12, overflow: "hidden", background: "#0e0e11", boxShadow: "0 40px 100px rgba(0,0,0,0.2)" }}>
    <div style={{ display: "flex", alignItems: "center", padding: "9px 13px", background: "#18181c", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <Dots />
      <div style={{ flex: 1, textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Compare Mode — All 5 AIs</div>
    </div>
    <div style={{ padding: 16 }}>
      <div style={{ padding: "8px 12px", background: "rgba(99,102,241,0.06)", borderRadius: 8, fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 12, textAlign: "center" }}>
        "Explain the difference between REST and GraphQL"
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5 }}>
        {[
          { id: "chatgpt", t: "REST uses fixed endpoints with HTTP methods. Each returns predefined data..." },
          { id: "claude", t: "The core distinction is in data fetching. REST follows resource-oriented architecture..." },
          { id: "gemini", t: "REST APIs expose multiple endpoints per resource. GraphQL uses a single endpoint..." },
          { id: "grok", t: "REST: multiple URLs, overfetching common. GraphQL: one URL, ask for exactly what you need..." },
          { id: "perplexity", t: "Per 2024 surveys, 65% of devs prefer REST for CRUD. GraphQL dominates complex queries..." },
        ].map(a => (
          <div key={a.id} style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: 8, border: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 5 }}>
              <PIcon platform={a.id} size={14} />
              <span style={{ fontSize: 8.5, fontWeight: 600, color: "rgba(255,255,255,0.45)", textTransform: "capitalize" }}>{a.id === "chatgpt" ? "ChatGPT" : a.id}</span>
            </div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", lineHeight: 1.55 }}>{a.t}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(99,102,241,0.05)", borderRadius: 8, borderLeft: "2px solid #6366f1" }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: "#818cf8", marginBottom: 2 }}>Synthesized Best Answer</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>REST uses multiple endpoints; GraphQL offers a single flexible endpoint. Claude and Gemini provided the clearest comparisons...</div>
      </div>
    </div>
  </div>
);

/* ═══ NOTES MOCKUP ═══ */
const NotesMockup = () => (
  <div style={{ borderRadius: 12, overflow: "hidden", background: "#0e0e11", boxShadow: "0 40px 100px rgba(0,0,0,0.2)" }}>
    <div style={{ display: "flex", alignItems: "center", padding: "9px 13px", background: "#18181c", borderBottom: "1px solid rgba(255,255,255,0.06)" }}><Dots /></div>
    <div style={{ display: "flex", height: 260 }}>
      <div style={{ width: 150, background: "#111116", borderRight: "1px solid rgba(255,255,255,0.05)", padding: "10px 8px" }}>
        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.12)", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, padding: "4px 8px 6px" }}>Notes</div>
        {["Product Strategy","Q1 Goals","API Architecture","Meeting Notes","Brand Voice"].map((n,i) => (
          <div key={n} style={{ padding: "5px 8px", borderRadius: 6, fontSize: 10, color: i === 0 ? "#e5e5e5" : "rgba(255,255,255,0.22)", background: i === 0 ? "rgba(99,102,241,0.08)" : "transparent", fontWeight: i === 0 ? 600 : 400, marginBottom: 1 }}>{n}</div>
        ))}
      </div>
      <div style={{ flex: 1, padding: "16px 20px", background: "#0a0a0e" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#e5e5e5", marginBottom: 10 }}>Product Strategy</div>
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", lineHeight: 1.8 }}>
          <b style={{ color: "rgba(255,255,255,0.6)" }}>Vision</b><br/>
          Build the definitive workspace for people who think with AI daily. Unify all platforms into one seamless experience.<br/><br/>
          <b style={{ color: "rgba(255,255,255,0.6)" }}>Core Pillars</b><br/>
          1. Privacy first — all data local<br/>
          2. Speed — instant AI switching<br/>
          3. Compare — side-by-side answers<br/>
          4. Organize — projects, notes, files
        </div>
      </div>
    </div>
  </div>
);

/* ═══ SEARCH MOCKUP ═══ */
const SearchMockup = () => (
  <div style={{ borderRadius: 12, overflow: "hidden", background: "white", boxShadow: "0 30px 80px rgba(0,0,0,0.1)", border: "1px solid #e8e8ec", maxWidth: 400 }}>
    <div style={{ padding: "12px 16px", borderBottom: "1px solid #eee" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#f6f6f8", borderRadius: 8, border: "1px solid #e8e8ec" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <span style={{ fontSize: 12, color: "#222" }}>How did we decide on pricing?</span>
      </div>
    </div>
    <div style={{ padding: "10px 16px" }}>
      <div style={{ fontSize: 10, color: "#aaa", marginBottom: 5, fontWeight: 500 }}>AI Answer</div>
      <div style={{ fontSize: 11, color: "#555", lineHeight: 1.65, marginBottom: 12 }}>
        Based on your conversations, the $10/month price was chosen after analyzing 12 competitor pricing models and API cost calculations from Feb 15...
      </div>
      <div style={{ fontSize: 10, color: "#aaa", marginBottom: 6, fontWeight: 500 }}>Best matches</div>
      {[
        { t: "Pricing Strategy Session", s: "Claude · 2 weeks ago", icon: "claude" },
        { t: "API Cost Analysis", s: "ChatGPT · 3 weeks ago", icon: "chatgpt" },
        { t: "Competitor Research", s: "Perplexity · 1 month ago", icon: "perplexity" },
      ].map(r => (
        <div key={r.t} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #f0f0f2" }}>
          <PIcon platform={r.icon} size={18} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#222" }}>{r.t}</div>
            <div style={{ fontSize: 10, color: "#aaa" }}>{r.s}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ═══ FEATURE ROW (Nessie alternating layout) ═══ */
const Feature = ({ title, desc, mockup, reverse }) => (
  <div style={{ maxWidth: 1060, margin: "0 auto", padding: "100px 40px", display: "flex", alignItems: "center", gap: 80, flexDirection: reverse ? "row-reverse" : "row" }}>
    <RevealX x={reverse ? 50 : -50} delay={0.1} style={{ flex: "0 0 calc(45% - 40px)" }}>
      <h2 style={{ fontFamily: "'Outfit',sans-serif", fontSize: 38, fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.2, color: "#111", marginBottom: 18 }}>{title}</h2>
      <p style={{ fontSize: 17, color: "#6b7280", lineHeight: 1.75, maxWidth: 420 }}>{desc}</p>
    </RevealX>
    <RevealX x={reverse ? -50 : 50} delay={0.3} style={{ flex: "0 0 calc(55% - 40px)" }}>
      {mockup}
    </RevealX>
  </div>
);

/* ═══ ANIMATED DOTTED GRID (canvas, matches app workflow grid) ═══ */
const DottedGrid = () => {
  const canvasRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;
    const gap = 20; // same as app: 20px grid
    const dotR = 1; // same as app: 1px radius
    const speed = 0.15; // pixels per frame

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      offsetRef.current.x = (offsetRef.current.x + speed) % gap;
      offsetRef.current.y = (offsetRef.current.y + speed) % gap;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#bfc4ca"; // darker than app's #dadce0 so visible on #fafaf9

      const startX = -gap + offsetRef.current.x;
      const startY = -gap + offsetRef.current.y;

      for (let x = startX; x < canvas.width + gap; x += gap) {
        for (let y = startY; y < canvas.height + gap; y += gap) {
          ctx.beginPath();
          ctx.arc(x, y, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }} />;
};

/* ═══ MAIN APP ═══ */
export default function App() {
  const [sc, setSc] = useState(false);
  useEffect(() => {
    const h = () => setSc(window.scrollY > 50);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <div style={{ background: "#fafaf9", color: "#111", fontFamily: "'Plus Jakarta Sans',sans-serif", minHeight: "100vh", overflowX: "hidden", WebkitFontSmoothing: "antialiased", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        html { scroll-behavior: smooth; }
        ::selection { background: rgba(99,102,241,0.15); }
        @keyframes tDot { 0%,100%{opacity:0.2;transform:translateY(0)}50%{opacity:0.7;transform:translateY(-3px)} }
      `}</style>

      {/* ═══ MOVING DOTTED GRID BACKGROUND (same pattern as app workflow canvas) ═══ */}
      <DottedGrid />

      {/* ═══ NAV (Nessie style) ═══ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "16px 40px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: sc ? "rgba(250,250,249,0.92)" : "transparent",
        backdropFilter: sc ? "blur(16px)" : "none", WebkitBackdropFilter: sc ? "blur(16px)" : "none",
        borderBottom: sc ? "1px solid #e8e8e4" : "1px solid transparent",
        transition: "all 0.3s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={IC.app} alt="Tools AI" style={{ width: 32, height: 32, borderRadius: 8 }} />
          <span style={{ fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: -0.5 }}>Tools AI</span>
        </div>
        <a href="https://github.com/DylanWain/Tools-AI-APP/releases/download/v1.0.8/Tools AI-1.0.0-arm64.dmg" download style={{
          display: "flex", alignItems: "center", gap: 7, padding: "9px 22px",
          background: "#111", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "white", textDecoration: "none",
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download
        </a>
      </nav>

      {/* ═══ HERO (Nessie style — centered, minimal) ═══ */}
      <section style={{ textAlign: "center", paddingTop: 160, paddingBottom: 60, position: "relative", zIndex: 1 }}>
        <Reveal delay={0.15}>
          <h1 style={{ fontFamily: "'Outfit',sans-serif", fontSize: "clamp(44px, 6.5vw, 72px)", fontWeight: 700, letterSpacing: -2.5, lineHeight: 1.1, color: "#111", maxWidth: 800, margin: "0 auto 22px", padding: "0 20px" }}>
            Every AI Platform,<br /><span style={{ color: "#6366f1" }}>One App</span>
          </h1>
        </Reveal>
        <Reveal delay={0.3}>
          <p style={{ fontSize: 19, color: "#6b7280", maxWidth: 500, margin: "0 auto 36px", lineHeight: 1.65, padding: "0 20px" }}>
            Tools AI unifies ChatGPT, Claude, Gemini, Grok, and Perplexity into a single desktop app that evolves with how you work
          </p>
        </Reveal>
        <Reveal delay={0.45}>
          <a href="https://github.com/DylanWain/Tools-AI-APP/releases/download/v1.0.8/Tools AI-1.0.0-arm64.dmg" download style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 32px",
            background: "#111", borderRadius: 12, fontSize: 15, fontWeight: 600, color: "white", textDecoration: "none",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download for Mac
          </a>
        </Reveal>
        <Reveal delay={0.55}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "center", marginTop: 28 }}>
            {["chatgpt","claude","gemini","grok","perplexity"].map(p => (
              <PIcon key={p} platform={p} size={28} style={{ opacity: 0.7 }} />
            ))}
          </div>
        </Reveal>
        <Reveal delay={0.6}>
          <p style={{ fontSize: 13, color: "#aaa", marginTop: 14 }}>Free. No account needed.</p>
        </Reveal>
      </section>

      {/* ═══ TRANSFORMATION (Nessie: scattered chats → unified app) ═══ */}
      <section style={{ padding: "40px 40px 80px", maxWidth: 1060, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <Reveal delay={0.2}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 20, justifyContent: "center" }}>
            <div style={{ flex: "0 0 38%" }}>
              <div style={{ textAlign: "center", marginBottom: 14, fontSize: 14, color: "#6366f1", fontWeight: 500 }}>Your scattered AI tabs</div>
              {[
                { id: "chatgpt", t: "What's the best way to structure a pricing page..." },
                { id: "claude", t: "Can you review this product spec for gaps..." },
                { id: "gemini", t: "Compare React vs Vue for dashboards..." },
              ].map(c => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "white", borderRadius: 12, border: "1px solid #e8e8ec", boxShadow: "0 2px 8px rgba(0,0,0,0.03)", marginBottom: 8 }}>
                  <PIcon platform={c.id} size={28} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#222", textTransform: "capitalize" }}>{c.id === "chatgpt" ? "ChatGPT" : c.id}</div>
                    <div style={{ fontSize: 10.5, color: "#999", marginTop: 1 }}>{c.t}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", paddingTop: 60 }}>
              <svg width="36" height="20" viewBox="0 0 36 20" fill="none"><path d="M2 10h28M24 4l6 6-6 6" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ flex: "0 0 52%" }}>
              <div style={{ textAlign: "center", marginBottom: 14, fontSize: 14, color: "#6366f1", fontWeight: 500 }}>One unified workspace</div>
              <AppMockup />
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══ FEATURES (Nessie alternating pattern) ═══ */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <Feature
          title="Compare answers instantly"
          desc="Send one prompt to all five AIs simultaneously. See their responses side-by-side with a synthesized best-of summary. Find out which AI thinks best about your specific problem."
          mockup={<CompareMockup />}
        />

        <div style={{ background: "rgba(255,255,255,0.5)" }}>
          <Feature reverse
            title="Your ideas, organized"
            desc="A built-in Apple Notes-style editor with bold titles, formatting, and auto-save. Organize everything into projects. Sync notes to your phone with a QR code."
            mockup={<NotesMockup />}
          />
        </div>

        <Feature
          title="Never lose a conversation"
          desc="Search across your entire library — every conversation, note, and code block. Find exactly what you need in seconds, no matter which AI you used."
          mockup={<SearchMockup />}
        />
      </div>

      {/* ═══ PRIVACY (Nessie style — centered, simple) ═══ */}
      <section style={{ textAlign: "center", padding: "120px 40px", position: "relative", zIndex: 1 }}>
        <Reveal>
          <h2 style={{ fontFamily: "'Outfit',sans-serif", fontSize: 40, fontWeight: 700, letterSpacing: -1.5, color: "#111", marginBottom: 18 }}>Private, local, yours</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p style={{ fontSize: 17, color: "#6b7280", maxWidth: 500, margin: "0 auto", lineHeight: 1.7 }}>
            Your conversations are yours — and we do not store the content of your chats, notes, or files on our servers. No one at Tools AI can access your private content.
          </p>
        </Reveal>
      </section>

      {/* ═══ CTA (Nessie style — icon + download) ═══ */}
      <section id="download" style={{ textAlign: "center", padding: "60px 40px 120px", position: "relative", zIndex: 1 }}>
        <Reveal>
          <img src={IC.app} alt="Tools AI" style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 24, boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }} />
        </Reveal>
        <Reveal delay={0.15}>
          <a href="https://github.com/DylanWain/Tools-AI-APP/releases/download/v1.0.8/Tools AI-1.0.0-arm64.dmg" download style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 32px",
            background: "#111", borderRadius: 12, fontSize: 15, fontWeight: 600, color: "white", textDecoration: "none",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download for Mac
          </a>
        </Reveal>
      </section>

      {/* ═══ FOOTER (Nessie style — minimal) ═══ */}
      <footer style={{ textAlign: "center", padding: "32px 40px 48px", borderTop: "1px solid #e8e8e4", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 12, color: "#bbb" }}>
          <a href="https://github.com/DylanWain/Tools-AI-APP/releases/download/v1.0.8/Tools AI-1.0.0-arm64.dmg" download style={{ color: "#999", textDecoration: "none" }}>Privacy Policy</a>{" · "}<a href="#" style={{ color: "#999", textDecoration: "none" }}>Terms of Service</a>
        </div>
        <div style={{ fontSize: 11, color: "#ccc", marginTop: 6 }}>© Tools AI 2026</div>
      </footer>
    </div>
  );
}

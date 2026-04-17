/* ═══════════════════════════════════════════════════════════════════════════
 * Starfield — fixed-position 3D starfield with scroll parallax & mouse drift
 *
 * Three layers of stars at different depths, each moving at a different
 * rate of scroll (25%, 35%, 50%). Some near-layer stars twinkle.
 *
 * Canvas-based (2D) instead of WebGL because a static-looking starfield
 * doesn't need a full 3D scene and canvas has much lower overhead across
 * browsers. The user can swap to @react-three/fiber later if desired.
 * ═══════════════════════════════════════════════════════════════════════ */
import { useEffect, useRef } from "react";

type Star = {
  x: number;          // normalized 0..1 across full page height
  y: number;          // normalized 0..1 across full page height
  r: number;          // radius in px
  a: number;          // base alpha
  twinkle: boolean;   // does this star twinkle
  phase: number;      // phase offset for twinkle
  layer: 0 | 1 | 2;   // 0 = far, 1 = mid, 2 = near
};

function makeStars(count: number, layer: 0 | 1 | 2): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const r = layer === 0 ? 0.4 + Math.random() * 0.6
            : layer === 1 ? 0.6 + Math.random() * 0.9
            : 0.9 + Math.random() * 1.3;
    const a = layer === 0 ? 0.25 + Math.random() * 0.35
            : layer === 1 ? 0.4 + Math.random() * 0.4
            : 0.6 + Math.random() * 0.4;
    stars.push({
      x: Math.random(),
      y: Math.random(),
      r,
      a,
      twinkle: layer === 2 && Math.random() < 0.2,  // ~20% of near-layer stars twinkle
      phase: Math.random() * Math.PI * 2,
      layer,
    });
  }
  return stars;
}

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const scrollRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | undefined>(undefined);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Respect reduced motion preference
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Generate stars: far (1000), mid (500), near (150)
    starsRef.current = [
      ...makeStars(1000, 0),
      ...makeStars(500, 1),
      ...makeStars(150, 2),
    ];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;
      sizeRef.current = { w, h, dpr };
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.scale(dpr, dpr);
    };
    resize();

    const onScroll = () => { scrollRef.current = window.scrollY; };
    const onResize = () => {
      resize();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(sizeRef.current.dpr, sizeRef.current.dpr);
    };
    const onMouse = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;   // -1..1
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouse, { passive: true });

    const LAYER_SCROLL_RATE = [0.25, 0.35, 0.5] as const; // far/mid/near
    const LAYER_MOUSE_SHIFT = [2, 4, 7] as const;          // px max drift per layer
    const PAGE_VIRTUAL_HEIGHT = 5000; // how much we spread stars vertically

    const start = performance.now();

    const draw = (now: number) => {
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);

      const t = (now - start) / 1000; // seconds
      const scroll = scrollRef.current;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (const s of starsRef.current) {
        const scrollRate = LAYER_SCROLL_RATE[s.layer];
        const mouseShift = LAYER_MOUSE_SHIFT[s.layer];

        // Vertical position: spread over a virtual tall canvas, offset by scroll*rate
        const rawY = s.y * PAGE_VIRTUAL_HEIGHT - scroll * scrollRate;
        // Wrap so stars cycle
        const y = ((rawY % h) + h) % h + my * mouseShift;
        const x = s.x * w + mx * mouseShift;

        let alpha = s.a;
        if (s.twinkle && !prefersReduced) {
          // Sine wave twinkle, 3s period
          alpha = s.a * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2 + s.phase)));
        }

        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();

        // Subtle glow on near-layer stars
        if (s.layer === 2 && s.r > 1.5) {
          ctx.globalAlpha = alpha * 0.3;
          ctx.beginPath();
          ctx.arc(x, y, s.r * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
      aria-hidden="true"
    />
  );
}

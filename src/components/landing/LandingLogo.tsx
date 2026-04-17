/* ═══════════════════════════════════════════════════════════════════════════
 * LandingLogo — 3D Tools AI globe with Saturn rings.
 *
 * Matches the flat icon's look: clean off-white sphere with bold dark
 * latitude/longitude grid, a fixed top-left specular highlight that stays
 * in place as the sphere rotates (like light on a real globe), and subtle
 * Saturn rings tilted at the iconic angle.
 *
 * Spins on the Y axis (like Earth). Honors prefers-reduced-motion.
 * ═══════════════════════════════════════════════════════════════════════ */
import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ── Globe surface texture ──────────────────────────────────────────
 * Clean, flat: off-white base + bold black-ish grid lines. No random
 * surface variation — we want it to read as the app icon, not Earth.
 * ─────────────────────────────────────────────────────────────────── */
function useGlobeTexture() {
  return useMemo(() => {
    const W = 2048;
    const H = 1024; // equirectangular 2:1
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Solid off-white base (matches #e8e8e8 from the icon)
    ctx.fillStyle = "#e8e8e8";
    ctx.fillRect(0, 0, W, H);

    // Bold grid lines that match the icon's feel
    ctx.strokeStyle = "#080810";
    ctx.lineCap = "butt";

    // Longitude lines — 12 evenly spaced vertical lines (every 30°)
    ctx.lineWidth = 14;
    for (let i = 0; i < 12; i++) {
      const x = (i / 12) * W;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // Latitude lines — equator bold, tropics medium
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();

    ctx.lineWidth = 12;
    [0.25, 0.75].forEach((frac) => {
      ctx.beginPath();
      ctx.moveTo(0, frac * H);
      ctx.lineTo(W, frac * H);
      ctx.stroke();
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 8;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

function Globe({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const texture = useGlobeTexture();

  useFrame((_s, delta) => {
    if (!ref.current || reducedMotion) return;
    // Counter-clockwise (viewed from north pole): negate rotation. 40s/rev.
    ref.current.rotation.y -= (delta * Math.PI * 2) / 40;
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 96, 96]} />
      {/* meshPhongMaterial gives us real shading (light side vs dark side)
         without the rough planet-y look of Standard PBR */}
      <meshPhongMaterial
        map={texture ?? undefined}
        color="#ffffff"
        shininess={12}
        specular="#ffffff"
      />
    </mesh>
  );
}

/* ── Static specular highlight — a glossy patch that stays in the
 * top-left regardless of sphere rotation. Sits just in front of the
 * sphere at a fixed position. ─────────────────────────────────────── */
function Highlight() {
  return (
    <mesh position={[-0.48, 0.48, 0.93]} scale={[0.32, 0.22, 1]}>
      <circleGeometry args={[0.5, 32]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.22} />
    </mesh>
  );
}

/* ── White ring highlight that outlines the whole sphere (matches the
 * static outer highlight in the flat icon). It's drawn in world space
 * and does not rotate. ─────────────────────────────────────────────── */
function HaloRing() {
  return (
    <mesh rotation={[0, 0, 0]}>
      <ringGeometry args={[1.005, 1.04, 128]} />
      <meshBasicMaterial
        color="#ffffff"
        side={THREE.DoubleSide}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

/* ── Saturn-style rings tilted at ~18° ─────────────────────────────── */
function Rings() {
  return (
    <group rotation={[Math.PI / 2.3, 0, -0.32]}>
      {/* Outer ring */}
      <mesh>
        <ringGeometry args={[1.55, 1.78, 128]} />
        <meshBasicMaterial
          color="#ffffff"
          side={THREE.DoubleSide}
          transparent
          opacity={0.55}
        />
      </mesh>
      {/* Inner ring (Cassini gap) */}
      <mesh>
        <ringGeometry args={[1.32, 1.44, 128]} />
        <meshBasicMaterial
          color="#ffffff"
          side={THREE.DoubleSide}
          transparent
          opacity={0.35}
        />
      </mesh>
    </group>
  );
}

export default function LandingLogo({ size = 88 }: { size?: number }) {
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      style={{ width: size, height: size, display: "inline-block" }}
      aria-label="Tools AI"
      role="img"
    >
      <Canvas
        camera={{ position: [0, 0, 3.6], fov: 38 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        {/* Lighting — strong key from upper-left creates light/dark hemispheres
           that read like the flat icon's shading quadrants */}
        <ambientLight intensity={0.35} />
        <directionalLight position={[-4, 3, 4]} intensity={1.4} />
        <directionalLight position={[3, -2, 2]} intensity={0.15} color="#8080a0" />

        <Globe reducedMotion={reducedMotion} />
        <Highlight />
        <HaloRing />
        <Rings />
      </Canvas>
    </div>
  );
}

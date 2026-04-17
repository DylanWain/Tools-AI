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

    // Bold grid lines matching the icon's minimalism — only a FEW lines,
    // not a full planet grid. Icon has 3 latitudes + 2 longitude ellipses
    // + 1 prime meridian, so ~4 vertical lines visible from any angle.
    ctx.strokeStyle = "#080810";
    ctx.lineCap = "butt";

    // Longitude lines — just 4 evenly spaced (every 90°). From any viewing
    // angle, 2 will be visible on the hemisphere facing the camera.
    ctx.lineWidth = 22;
    for (let i = 0; i < 4; i++) {
      const x = (i / 4) * W;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // Latitude lines — 3 total, matching the icon exactly: equator +
    // upper tropic + lower tropic
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();

    ctx.lineWidth = 18;
    [0.3, 0.7].forEach((frac) => {
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
    // Counter-clockwise rotation around local Y. 40s/rev.
    ref.current.rotation.y -= (delta * Math.PI * 2) / 40;
  });

  return (
    // Tilt the globe's axis slightly so we're viewing from the equator
    // with a small upward tilt (like looking at Saturn from slightly below).
    // X tilt of -0.18 rad (~-10°) angles the north pole toward the viewer.
    <mesh ref={ref} rotation={[-0.18, 0, 0]}>
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
  // Positioned upper-left of the sphere in camera space. Slightly in front
  // of the sphere (z=0.94 > 1.0 accounting for camera perspective) so it's
  // not clipped by the sphere surface.
  return (
    <mesh position={[-0.45, 0.52, 0.92]} scale={[0.3, 0.2, 1]}>
      <circleGeometry args={[0.5, 32]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.26} />
    </mesh>
  );
}

/* ── Bright white halo outlining the sphere (matches the flat icon's
 * distinctive outer ring highlight). Sprite-style: always faces camera. ── */
function HaloRing() {
  return (
    <mesh>
      <ringGeometry args={[1.01, 1.055, 128]} />
      <meshBasicMaterial
        color="#ffffff"
        side={THREE.DoubleSide}
        transparent
        opacity={0.95}
      />
    </mesh>
  );
}

/* ── Saturn-style rings. Tilted significantly so the ring plane is
 * clearly visible as an ellipse (not a thin line). ─────────────────── */
function Rings() {
  return (
    // Tilt about X so rings appear as a visible elliptical disc from the
    // camera. PI/2.8 ≈ 64° tilt away from the camera plane, showing the
    // top surface of the rings prominently.
    <group rotation={[Math.PI / 2.8, 0, -0.25]}>
      {/* Outer ring — wider and more opaque so it reads clearly */}
      <mesh>
        <ringGeometry args={[1.55, 1.95, 128]} />
        <meshBasicMaterial
          color="#ffffff"
          side={THREE.DoubleSide}
          transparent
          opacity={0.7}
        />
      </mesh>
      {/* Cassini gap — thin dark separator */}
      <mesh>
        <ringGeometry args={[1.73, 1.76, 128]} />
        <meshBasicMaterial
          color="#000000"
          side={THREE.DoubleSide}
          transparent
          opacity={0.6}
        />
      </mesh>
      {/* Inner ring */}
      <mesh>
        <ringGeometry args={[1.28, 1.48, 128]} />
        <meshBasicMaterial
          color="#ffffff"
          side={THREE.DoubleSide}
          transparent
          opacity={0.55}
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
        // Camera slightly above the equator, looking down-ish at origin.
        // Gives us an equatorial view with just enough tilt to see the
        // top surface of Saturn's rings fanning out to either side.
        camera={{ position: [0, 0.55, 4.1], fov: 36 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
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

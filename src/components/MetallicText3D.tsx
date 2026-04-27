"use client";

/**
 * Shared 3D metallic text + cursor dust primitives.
 *
 * Originally lived inside Instructions.tsx; lifted out so EliminationReveal
 * can also render the dramatic shimmery 3D number, and so the cursor dust
 * can be mounted once at the app root and trail across every screen.
 */

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/* ────────────────────────────────────────────────────────────────────────────
 *  Brass paint + shine — same gradients used by the rest of the brass UI so
 *  ZText3D reads as part of the same visual system.
 * ──────────────────────────────────────────────────────────────────────── */

export const BRASS_TEXT_STRONG =
  "linear-gradient(180deg, #fff5d2 0%, #f9e89a 12%, #e6c45a 38%, #a6801f 70%, #543708 100%)";

const SHINE_GRADIENT =
  "linear-gradient(115deg, transparent 0%, transparent 36%, rgba(255,250,220,0.95) 48%, rgba(255,255,255,0.85) 50%, rgba(255,250,220,0.95) 52%, transparent 64%, transparent 100%)";

/* ────────────────────────────────────────────────────────────────────────── */

const Z_DEPTH_LAYERS = 18;
const Z_LAYER_STEP = 2.2;

function rampBrassSide(t: number) {
  // Back is dark bronze, front blends into the bright gradient face.
  const l = 10 + (44 - 10) * t;
  return `hsl(40, 70%, ${l}%)`;
}

/**
 * ZText3D
 * ─────────────────────────────────────────────────────────────────
 * ztext.js-style 3D text. Stacks N depth layers via translateZ inside a
 * preserve-3d parent, with X+Y rotation that reveals both the bottom face
 * and a side face so the user reads the volume immediately.
 *
 * The closest layer carries the brass-gradient front face; deeper layers
 * ramp from dark bronze → mid brass to form the visible "side walls".
 * A moving specular highlight (the shine sweep) sits just in front of
 * the front face on the same `.overlay-shine-sweep` keyframe used
 * elsewhere on the site, so cadence is consistent.
 */
export function ZText3D({
  children,
  className = "",
  style = {},
  gradient = BRASS_TEXT_STRONG,
  rotateXDeg = 8,
  rotateYDeg = -6,
}: {
  children: string;
  className?: string;
  style?: React.CSSProperties;
  gradient?: string;
  /** Rotation around the X axis (top tilts away from camera). */
  rotateXDeg?: number;
  /** Rotation around the Y axis (lateral tilt — adds parallax). */
  rotateYDeg?: number;
}) {
  return (
    <span
      className="relative inline-block"
      style={{
        perspective: "650px",
        perspectiveOrigin: "50% 80%",
        ...style,
      }}
    >
      <span
        className="relative inline-block"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(-${rotateXDeg}deg) rotateY(${rotateYDeg}deg)`,
          transformOrigin: "50% 100%",
        }}
      >
        {Array.from({ length: Z_DEPTH_LAYERS }).map((_, i) => {
          const isFront = i === Z_DEPTH_LAYERS - 1;
          const z = (i - Z_DEPTH_LAYERS + 1) * Z_LAYER_STEP;
          const t = i / (Z_DEPTH_LAYERS - 1);

          const layerStyle: React.CSSProperties = {
            transform: `translateZ(${z}px)`,
            whiteSpace: "nowrap",
          };

          if (isFront) {
            layerStyle.background = gradient;
            layerStyle.WebkitBackgroundClip = "text";
            layerStyle.backgroundClip = "text";
            layerStyle.WebkitTextFillColor = "transparent";
            layerStyle.color = "transparent";
            layerStyle.filter =
              "drop-shadow(0 0 28px rgba(228,196,90,0.35)) drop-shadow(0 18px 28px rgba(0,0,0,0.55))";
          } else {
            layerStyle.position = "absolute";
            layerStyle.inset = "0";
            layerStyle.color = rampBrassSide(t);
            if (t < 0.3) layerStyle.filter = "blur(0.4px)";
          }

          return (
            <span
              key={i}
              aria-hidden={!isFront}
              className={className}
              style={layerStyle}
            >
              {children}
            </span>
          );
        })}

        {/* Moving specular highlight on the front face. */}
        <span
          aria-hidden
          className={`${className} overlay-shine-sweep pointer-events-none`}
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateZ(${0.4 * Z_LAYER_STEP}px)`,
            whiteSpace: "nowrap",
            background: SHINE_GRADIENT,
            backgroundSize: "250% 100%",
            backgroundRepeat: "no-repeat",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            mixBlendMode: "screen",
          }}
        >
          {children}
        </span>
      </span>
    </span>
  );
}

/**
 * ZText3DDanger
 * ─────────────────────────────────────────────────────────────────
 * Variant with the danger-red palette for elimination contexts. Same
 * 3D extrusion + shine as `ZText3D`, but the front face uses a red
 * gradient and the side walls ramp from deep maroon → mid danger red.
 */
const DANGER_TEXT_GRADIENT =
  "linear-gradient(180deg, #ffd6cf 0%, #ff8d80 18%, #f04050 42%, #b21e2c 72%, #4a0a10 96%)";

function rampDangerSide(t: number) {
  const l = 8 + (40 - 8) * t;
  return `hsl(354, 78%, ${l}%)`;
}

export function ZText3DDanger({
  children,
  className = "",
  style = {},
  rotateXDeg = 8,
  rotateYDeg = -6,
}: {
  children: string;
  className?: string;
  style?: React.CSSProperties;
  rotateXDeg?: number;
  rotateYDeg?: number;
}) {
  return (
    <span
      className="relative inline-block"
      style={{
        perspective: "650px",
        perspectiveOrigin: "50% 80%",
        ...style,
      }}
    >
      <span
        className="relative inline-block"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(-${rotateXDeg}deg) rotateY(${rotateYDeg}deg)`,
          transformOrigin: "50% 100%",
        }}
      >
        {Array.from({ length: Z_DEPTH_LAYERS }).map((_, i) => {
          const isFront = i === Z_DEPTH_LAYERS - 1;
          const z = (i - Z_DEPTH_LAYERS + 1) * Z_LAYER_STEP;
          const t = i / (Z_DEPTH_LAYERS - 1);

          const layerStyle: React.CSSProperties = {
            transform: `translateZ(${z}px)`,
            whiteSpace: "nowrap",
          };

          if (isFront) {
            layerStyle.background = DANGER_TEXT_GRADIENT;
            layerStyle.WebkitBackgroundClip = "text";
            layerStyle.backgroundClip = "text";
            layerStyle.WebkitTextFillColor = "transparent";
            layerStyle.color = "transparent";
            layerStyle.filter =
              "drop-shadow(0 0 36px rgba(232,72,85,0.55)) drop-shadow(0 18px 28px rgba(0,0,0,0.6))";
          } else {
            layerStyle.position = "absolute";
            layerStyle.inset = "0";
            layerStyle.color = rampDangerSide(t);
            if (t < 0.3) layerStyle.filter = "blur(0.4px)";
          }

          return (
            <span
              key={i}
              aria-hidden={!isFront}
              className={className}
              style={layerStyle}
            >
              {children}
            </span>
          );
        })}

        {/* Moving specular highlight — same animation as ZText3D. */}
        <span
          aria-hidden
          className={`${className} overlay-shine-sweep pointer-events-none`}
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateZ(${0.4 * Z_LAYER_STEP}px)`,
            whiteSpace: "nowrap",
            background: SHINE_GRADIENT,
            backgroundSize: "250% 100%",
            backgroundRepeat: "no-repeat",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            mixBlendMode: "screen",
          }}
        >
          {children}
        </span>
      </span>
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

/**
 * CursorGoldDust
 * ─────────────────────────────────────────────────────────────────
 * Emits short-lived gold dust sparkles at the cursor position as the
 * pointer moves. Each particle drifts upward + sideways + fades over
 * 650–1050 ms.
 *
 * Throttled to one emission per ~35 ms so even a frantic mouse can't
 * spawn hundreds of nodes. Particles auto-remove from React state
 * after their animation completes.
 *
 * Mounted once at the root layout level so the trail follows the
 * cursor across every page in the app, not just Instructions.
 */
export function CursorGoldDust() {
  const [particles, setParticles] = useState<
    Array<{
      id: number;
      x: number;
      y: number;
      drift: number;
      size: number;
      duration: number;
    }>
  >([]);
  const lastEmitRef = useRef(0);
  const idRef = useRef(0);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastEmitRef.current < 35) return;
      lastEmitRef.current = now;

      const id = idRef.current++;
      const drift = (Math.random() - 0.5) * 36;
      const size = 3 + Math.random() * 4;
      const duration = 650 + Math.random() * 400;

      setParticles((prev) => [
        ...prev,
        { id, x: e.clientX, y: e.clientY, drift, size, duration },
      ]);

      window.setTimeout(() => {
        setParticles((prev) => prev.filter((p) => p.id !== id));
      }, duration + 80);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[9000]" aria-hidden>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: p.x - p.size / 2,
            top: p.y - p.size / 2,
            width: p.size,
            height: p.size,
            background:
              "radial-gradient(circle, rgba(255,250,210,1) 0%, rgba(245,215,110,0.95) 35%, rgba(180,130,40,0) 100%)",
            mixBlendMode: "screen",
            boxShadow: `0 0 ${p.size * 3}px ${p.size * 0.5}px rgba(245,215,110,0.55)`,
          }}
          initial={{ opacity: 0.95, scale: 1, x: 0, y: 0 }}
          animate={{
            opacity: 0,
            scale: 0.3,
            x: p.drift,
            y: -22 - Math.random() * 18,
          }}
          transition={{ duration: p.duration / 1000, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

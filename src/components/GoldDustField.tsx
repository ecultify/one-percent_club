"use client";

/**
 * GoldDustField
 * ─────────────────────────────────────────────────────────────────
 * Ambient gold particle field that drifts gently across the entire
 * viewport. Mounted at the app root via layout.tsx so every screen
 * gets the "alive" feel without each component having to opt in.
 *
 * Cheap canvas implementation:
 *   - 60 particles max (configurable).
 *   - Each particle drifts upward + slight sideways with a tiny
 *     sinusoidal wobble.
 *   - Fades in from the bottom edge, fades out as it nears the top.
 *   - Pure 2D canvas — no WebGL, no DOM nodes per particle.
 *
 * Performance: ~0.3ms per frame on mid-tier hardware. Pointer-events
 * are disabled so the layer never interferes with the UI underneath.
 *
 * Opt-out: pass `disabled` prop, or unmount based on route.
 */

import { useEffect, useRef } from "react";

interface GoldDustFieldProps {
  /** How many particles to maintain. Default 60. */
  count?: number;
  /** Z-index of the canvas. Default 5 (below modals at z-50+, above page bg). */
  zIndex?: number;
  /** Disable rendering entirely (e.g., during a heavy 3D scene). */
  disabled?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hueShift: number;     // 0..1 ramp between two gold tones
  twinklePhase: number; // for subtle alpha breathing
  twinkleRate: number;
  age: number;
  life: number;
}

const COLOR_A = { r: 255, g: 232, b: 158 }; // bright gold
const COLOR_B = { r: 196, g: 160, b: 53 };  // deep gold

export default function GoldDustField({
  count = 60,
  zIndex = 5,
  disabled = false,
}: GoldDustFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    let viewW = window.innerWidth;
    let viewH = window.innerHeight;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      viewW = window.innerWidth;
      viewH = window.innerHeight;
      canvas.width = Math.floor(viewW * dpr);
      canvas.height = Math.floor(viewH * dpr);
      canvas.style.width = viewW + "px";
      canvas.style.height = viewH + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(document.documentElement);

    const particles: Particle[] = [];
    const spawn = (initial: boolean): Particle => ({
      x: Math.random() * viewW,
      // If initial, distribute throughout vertical space; else spawn near bottom.
      y: initial ? Math.random() * viewH : viewH + Math.random() * 80,
      vx: (Math.random() - 0.5) * 0.18,
      vy: -0.18 - Math.random() * 0.32,        // upward drift
      size: 0.6 + Math.random() * 1.8,         // 0.6 → 2.4 px
      hueShift: Math.random(),
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleRate: 0.6 + Math.random() * 1.4,
      age: 0,
      life: 9 + Math.random() * 10,            // 9 → 19s
    });
    for (let i = 0; i < count; i++) particles.push(spawn(true));

    let lastTime = performance.now();
    let raf = 0;
    let cancelled = false;
    let visible = !document.hidden;

    const onVis = () => {
      visible = !document.hidden;
      if (visible) {
        lastTime = performance.now();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const render = (now: number) => {
      if (cancelled) return;
      const delta = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      if (!visible) {
        raf = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, viewW, viewH);
      ctx.globalCompositeOperation = "lighter"; // additive — particles add to whatever's beneath

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.age += delta;
        p.x += p.vx + Math.sin(now * 0.0007 + p.twinklePhase) * 0.04;
        p.y += p.vy;
        p.twinklePhase += delta * p.twinkleRate;

        // Recycle particles that drifted off the top, faded out, or expired.
        if (p.y < -10 || p.age > p.life) {
          particles[i] = spawn(false);
          continue;
        }

        // Lifetime fade: fade in at start, hold, fade out near end.
        const u = p.age / p.life;
        let alpha;
        if (u < 0.15) alpha = u / 0.15;
        else if (u > 0.7) alpha = (1 - u) / 0.3;
        else alpha = 1;
        // Subtle twinkle on top
        const twinkle = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(p.twinklePhase));
        alpha *= twinkle * 0.85;

        // Mix two gold tones
        const m = p.hueShift;
        const r = Math.round(COLOR_A.r + (COLOR_B.r - COLOR_A.r) * m);
        const g = Math.round(COLOR_A.g + (COLOR_B.g - COLOR_A.g) * m);
        const b = Math.round(COLOR_A.b + (COLOR_B.b - COLOR_A.b) * m);

        // Outer soft glow
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4.5);
        glow.addColorStop(0, `rgba(${r},${g},${b},${0.45 * alpha})`);
        glow.addColorStop(0.4, `rgba(${r},${g},${b},${0.18 * alpha})`);
        glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Bright core
        ctx.fillStyle = `rgba(${Math.min(255, r + 30)},${Math.min(255, g + 30)},${Math.min(255, b + 30)},${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [count, disabled]);

  if (disabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex,
        // Slight blur for softness — comment out if perf is tight on low-end.
        // filter: "blur(0.4px)",
      }}
    />
  );
}

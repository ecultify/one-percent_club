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
import { useVideoPlayback } from "@/lib/VideoPlaybackContext";

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
  const { isVideoPlaying } = useVideoPlayback();
  // Mirror the context flag into a ref so the long-lived RAF loop can
  // read it every frame without restarting (which would happen if we
  // added isVideoPlaying to the effect's dep array).
  const isVideoPlayingRef = useRef(false);
  useEffect(() => { isVideoPlayingRef.current = isVideoPlaying; }, [isVideoPlaying]);

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

    // Pre-render two particle sprites (one per gold tone) onto offscreen
    // canvases. The render loop uses drawImage instead of recreating a
    // radial gradient per particle per frame. createRadialGradient + arc
    // fill per particle was burning ~25-40% of frame budget at 55
    // particles × 60fps. drawImage from a cached canvas is a near-free
    // GPU blit. Visual delta: instead of continuous interpolation between
    // COLOR_A and COLOR_B, particles bucket into one of two tones based
    // on hueShift > 0.5. At particle scale (0.6-2.4 px core, 9 px glow)
    // this is imperceptible.
    const SPRITE_SIZE = 64;
    const SPRITE_CENTER = SPRITE_SIZE / 2;
    // Original: glow at radius p.size * 4.5, core at p.size. Sprite must
    // preserve the same ratio so visual identity holds across all sizes.
    const SPRITE_CORE_RADIUS = SPRITE_CENTER / 4.5;
    const buildSprite = (color: { r: number; g: number; b: number }) => {
      const c = document.createElement("canvas");
      c.width = c.height = SPRITE_SIZE;
      const cx = c.getContext("2d");
      if (!cx) return c;
      const glow = cx.createRadialGradient(
        SPRITE_CENTER, SPRITE_CENTER, 0,
        SPRITE_CENTER, SPRITE_CENTER, SPRITE_CENTER,
      );
      glow.addColorStop(0, `rgba(${color.r},${color.g},${color.b},0.45)`);
      glow.addColorStop(0.4, `rgba(${color.r},${color.g},${color.b},0.18)`);
      glow.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
      cx.fillStyle = glow;
      cx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
      const cr = Math.min(255, color.r + 30);
      const cg = Math.min(255, color.g + 30);
      const cb = Math.min(255, color.b + 30);
      cx.fillStyle = `rgba(${cr},${cg},${cb},1)`;
      cx.beginPath();
      cx.arc(SPRITE_CENTER, SPRITE_CENTER, SPRITE_CORE_RADIUS, 0, Math.PI * 2);
      cx.fill();
      return c;
    };
    const spriteA = buildSprite(COLOR_A);
    const spriteB = buildSprite(COLOR_B);

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
      if (!visible || isVideoPlayingRef.current) {
        // While a foreground video is playing, skip the per-frame draw
        // entirely so the main thread + GPU stay free for video decoding.
        // The RAF chain stays alive so we resume seamlessly on resume.
        raf = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, viewW, viewH);
      ctx.globalCompositeOperation = "lighter"; // additive blending preserved

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.age += delta;
        p.x += p.vx + Math.sin(now * 0.0007 + p.twinklePhase) * 0.04;
        p.y += p.vy;
        p.twinklePhase += delta * p.twinkleRate;

        if (p.y < -10 || p.age > p.life) {
          particles[i] = spawn(false);
          continue;
        }

        const u = p.age / p.life;
        let alpha;
        if (u < 0.15) alpha = u / 0.15;
        else if (u > 0.7) alpha = (1 - u) / 0.3;
        else alpha = 1;
        const twinkle = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(p.twinklePhase));
        alpha *= twinkle * 0.85;

        // Pick cached sprite, draw it scaled + alpha-modulated. drawImage
        // honours globalAlpha for the whole image so per-frame alpha just
        // sets globalAlpha once per particle.
        const sprite = p.hueShift > 0.5 ? spriteB : spriteA;
        const drawRadius = p.size * 4.5;
        const drawSize = drawRadius * 2;
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, p.x - drawRadius, p.y - drawRadius, drawSize, drawSize);
      }

      ctx.globalAlpha = 1;
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

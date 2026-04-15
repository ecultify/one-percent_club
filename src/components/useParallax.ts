"use client";

import { useEffect, useRef, useState } from "react";

interface ParallaxOffset {
  x: number; // -1 to 1 (normalized)
  y: number; // -1 to 1
}

/**
 * Lightweight mouse-based parallax hook.
 * Returns a normalized (-1, 1) offset that updates smoothly as the cursor moves.
 * Uses requestAnimationFrame and eases toward the target so motion feels organic.
 *
 * Usage:
 *   const { x, y } = useParallax();
 *   <div style={{ transform: `translate(${x * 8}px, ${y * 6}px)` }} />
 *
 * Note: Apply to *background/atmospheric* elements only. Moving foreground
 * content induces motion sickness. Max recommended multiplier: 12px.
 */
export function useParallax(ease = 0.12): ParallaxOffset {
  const [offset, setOffset] = useState<ParallaxOffset>({ x: 0, y: 0 });
  const targetRef = useRef<ParallaxOffset>({ x: 0, y: 0 });
  const currentRef = useRef<ParallaxOffset>({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Normalize to [-1, 1] with the center being (0, 0)
      targetRef.current = {
        x: (e.clientX / vw) * 2 - 1,
        y: (e.clientY / vh) * 2 - 1,
      };
    };

    const tick = () => {
      const t = targetRef.current;
      const c = currentRef.current;
      c.x += (t.x - c.x) * ease;
      c.y += (t.y - c.y) * ease;
      setOffset({ x: c.x, y: c.y });
      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ease]);

  return offset;
}

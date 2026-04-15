"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNarration } from "./NarrationProvider";

/**
 * Pre-welcome-video stats reveal — typographic manifesto.
 *
 * Three beats land in sequence, each accumulating on the screen rather
 * than replacing the last. By the third dhak the viewer sees the entire
 * promise: "100 PLAYERS · 8 QUESTIONS · ₹1 CRORE".
 *
 * The visual language is pure typography + masking + camera shake on
 * each beat — no SVG, no concentric rings, no generic AI tropes.
 */

interface Props {
  onComplete: () => void;
}

interface Beat {
  at: number;       // ms from sequence start
  big: string;      // hero text (huge)
  small: string;    // descriptor (small caps to the right)
  tint?: "neutral" | "gold";  // gold for the prize line
}

const BEATS: Beat[] = [
  { at: 0,    big: "100",        small: "Players in the arena",       tint: "neutral" },
  { at: 1900, big: "8",          small: "Sawaal jo zindagi badal de", tint: "neutral" },
  { at: 3650, big: "₹1 Crore",   small: "Ek hi vijeta. Ek hi inaam.", tint: "gold" },
];

const TOTAL_DURATION = 5800;

export default function StatsIntro({ onComplete }: Props) {
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [shakeKey, setShakeKey] = useState(0);
  const { muted } = useNarration();
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const audioPoolRef = useRef<HTMLAudioElement[][]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completedRef = useRef(false);

  useEffect(() => {
    const pool: HTMLAudioElement[][] = BEATS.map(() => {
      const a = new Audio("/sound/dhak.wav");
      const b = new Audio("/sound/dhak.wav");
      [a, b].forEach((x) => { x.preload = "auto"; x.volume = 1.0; });
      return [a, b];
    });
    audioPoolRef.current = pool;
    return () => {
      pool.flat().forEach((x) => { x.pause(); x.src = ""; });
    };
  }, []);

  useEffect(() => {
    const start = performance.now();
    BEATS.forEach((beat, i) => {
      const t = setTimeout(() => {
        if (!mutedRef.current) {
          audioPoolRef.current[i]?.forEach((x) => {
            try { x.currentTime = 0; x.play().catch(() => {}); } catch {}
          });
        }
        setActiveIndex(i);
        setShakeKey((k) => k + 1);
      }, Math.max(0, beat.at - (performance.now() - start)));
      timersRef.current.push(t);
    });
    const doneTimer = setTimeout(() => {
      if (!completedRef.current) { completedRef.current = true; onComplete(); }
    }, TOTAL_DURATION);
    timersRef.current.push(doneTimer);
    return () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[68] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #1a120a 0%, #0a0805 55%, #000000 100%)",
      }}
    >
      {/* Subtle film grain — pure CSS, no SVG */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-radial-gradient(circle at 0 0, rgba(255,255,255,0.4) 0, rgba(255,255,255,0.4) 1px, transparent 1px, transparent 2px)",
        }}
      />

      {/* Horizontal CRT scanlines — pure CSS */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.08]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,220,140,0.4) 0px, rgba(255,220,140,0.4) 1px, transparent 1px, transparent 4px)",
        }}
      />

      {/* Top kicker — anchors the show identity */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="absolute top-12 md:top-16 left-0 right-0 text-center"
      >
        <p className="font-mono text-[11px] md:text-[13px] uppercase tracking-[0.55em] text-brass-bright/80">
          The 1% Club · Tonight
        </p>
        <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-brass/60 to-transparent" />
      </motion.div>

      {/* Beats container — camera shake wraps everything for that "thump" feel */}
      <motion.div
        key={shakeKey}
        initial={{ x: 0, y: 0 }}
        animate={{
          x: [0, -6, 6, -3, 3, 0],
          y: [0, 3, -3, 2, -1, 0],
        }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="absolute inset-0 flex items-center justify-center px-6 md:px-12"
      >
        <div className="w-full max-w-[1200px] flex flex-col gap-6 md:gap-10">
          {BEATS.map((beat, i) => {
            const visible = activeIndex >= i;
            const isPrize = beat.tint === "gold";
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 80, filter: "blur(20px)" }}
                animate={
                  visible
                    ? { opacity: 1, x: 0, filter: "blur(0px)" }
                    : { opacity: 0, x: 80, filter: "blur(20px)" }
                }
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="relative grid grid-cols-[auto_1fr] items-center gap-5 md:gap-10"
              >
                {/* Hero number/text */}
                <div className="relative">
                  <h2
                    className={`font-display font-semibold leading-[0.85] tracking-[-0.04em] text-[clamp(4rem,12vw,11rem)] ${
                      isPrize ? "text-brass-bright" : "text-foreground"
                    }`}
                    style={{
                      textShadow: isPrize
                        ? "0 0 60px rgba(228,207,106,0.35), 0 0 120px rgba(228,207,106,0.18)"
                        : "0 0 40px rgba(255,255,255,0.06)",
                    }}
                  >
                    {beat.big}
                  </h2>

                  {/* Gold sweep — only on the prize, runs once after it lands */}
                  {visible && isPrize && (
                    <motion.div
                      aria-hidden
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          "linear-gradient(110deg, transparent 30%, rgba(255,250,220,0.85) 48%, rgba(255,255,255,0.95) 50%, rgba(255,235,170,0.85) 52%, transparent 70%)",
                        mixBlendMode: "overlay",
                      }}
                      initial={{ x: "-110%" }}
                      animate={{ x: "120%" }}
                      transition={{ duration: 1.6, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                    />
                  )}
                </div>

                {/* Vertical accent + descriptor */}
                <div className="flex items-center gap-4 md:gap-6">
                  <div className={`h-12 md:h-16 w-px ${isPrize ? "bg-brass-bright/70" : "bg-brass/40"}`} />
                  <p
                    className={`font-mono text-xs md:text-sm uppercase tracking-[0.4em] leading-relaxed ${
                      isPrize ? "text-brass-bright/90" : "text-foreground/65"
                    }`}
                  >
                    {beat.small}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Bottom progress dashes (no dots, no rings) */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-3">
        {BEATS.map((_, i) => (
          <motion.div
            key={i}
            className="h-[2px]"
            animate={{
              width: activeIndex >= i ? 56 : 32,
              backgroundColor: activeIndex >= i ? "rgba(228,207,106,0.95)" : "rgba(228,207,106,0.2)",
            }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        ))}
      </div>

      {/* Bottom marquee text after final beat */}
      <AnimatePresence>
        {activeIndex >= BEATS.length - 1 && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.5 }}
            className="absolute bottom-20 left-0 right-0 text-center font-mono text-[10px] md:text-[11px] uppercase tracking-[0.45em] text-brass-dim/80"
          >
            Sirf woh jo dimaag aur dil dono se khelte hain
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

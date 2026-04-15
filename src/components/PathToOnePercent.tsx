"use client";

import { motion } from "framer-motion";

/**
 * Visualizes the elimination path from 100% (you + the crowd) down to 1% (the club).
 * Horizontal stepper: eight dots, one per question, sized by survival rate and
 * tinted from bright green (safe) to deep red (cruel). Each dot animates in on mount.
 *
 * Companion "shrinking audience" dots above each step show visualised eliminations.
 */

const STEPS = [
  { pct: 90, survivors: 90 },
  { pct: 80, survivors: 72 },
  { pct: 70, survivors: 50 },
  { pct: 60, survivors: 30 },
  { pct: 50, survivors: 15 },
  { pct: 30, survivors: 4 },
  { pct: 10, survivors: 0.4 },
  { pct: 1, survivors: 0 },
];

function colorFor(pct: number): { ring: string; fill: string; text: string } {
  if (pct >= 80) return { ring: "border-emerald-400/70", fill: "bg-emerald-400", text: "text-emerald-300" };
  if (pct >= 50) return { ring: "border-amber-400/70", fill: "bg-amber-400", text: "text-amber-300" };
  if (pct >= 20) return { ring: "border-orange-400/70", fill: "bg-orange-400", text: "text-orange-300" };
  return { ring: "border-red-400/75", fill: "bg-red-400", text: "text-red-300" };
}

export default function PathToOnePercent() {
  return (
    <div className="relative w-full">
      {/* Kicker line */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.38em] text-brass-dim">
            The path
          </p>
          <p className="text-[11px] text-foreground/60 mt-1">
            100 players start. Only 1% finishes.
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[9px] uppercase tracking-[0.38em] text-brass-dim">Survival</p>
          <p className="font-display text-brass-bright text-sm tabular-nums font-semibold">
            100 &rarr; 1
          </p>
        </div>
      </div>

      {/* The track */}
      <div className="relative py-3 px-1">
        {/* Connector line behind the dots */}
        <div className="absolute left-1 right-1 top-1/2 h-[2px] -translate-y-1/2 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 via-orange-400 to-red-500"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.6, delay: 0.2, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: "left" }}
          />
        </div>

        {/* Step dots */}
        <div className="relative flex items-center justify-between">
          {STEPS.map((step, i) => {
            const color = colorFor(step.pct);
            const size = Math.max(10, 22 - i * 1.5); // subtly shrink across the row
            return (
              <motion.div
                key={step.pct}
                className="relative flex flex-col items-center"
                initial={{ opacity: 0, y: 6, scale: 0.7 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.09, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              >
                {/* Dot with ring */}
                <div
                  className={`relative rounded-full border-2 ${color.ring} ${color.fill} shadow-[0_0_12px_rgba(228,207,106,0.25)]`}
                  style={{ width: size, height: size }}
                >
                  {/* Pulsing highlight on the hardest dots */}
                  {step.pct <= 10 && (
                    <motion.div
                      className={`absolute inset-0 rounded-full ${color.fill}`}
                      animate={{ opacity: [0.4, 0.9, 0.4], scale: [1, 1.4, 1] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                </div>
                {/* Percentage label below */}
                <span
                  className={`mt-2 font-mono text-[10px] font-semibold tabular-nums ${color.text}`}
                >
                  {step.pct}%
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Endpoint callout */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="mt-5 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em]"
      >
        <span className="text-emerald-300/80">Start — all of India</span>
        <span className="text-red-300/90">The 1% Club</span>
      </motion.div>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";

interface HostSilhouetteProps {
  /** Left or right side of screen. */
  side?: "left" | "right";
  /** Opacity level. Default 0.12 (very subtle). */
  opacity?: number;
}

/**
 * Ambient silhouette of a suited host at the edge of the stage.
 * Pure SVG — no images needed. Breathes gently with a slow scale/y animation.
 * Meant to be a suggestion, never the focal point.
 */
export default function HostSilhouette({ side = "right", opacity = 0.12 }: HostSilhouetteProps) {
  return (
    <motion.div
      aria-hidden
      className={`fixed bottom-0 ${side === "right" ? "right-0" : "left-0"} pointer-events-none z-[1]`}
      style={{
        width: "min(28vw, 340px)",
        height: "min(72vh, 620px)",
        opacity,
      }}
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: [12, 6, 12], opacity }}
      transition={{
        y: { duration: 6, repeat: Infinity, ease: "easeInOut" },
        opacity: { duration: 1.5, ease: "easeOut" },
      }}
    >
      {/* Gentle warm glow emanating from behind the figure */}
      <div
        className="absolute inset-0"
        style={{
          background:
            side === "right"
              ? "radial-gradient(ellipse 60% 50% at 70% 35%, rgba(228,207,106,0.18), transparent 70%)"
              : "radial-gradient(ellipse 60% 50% at 30% 35%, rgba(228,207,106,0.18), transparent 70%)",
        }}
      />

      {/* Silhouette SVG — a confident standing figure in a bandhgala-style jacket */}
      <svg
        viewBox="0 0 200 620"
        className={`absolute bottom-0 ${side === "right" ? "right-0" : "left-0"} h-full w-auto`}
        preserveAspectRatio={side === "right" ? "xMaxYMax meet" : "xMinYMax meet"}
      >
        <defs>
          <linearGradient id="host-body-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a0906" stopOpacity="0.85" />
            <stop offset="60%" stopColor="#0a0906" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0a0906" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="host-rim-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(228,207,106,0.0)" />
            <stop offset="50%" stopColor="rgba(228,207,106,0.45)" />
            <stop offset="100%" stopColor="rgba(228,207,106,0.0)" />
          </linearGradient>
        </defs>

        {/* Ground shadow pool */}
        <ellipse cx="100" cy="615" rx="80" ry="10" fill="rgba(0,0,0,0.35)" />

        {/* Body (bandhgala jacket shape) */}
        <path
          d="M 100 95
             C 78 95, 62 108, 58 140
             L 50 220
             C 48 240, 46 265, 45 295
             L 42 410
             C 42 450, 45 495, 50 560
             L 55 610
             L 145 610
             L 150 560
             C 155 495, 158 450, 158 410
             L 155 295
             C 154 265, 152 240, 150 220
             L 142 140
             C 138 108, 122 95, 100 95 Z"
          fill="url(#host-body-gradient)"
        />

        {/* Rim light edge on facing side */}
        <path
          d={
            side === "right"
              ? "M 45 295 L 42 410 C 42 450, 45 495, 50 560 L 55 610"
              : "M 155 295 L 158 410 C 158 450, 155 495, 150 560 L 145 610"
          }
          fill="none"
          stroke="rgba(228,207,106,0.35)"
          strokeWidth="2"
          opacity="0.8"
        />

        {/* Head (slightly tilted for a natural stance) */}
        <ellipse cx="100" cy="62" rx="28" ry="34" fill="#0a0906" />

        {/* Neck */}
        <rect x="88" y="88" width="24" height="14" fill="#0a0906" />

        {/* Jacket button line center */}
        <line
          x1="100"
          y1="140"
          x2="100"
          y2="340"
          stroke="rgba(228,207,106,0.15)"
          strokeWidth="1"
          strokeDasharray="2 4"
        />

        {/* Subtle lapel edges */}
        <path
          d="M 100 110 L 80 155 L 100 175 L 120 155 Z"
          fill="rgba(0,0,0,0.4)"
        />

        {/* Hint of microphone in hand at side */}
        {side === "right" ? (
          <g transform="translate(52,320)">
            <rect x="0" y="0" width="6" height="28" rx="2" fill="rgba(0,0,0,0.9)" />
            <circle cx="3" cy="-3" r="5" fill="rgba(228,207,106,0.35)" />
          </g>
        ) : (
          <g transform="translate(142,320)">
            <rect x="0" y="0" width="6" height="28" rx="2" fill="rgba(0,0,0,0.9)" />
            <circle cx="3" cy="-3" r="5" fill="rgba(228,207,106,0.35)" />
          </g>
        )}
      </svg>

      {/* Ground spotlight pool reinforcing stage-floor illusion */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[28%]"
        style={{
          background:
            "radial-gradient(ellipse 70% 100% at 50% 100%, rgba(228,207,106,0.25), transparent 75%)",
          filter: "blur(20px)",
        }}
      />
    </motion.div>
  );
}

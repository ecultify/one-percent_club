"use client";

import { AnimatePresence, motion, useMotionValue, useSpring } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNarration } from "./NarrationProvider";
import MuteButton from "./MuteButton";

interface InstructionsProps {
  playerName: string;
  onStart: () => void;
}

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];
const EASE_EXPO: [number, number, number, number] = [0.19, 1, 0.22, 1];
const EASE_SLAM: [number, number, number, number] = [0.16, 1, 0.3, 1];

const BRASS_TEXT =
  "linear-gradient(180deg, #fff2c2 0%, #f4dc7c 18%, #e6c45a 42%, #b28622 72%, #6d4e13 96%)";

const BRASS_TEXT_STRONG =
  "linear-gradient(180deg, #fff5d2 0%, #f9e89a 12%, #e6c45a 38%, #a6801f 70%, #543708 100%)";

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "friend";
}

export function buildInstructionsNarration(name: string) {
  const first = firstNameOf(name);
  return (
    `${first}, ab suniye game kaise khelna hai. ` +
    `Yeh khel aath sawaalon ka hai. Har sawaal ke saath ek percentage diya hoga. ` +
    `Yeh percentage batata hai ki India mein kitne log yeh sawaal sahi kar sakte hain. ` +
    `Pehla sawaal nabbe percent ka, kaafi aasaan. ` +
    `Aur aakhri sawaal sirf ek percent ka. Sirf ek percent log usse crack kar paate hain. ` +
    `Har sawaal ka ek time limit hoga. Jaldi sochiye, dil se jawab dijiye. ` +
    `Logic, reasoning, aur instinct. Bas yahi hai aapka hathiyaar. ` +
    `Are you ready, ${first}? Let's get started.`
  );
}

/* ──────────────────────────────────────────────────────────────
 * SCENES
 * Each scene OWNS the whole screen. No panel, no frame.
 * Think: hard cuts between shots in a TV broadcast.
 * ────────────────────────────────────────────────────────────── */

interface Scene {
  key: string;
  at: number;               // seconds from mount
  tone: "gold" | "red";     // dictates the ambient tonal wash
  eyebrow: string;          // small corner label
  lowerThird?: string;      // caption strip at bottom while scene plays
  render: (name: string) => ReactNode;
}

const SCENES: Scene[] = [
  // 0 — Welcome / floor call
  {
    key: "welcome",
    at: 0.25,
    tone: "gold",
    eyebrow: "On the floor",
    lowerThird: "Aaiye, ek minute mein samjha deta hoon",
    render: (name) => (
      <div className="flex flex-col items-center text-center gap-5 md:gap-7">
        <motion.span
          initial={{ opacity: 0, y: 10, letterSpacing: "0.6em" }}
          animate={{ opacity: 1, y: 0, letterSpacing: "0.34em" }}
          transition={{ duration: 0.7, ease: EASE_SLAM }}
          className="text-[11px] md:text-[13px] uppercase tracking-[0.34em] text-[#c9a94a]"
        >
          Welcome to The 1% Club
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 28, scale: 1.08, filter: "blur(12px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.85, delay: 0.12, ease: EASE_SLAM }}
          className="font-black leading-[0.95] tracking-[-0.03em]"
          style={{
            fontSize: "clamp(3.2rem, 9vw, 7.5rem)",
            background: BRASS_TEXT_STRONG,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 0 40px rgba(228,196,90,0.35))",
          }}
        >
          {firstNameOf(name)}.
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.42, ease: EASE }}
          className="flex items-center gap-3"
        >
          <span
            className="h-[1px] w-10 md:w-16"
            style={{ background: "linear-gradient(90deg, transparent, #c9a94a)" }}
          />
          <span
            className="text-[10px] md:text-[12px] uppercase tracking-[0.42em] text-[#f4dc7c]"
          >
            Aata hoon ek minute mein
          </span>
          <span
            className="h-[1px] w-10 md:w-16"
            style={{ background: "linear-gradient(90deg, #c9a94a, transparent)" }}
          />
        </motion.div>
      </div>
    ),
  },

  // 1 — 8 SAWAAL — the slam
  {
    key: "eight-sawaal",
    at: 3.0,
    tone: "gold",
    eyebrow: "The count",
    lowerThird: "Eight sawaal. Ek winner. Ek raat.",
    render: () => (
      <div className="flex items-baseline justify-center gap-6 md:gap-10">
        <motion.span
          initial={{ scale: 1.7, opacity: 0, filter: "blur(16px)" }}
          animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.55, ease: EASE_SLAM }}
          className="font-black tabular-nums leading-[0.82]"
          style={{
            fontSize: "clamp(10rem, 32vw, 26rem)",
            background: BRASS_TEXT_STRONG,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter:
              "drop-shadow(0 18px 40px rgba(0,0,0,0.6)) drop-shadow(0 0 60px rgba(228,196,90,0.35))",
          }}
        >
          8
        </motion.span>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.28, ease: EASE }}
          className="flex flex-col items-start gap-1 md:gap-2"
        >
          <span
            className="font-semibold text-[#f4dc7c] leading-none"
            style={{ fontSize: "clamp(2rem, 4.5vw, 4rem)" }}
          >
            Sawaal
          </span>
          <span
            className="uppercase tracking-[0.42em] text-[#c9a94a]"
            style={{ fontSize: "clamp(0.7rem, 0.9vw, 0.9rem)" }}
          >
            Ek ke baad ek
          </span>
        </motion.div>
      </div>
    ),
  },

  // 2 — THE RULE: Each sawaal carries a %
  {
    key: "percent-rule",
    at: 6.6,
    tone: "gold",
    eyebrow: "The rule",
    lowerThird: "India mein kitne log yeh sawaal sahi kar sakte hain",
    render: () => (
      <div className="flex items-center justify-center gap-6 md:gap-10 max-w-[1100px]">
        <motion.span
          initial={{ scale: 1.4, opacity: 0, rotate: -6, filter: "blur(14px)" }}
          animate={{ scale: 1, opacity: 1, rotate: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.65, ease: EASE_SLAM }}
          className="font-bold leading-none"
          style={{
            fontSize: "clamp(8rem, 22vw, 20rem)",
            background: BRASS_TEXT_STRONG,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter:
              "drop-shadow(0 14px 28px rgba(0,0,0,0.55)) drop-shadow(0 0 44px rgba(228,196,90,0.32))",
          }}
        >
          %
        </motion.span>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.28, ease: EASE }}
          className="flex max-w-[520px] flex-col items-start gap-3 text-left"
        >
          <span
            className="font-semibold leading-[1.05] text-[#fff2c2]"
            style={{ fontSize: "clamp(1.5rem, 3vw, 2.4rem)" }}
          >
            Har sawaal ka apna percentage.
          </span>
          <span
            className="uppercase tracking-[0.32em] text-[#c9a94a]"
            style={{ fontSize: "clamp(0.75rem, 0.9vw, 0.95rem)" }}
          >
            Jitna chhota number, utna mushkil
          </span>
        </motion.div>
      </div>
    ),
  },

  // 3 — 90% — the warm-up
  {
    key: "ninety",
    at: 11.5,
    tone: "gold",
    eyebrow: "The warm-up",
    lowerThird: "Pehla sawaal. Kaafi aasaan.",
    render: () => (
      <div className="flex items-baseline justify-center gap-6 md:gap-10">
        <motion.span
          initial={{ scale: 1.5, opacity: 0, filter: "blur(14px)" }}
          animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.6, ease: EASE_SLAM }}
          className="font-bold tabular-nums leading-[0.82]"
          style={{
            fontSize: "clamp(8rem, 26vw, 22rem)",
            background: BRASS_TEXT_STRONG,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter:
              "drop-shadow(0 16px 36px rgba(0,0,0,0.55)) drop-shadow(0 0 56px rgba(244,220,124,0.42))",
          }}
        >
          90%
        </motion.span>
        <motion.div
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.3, ease: EASE }}
          className="flex flex-col items-start gap-1 md:gap-2 pb-[2vh]"
        >
          <span
            className="font-semibold text-[#f4dc7c] leading-none"
            style={{ fontSize: "clamp(1.4rem, 3vw, 2.4rem)" }}
          >
            Har koi khel sakta hai
          </span>
          <span
            className="uppercase tracking-[0.34em] text-[#c9a94a]"
            style={{ fontSize: "clamp(0.7rem, 0.9vw, 0.9rem)" }}
          >
            100 out of 100 are in
          </span>
        </motion.div>
      </div>
    ),
  },

  // 4 — 1% — THE CLUB. Red tonal overtake. Ember carve.
  {
    key: "one-percent",
    at: 15.8,
    tone: "red",
    eyebrow: "The final filter",
    lowerThird: "Sirf ek percent log isse crack kar paate hain",
    render: () => (
      <div className="flex flex-col items-center justify-center gap-4 md:gap-6">
        {/* Outgoing 90 shadow sitting ghosted behind the 1% */}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.1 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="absolute font-bold tabular-nums leading-[0.8] pointer-events-none"
          style={{
            fontSize: "clamp(10rem, 32vw, 26rem)",
            color: "#2a0f0a",
            textShadow: "0 0 80px rgba(60,10,0,0.5)",
          }}
          aria-hidden
        >
          100
        </motion.span>

        <motion.span
          initial={{ scale: 1.8, opacity: 0, filter: "blur(22px)" }}
          animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: EASE_SLAM }}
          className="relative font-bold tabular-nums leading-[0.82]"
          style={{
            fontSize: "clamp(10rem, 34vw, 28rem)",
            color: "#ff6a3c",
            textShadow:
              "0 0 24px rgba(255,106,60,0.6), 0 0 56px rgba(255,80,40,0.45), 0 4px 0 #7a1a0a, 0 8px 40px rgba(0,0,0,0.6)",
          }}
        >
          1%
        </motion.span>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
          className="relative flex flex-col items-center gap-2"
        >
          <span
            className="font-semibold"
            style={{
              fontSize: "clamp(1.6rem, 3.2vw, 2.6rem)",
              color: "#ffdccf",
              textShadow: "0 0 22px rgba(255,90,58,0.45)",
            }}
          >
            Welcome to the Club.
          </span>
          <span
            className="uppercase tracking-[0.42em] text-[#ff8e6a]"
            style={{ fontSize: "clamp(0.7rem, 0.85vw, 0.85rem)" }}
          >
            Aakhri sawaal · 1% only
          </span>
        </motion.div>
      </div>
    ),
  },

  // 5 — TIMER
  {
    key: "clock",
    at: 20.2,
    tone: "gold",
    eyebrow: "The clock",
    lowerThird: "Jaldi sochiye. Dil se jawab dijiye.",
    render: () => (
      <div className="flex items-center justify-center gap-8 md:gap-14">
        <AnalogClockSweep />
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.3, ease: EASE }}
          className="flex flex-col items-start gap-3 max-w-[460px]"
        >
          <span
            className="font-semibold leading-[1.05] text-[#fff2c2]"
            style={{ fontSize: "clamp(1.6rem, 3.2vw, 2.6rem)" }}
          >
            Har sawaal ka ek ghadi.
          </span>
          <span
            className="uppercase tracking-[0.32em] text-[#c9a94a]"
            style={{ fontSize: "clamp(0.75rem, 0.9vw, 0.95rem)" }}
          >
            Hesitation = wrong answer
          </span>
        </motion.div>
      </div>
    ),
  },

  // 6 — WEAPONS — Logic / Reasoning / Instinct slam stacked
  {
    key: "weapons",
    at: 24.0,
    tone: "gold",
    eyebrow: "Your weapons",
    lowerThird: "Bas yahi hai aapka hathiyaar",
    render: () => (
      <div className="flex flex-col items-center gap-2 md:gap-3">
        {["Logic.", "Reasoning.", "Instinct."].map((word, i) => (
          <motion.span
            key={word}
            initial={{ opacity: 0, y: 42, scale: 1.12, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            transition={{
              duration: 0.55,
              delay: 0.12 + i * 0.28,
              ease: EASE_SLAM,
            }}
            className="font-bold leading-[0.95]"
            style={{
              fontSize: "clamp(3rem, 9vw, 7.5rem)",
              background: BRASS_TEXT_STRONG,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 10px 22px rgba(0,0,0,0.55))",
              letterSpacing: "-0.02em",
            }}
          >
            {word}
          </motion.span>
        ))}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.1, ease: EASE }}
          className="mt-3 uppercase tracking-[0.4em] text-[#c9a94a]"
          style={{ fontSize: "clamp(0.75rem, 0.9vw, 0.95rem)" }}
        >
          Koi lifeline nahi · Koi audience poll nahi
        </motion.span>
      </div>
    ),
  },

  // 7 — READY?
  {
    key: "ready",
    at: 27.2,
    tone: "gold",
    eyebrow: "Ready?",
    lowerThird: "One quick tour, then the first question",
    render: (_name) => (
      <div className="flex flex-col items-center gap-5 md:gap-7 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 22, scale: 1.06, filter: "blur(12px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.75, ease: EASE_SLAM }}
          className="font-bold leading-[0.92]"
          style={{
            fontSize: "clamp(4rem, 13vw, 11rem)",
            background: BRASS_TEXT_STRONG,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 12px 32px rgba(0,0,0,0.55)) drop-shadow(0 0 60px rgba(228,196,90,0.35))",
            letterSpacing: "-0.02em",
          }}
        >
          Are you ready?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.3, ease: EASE }}
          className="max-w-md font-medium leading-snug text-[#f4dc7c]"
          style={{ fontSize: "clamp(1.05rem, 1.6vw, 1.35rem)" }}
        >
          Let&apos;s get started.
        </motion.p>
      </div>
    ),
  },
];

/* ──────────────────────────────────────────────────────────────
 * Scene decoration pieces
 * ────────────────────────────────────────────────────────────── */

/** Soft descending spotlight cone from above. Swaps tone on scene change. */
function StageSpotlight({ tone, keyId }: { tone: "gold" | "red"; keyId: string }) {
  const glowTop =
    tone === "red"
      ? "rgba(255,120,60,0.55)"
      : "rgba(255,230,160,0.55)";
  const glowFade =
    tone === "red"
      ? "rgba(255,80,40,0.18)"
      : "rgba(255,205,110,0.18)";

  return (
    <motion.div
      key={`spot-${keyId}`}
      initial={{ opacity: 0, scaleY: 0.6 }}
      animate={{ opacity: 1, scaleY: 1 }}
      transition={{ duration: 0.9, ease: EASE_EXPO }}
      className="pointer-events-none absolute inset-x-0 -top-10 z-[2]"
      style={{
        height: "85vh",
        transformOrigin: "top center",
        mixBlendMode: "screen",
        background: `conic-gradient(from 180deg at 50% -8%, transparent 0deg, ${glowTop} 170deg, ${glowFade} 188deg, transparent 360deg)`,
        filter: "blur(14px)",
      }}
      aria-hidden
    />
  );
}

/** Bottom-warm floor glow — sells the stage depth. */
function StageFloor({ tone }: { tone: "gold" | "red" }) {
  const col =
    tone === "red"
      ? "rgba(255,70,40,0.22)"
      : "rgba(255,220,140,0.18)";
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[42vh] z-[2]"
      style={{
        background: `radial-gradient(ellipse 70% 85% at 50% 100%, ${col} 0%, transparent 70%)`,
      }}
      aria-hidden
    />
  );
}

/** Subtle red room wash for the 1% scene only. */
function RedRoomWash({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="red-wash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
          className="pointer-events-none absolute inset-0 z-[3]"
          style={{
            background:
              "radial-gradient(ellipse 90% 80% at 50% 50%, rgba(120,20,6,0.38) 0%, rgba(40,6,4,0.35) 50%, rgba(8,2,2,0.4) 100%)",
            mixBlendMode: "multiply",
          }}
          aria-hidden
        />
      )}
    </AnimatePresence>
  );
}

/** Floating dust motes — ambient stage particles. Pure CSS animation. */
function DustMotes() {
  // Deterministic seed-ish positions so re-renders don't jitter
  const motes = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const x = (i * 137.5) % 100;
        const y = ((i * 97.3) % 70) + 15;
        const size = 1 + ((i * 7) % 3);
        const delay = (i * 0.43) % 6;
        const dur = 9 + ((i * 3) % 7);
        return { x, y, size, delay, dur, i };
      }),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden" aria-hidden>
      {motes.map((m) => (
        <span
          key={m.i}
          className="absolute rounded-full bg-[#f4dc7c]"
          style={{
            left: `${m.x}%`,
            top: `${m.y}%`,
            width: `${m.size}px`,
            height: `${m.size}px`,
            opacity: 0.28,
            filter: "blur(1px)",
            boxShadow: "0 0 8px rgba(244,220,124,0.55)",
            animation: `mote-drift ${m.dur}s ease-in-out ${m.delay}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes mote-drift {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.25; }
          50%      { transform: translateY(-30px) translateX(14px); opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}

/** Analog clock SVG — sweep 60s in 2.4s for drama. */
function AnalogClockSweep() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, rotate: -18 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: 0.7, ease: EASE_SLAM }}
      className="relative"
      style={{
        width: "clamp(11rem, 20vw, 18rem)",
        aspectRatio: "1 / 1",
      }}
    >
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="clock-rim" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fff0c2" />
            <stop offset="40%" stopColor="#e6c45a" />
            <stop offset="80%" stopColor="#9b7520" />
            <stop offset="100%" stopColor="#4e350a" />
          </linearGradient>
          <radialGradient id="clock-face" cx="50%" cy="42%" r="65%">
            <stop offset="0%" stopColor="#1a1208" />
            <stop offset="70%" stopColor="#08050a" />
            <stop offset="100%" stopColor="#050308" />
          </radialGradient>
        </defs>
        {/* Outer metallic rim */}
        <circle cx="100" cy="100" r="94" fill="url(#clock-rim)" />
        <circle cx="100" cy="100" r="86" fill="url(#clock-face)" />
        {/* Hour ticks — 12 marks */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const r1 = 74;
          const r2 = i % 3 === 0 ? 64 : 69;
          const x1 = 100 + Math.sin(angle) * r1;
          const y1 = 100 - Math.cos(angle) * r1;
          const x2 = 100 + Math.sin(angle) * r2;
          const y2 = 100 - Math.cos(angle) * r2;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#f4dc7c"
              strokeWidth={i % 3 === 0 ? 2.6 : 1.4}
              strokeLinecap="round"
              opacity={i % 3 === 0 ? 0.95 : 0.55}
            />
          );
        })}
        {/* Hour hand — static pointing up-right */}
        <line
          x1="100"
          y1="100"
          x2="134"
          y2="74"
          stroke="#f4dc7c"
          strokeWidth="4.5"
          strokeLinecap="round"
          opacity="0.85"
        />
        {/* Minute hand */}
        <line
          x1="100"
          y1="100"
          x2="100"
          y2="36"
          stroke="#fff2c2"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.92"
        />
        {/* Second hand — animated sweep */}
        <g style={{ transformOrigin: "100px 100px", animation: "clock-sweep 2.4s linear infinite" }}>
          <line
            x1="100"
            y1="118"
            x2="100"
            y2="32"
            stroke="#ff6a3c"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="100" cy="100" r="5" fill="#ff6a3c" />
        </g>
        {/* Centre pin */}
        <circle cx="100" cy="100" r="3" fill="#08050a" />
      </svg>
      <style>{`
        @keyframes clock-sweep {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>
  );
}

/** Broadcast-style lower-third caption strip. Redraws per scene. */
function LowerThird({
  scene,
  active,
}: {
  scene: Scene;
  active: boolean;
}) {
  if (!active || !scene.lowerThird) return null;
  const accent = scene.tone === "red" ? "#ff8e6a" : "#f4dc7c";
  const accentDim = scene.tone === "red" ? "#e05a34" : "#c9a94a";
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-8 z-[18] flex justify-center px-4 md:bottom-12">
      <motion.div
        key={`lt-${scene.key}`}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.5, delay: 0.25, ease: EASE }}
        className="relative flex items-center gap-3 md:gap-4"
      >
        {/* left brass tick */}
        <span
          className="h-[2px] w-12 md:w-20"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent})`,
            filter: `drop-shadow(0 0 6px ${accent})`,
          }}
          aria-hidden
        />
        <span
          className="relative flex items-center gap-3 rounded-full px-5 py-2 md:px-7 md:py-2.5"
          style={{
            background: "rgba(8,4,2,0.72)",
            boxShadow:
              "inset 0 0 0 1px rgba(228,207,106,0.25), 0 18px 48px -18px rgba(0,0,0,0.85)",
          }}
        >
          {/* tiny pulse dot */}
          <span className="relative flex h-2 w-2 items-center justify-center" aria-hidden>
            <span
              className="absolute inset-0 rounded-full"
              style={{
                background: accent,
                animation: "lt-ping 1.4s ease-out infinite",
                opacity: 0.7,
              }}
            />
            <span
              className="relative h-2 w-2 rounded-full"
              style={{
                background: accent,
                boxShadow: `0 0 8px ${accent}`,
              }}
            />
          </span>
          <span
            className="uppercase text-white/90"
            style={{
              fontSize: "clamp(0.72rem, 0.9vw, 0.9rem)",
              letterSpacing: "0.22em",
            }}
          >
            {scene.lowerThird}
          </span>
        </span>
        <span
          className="h-[2px] w-12 md:w-20"
          style={{
            background: `linear-gradient(90deg, ${accentDim}, transparent)`,
          }}
          aria-hidden
        />
        <style>{`
          @keyframes lt-ping {
            0%   { transform: scale(1);   opacity: 0.75; }
            75%  { transform: scale(2.6); opacity: 0;    }
            100% { transform: scale(2.6); opacity: 0;    }
          }
        `}</style>
      </motion.div>
    </div>
  );
}

/** Corner HUD — scene number + skip. */
function HUD({
  sceneIdx,
  total,
  tone,
  onSkip,
  showSkip,
}: {
  sceneIdx: number;
  total: number;
  tone: "gold" | "red";
  onSkip: () => void;
  showSkip: boolean;
}) {
  const accent = tone === "red" ? "#ff8e6a" : "#f4dc7c";
  const accentDim = tone === "red" ? "#c9522e" : "#c9a94a";
  return (
    <>
      {/* Top-right: scene counter + skip */}
      <div className="absolute right-5 top-5 z-[20] flex items-center gap-4 md:right-8 md:top-7">
        <div className="pointer-events-none flex items-center gap-2">
          <span
            className="tabular-nums"
            style={{
              color: accent,
              fontSize: "13px",
              letterSpacing: "0.15em",
              textShadow: `0 0 10px ${accent}80`,
            }}
          >
            {String(sceneIdx + 1).padStart(2, "0")}
          </span>
          <span style={{ color: accentDim, opacity: 0.6, fontSize: "12px" }}>
            /
          </span>
          <span
            className="tabular-nums"
            style={{ color: accentDim, fontSize: "12px", letterSpacing: "0.15em" }}
          >
            {String(total).padStart(2, "0")}
          </span>
        </div>
        {showSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="cursor-pointer rounded-full border px-3 py-1.5 uppercase transition-colors hover:bg-black/60"
            style={{
              fontSize: "10px",
              letterSpacing: "0.32em",
              color: accentDim,
              borderColor: `${accentDim}55`,
              background: "rgba(8,4,2,0.35)",
            }}
          >
            Skip &rsaquo;
          </button>
        )}
      </div>
    </>
  );
}

/** Thin scanline shimmer — subtle CRT / OB truck texture (very low contrast). */
function ScanlineVeil() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[4] opacity-[0.035] mix-blend-overlay"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,245,210,0.12) 2px, rgba(255,245,210,0.12) 3px)",
        backgroundSize: "100% 3px",
      }}
      aria-hidden
    />
  );
}

/** Interactive chapter rail — click a segment to jump; hover shows scene eyebrow. */
function ChapterRail({
  sceneIdx,
  total,
  tone,
  labels,
  onJumpTo,
}: {
  sceneIdx: number;
  total: number;
  tone: "gold" | "red";
  labels: string[];
  onJumpTo: (idx: number) => void;
}) {
  const active = tone === "red" ? "#ff8e6a" : "#e4cf6a";
  const dim = tone === "red" ? "rgba(255,140,100,0.22)" : "rgba(228,207,106,0.16)";
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-[19] flex justify-center px-3 pb-4 md:px-8 md:pb-5">
      <div className="flex w-full max-w-[720px] items-end gap-0.5 md:gap-1">
        {Array.from({ length: total }).map((_, i) => {
          const done = i < sceneIdx;
          const current = i === sceneIdx;
          const label = labels[i] ?? `Step ${i + 1}`;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onJumpTo(i)}
              className="group relative flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c4a035]/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04020a]"
              aria-label={`Chapter ${i + 1}: ${label}`}
              aria-current={current ? "step" : undefined}
            >
              <span
                className="h-[4px] w-full max-w-[100px] rounded-full transition-all duration-500 md:max-w-none"
                style={{
                  background: done || current ? active : dim,
                  boxShadow: current ? `0 0 16px ${active}99` : undefined,
                  transform: current ? "scaleY(1.4)" : "scaleY(1)",
                  opacity: current ? 1 : done ? 0.88 : 0.42,
                }}
              />
              <span
                className="pointer-events-none hidden max-w-[5.5rem] text-center text-[7px] uppercase leading-tight tracking-[0.14em] text-[#c9a94a]/90 opacity-0 transition-opacity duration-200 group-hover:opacity-100 md:block"
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * MAIN
 * ────────────────────────────────────────────────────────────── */

export default function Instructions({ playerName, onStart }: InstructionsProps) {
  const { narrate, stop } = useNarration();
  const [sceneIdx, setSceneIdx] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountRef = useRef(0);
  const reduceMotionRef = useRef(false);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const parallaxX = useSpring(mx, { stiffness: 28, damping: 22 });
  const parallaxY = useSpring(my, { stiffness: 28, damping: 22 });

  const chapterLabels = useMemo(() => SCENES.map((s) => s.eyebrow), []);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const scheduleFromScene = useCallback(
    (fromIdx: number) => {
      clearAllTimers();
      const elapsed = Date.now() - mountRef.current;
      for (let i = fromIdx + 1; i < SCENES.length; i++) {
        const delay = SCENES[i].at * 1000 - elapsed;
        const target = i;
        timersRef.current.push(setTimeout(() => setSceneIdx(target), Math.max(0, delay)));
      }
    },
    [clearAllTimers],
  );

  const jumpToScene = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, SCENES.length - 1));
      // Re-anchor timeline: scene 0 starts at t=0; later scenes use absolute `at` (seconds).
      mountRef.current =
        clamped === 0 ? Date.now() : Date.now() - SCENES[clamped].at * 1000;
      setSceneIdx(clamped);
      scheduleFromScene(clamped);
    },
    [scheduleFromScene],
  );

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (reduceMotionRef.current) return;
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      mx.set(nx * 16);
      my.set(ny * 12);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mx, my]);

  useEffect(() => {
    mountRef.current = Date.now();
    narrate("instructions-intro", buildInstructionsNarration(playerName));
    scheduleFromScene(0);
    return () => {
      stop();
      clearAllTimers();
    };
  }, [narrate, stop, playerName, scheduleFromScene, clearAllTimers]);

  const handleSkip = () => {
    stop();
    clearAllTimers();
    onStart();
  };

  const scene = SCENES[sceneIdx];
  const isFinal = sceneIdx >= SCENES.length - 1;
  const total = SCENES.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="fixed inset-0 z-[60] overflow-hidden font-[Arial,Helvetica,sans-serif] text-[#ebe4d8] antialiased"
      style={{ backgroundColor: "#04020a" }}
    >
      {/* Room: deep black with warm centre bloom + edge vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse 120% 70% at 50% 58%, rgba(16,10,4,0.92) 0%, rgba(6,3,2,0.98) 60%, #020002 100%), radial-gradient(ellipse 140% 120% at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
        aria-hidden
      />
      {/* Grain */}
      <div
        className="pointer-events-none absolute inset-0 z-[2] opacity-[0.085] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />
      <ScanlineVeil />

      {/* Ambient stage — subtle mouse parallax */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{ x: parallaxX, y: parallaxY }}
      >
        <StageSpotlight tone={scene.tone} keyId={scene.key} />
        <StageFloor tone={scene.tone} />
      </motion.div>
      <RedRoomWash active={scene.tone === "red"} />
      <DustMotes />

      {/* Mute (handled by MuteButton — already fixed-positioned) */}
      <MuteButton />

      {/* Corner HUD */}
      <HUD
        sceneIdx={sceneIdx}
        total={total}
        tone={scene.tone}
        onSkip={handleSkip}
        showSkip={!isFinal}
      />

      {/* THE STAGE — editorial rail + cross-fade (Arial-only section; rest of app keeps brand fonts) */}
      <div className="relative z-[10] flex h-full w-full items-center justify-center px-6 md:px-14">
        <AnimatePresence mode="wait">
          <motion.div
            key={scene.key}
            initial={{ opacity: 0, filter: "blur(14px)", x: -8 }}
            animate={{ opacity: 1, filter: "blur(0px)", x: 0 }}
            exit={{ opacity: 0, filter: "blur(10px)", x: 6 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="relative flex w-full max-w-[1280px] items-center justify-center pl-5 md:pl-12"
          >
            <div
              className="pointer-events-none absolute left-0 top-[8%] bottom-[8%] w-[2px] rounded-full bg-gradient-to-b from-[#e8d078] via-[#c4a035]/55 to-transparent md:w-[3px]"
              aria-hidden
            />
            {scene.render(playerName)}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Lower-third while narration plays */}
      <AnimatePresence mode="wait">
        <LowerThird scene={scene} active={!isFinal} />
      </AnimatePresence>

      {/* Chapter rail — interactive segments */}
      <ChapterRail
        sceneIdx={sceneIdx}
        total={total}
        tone={scene.tone}
        labels={chapterLabels}
        onJumpTo={jumpToScene}
      />

      {/* Final scene buttons — float in after last scene renders */}
      <AnimatePresence>
        {isFinal && (
          <motion.div
            key="final-ctas"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, delay: 0.5, ease: EASE }}
            className="pointer-events-auto absolute inset-x-0 bottom-[12vh] z-[22] flex flex-col items-center gap-4 px-6"
          >
            <motion.button
              onClick={onStart}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              className="game-show-btn relative z-0 cursor-pointer rounded-xl px-14 py-[18px] text-center text-[13px] font-semibold uppercase tracking-[0.26em] shadow-[0_0_0_1px_rgba(196,160,53,0.35),0_22px_56px_-12px_rgba(0,0,0,0.85),0_0_48px_-8px_rgba(228,207,106,0.25)] md:px-20 md:py-5 md:text-[14px]"
            >
              <span className="relative z-10">Begin the challenge</span>
            </motion.button>
            <button
              type="button"
              onClick={handleSkip}
              className="cursor-pointer rounded-full border border-[#c9a94a]/30 bg-black/30 px-5 py-2 text-[10px] uppercase tracking-[0.36em] text-[#c9a94a]/70 transition-colors hover:border-[#f4dc7c]/60 hover:text-[#f4dc7c]"
            >
              Skip &amp; begin
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

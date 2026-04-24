"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNarration } from "./NarrationProvider";
import MuteButton from "./MuteButton";

interface InstructionsProps {
  playerName: string;
  onStart: () => void;
}

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];
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
    `Are you ready, ${first}?`
  );
}


interface Scene {
  key: string;
  at: number;               // seconds from mount
  tone: "gold" | "red";     // dictates the ambient tonal wash
  eyebrow: string;          // small corner label
  /** Short TTS when the user jumps here via the chapter rail (re-hear this beat). */
  recapNarration: (name: string) => string;
  render: (name: string) => ReactNode;
}

const SCENES: Scene[] = [
  // 0 — Welcome / floor call
  {
    key: "welcome",
    at: 0.25,
    tone: "gold",
    eyebrow: "On the floor",
    recapNarration: (name) =>
      `${firstNameOf(name)}, The 1% Club mein aapka swagat. Chaliye, game kaise khelna hai, woh sunte hain.`,
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
      </div>
    ),
  },

  // 1 — 8 SAWAAL — the slam
  {
    key: "eight-sawaal",
    at: 3.0,
    tone: "gold",
    eyebrow: "The count",
    recapNarration: () =>
      `Poora game aath sawaalon ka hai — ek ke baad ek, bilkul seedhi line mein.`,
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
    recapNarration: () =>
      `Har sawaal ke saath ek percentage hota hai — India mein kitne log usse crack kar sakte hain. Number jitna chhota, sawaal utna tough.`,
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
    recapNarration: () =>
      `Nabbe percent wala sawaal matlab warm-up — almost sab andar hain, pressure abhi halka hai.`,
    render: () => (
      <div className="flex items-baseline justify-center gap-6 md:gap-10">
        {/* Wrapper holds only the soft depth shadow — gradient text stays inner so
            we avoid the vertical “streak” GPU artifact from filter + clip on one node. */}
        <motion.span
          initial={{ scale: 1.5, opacity: 0, filter: "blur(14px)" }}
          animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.6, ease: EASE_SLAM }}
          className="inline-flex shrink-0 items-baseline font-bold tabular-nums leading-[0.82]"
          style={{ filter: "drop-shadow(0 16px 36px rgba(0,0,0,0.5))" }}
          aria-label="90 percent"
        >
          <span
            style={{
              fontSize: "clamp(8rem, 26vw, 22rem)",
              background: BRASS_TEXT_STRONG,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            90
          </span>
          <span
            className="translate-y-[0.04em]"
            style={{
              fontSize: "clamp(6.1rem, 19.5vw, 16.8rem)",
              background: BRASS_TEXT_STRONG,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
            aria-hidden
          >
            %
          </span>
        </motion.span>
        <motion.div
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, delay: 0.3, ease: EASE }}
          className="flex min-w-0 max-w-[min(42vw,320px)] flex-col items-start gap-1 md:max-w-[360px] md:gap-2"
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
    recapNarration: () =>
      `Aakhri stop sirf ek percent ka — yahan sirf waqai smartest bachte hain. Yahi hai asli club.`,
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
    recapNarration: () =>
      `Har sawaal par ghadi chalegi — time khatam, toh chance khatam. Hesitation ko galat maaniye.`,
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
    recapNarration: () =>
      `Aapke paas teen cheezein: logic, reasoning, aur instinct. Koi lifeline nahi, koi audience poll nahi.`,
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
    recapNarration: (name) =>
      `Sab samajh aa gaya, ${firstNameOf(name)}? Jab aap bolenge ready, tab hum shuru karenge.`,
    render: (_name) => (
      <div className="flex flex-col items-center gap-5 md:gap-7 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 22, scale: 1.06, filter: "blur(12px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.75, ease: EASE_SLAM }}
          className="font-bold leading-[0.95]"
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
          <span className="block">Are you</span>
          <span className="block">ready?</span>
        </motion.h2>
      </div>
    ),
  },
];

/* ──────────────────────────────────────────────────────────────
 * Scene decoration pieces
 * ────────────────────────────────────────────────────────────── */

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

/** Corner HUD — skip only (chapter progress lives in the bottom rail). */
function HUD({
  tone,
  onSkip,
  showSkip,
}: {
  tone: "gold" | "red";
  onSkip: () => void;
  showSkip: boolean;
}) {
  const accentDim = tone === "red" ? "#c9522e" : "#c9a94a";
  if (!showSkip) return null;
  return (
    <div className="absolute right-5 top-5 z-[20] md:right-8 md:top-7">
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
    </div>
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
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-[19] flex justify-center px-3 pb-2 md:px-8 md:pb-4">
      <div className="flex w-full max-w-[720px] items-stretch gap-0.5 md:gap-1 pt-3">
        {Array.from({ length: total }).map((_, i) => {
          const done = i < sceneIdx;
          const current = i === sceneIdx;
          const label = labels[i] ?? `Step ${i + 1}`;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onJumpTo(i)}
              className="group relative flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-end gap-1.5 rounded-sm py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c4a035]/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04020a]"
              aria-label={`Jump to chapter ${i + 1}: ${label}. Hear this section again.`}
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

const HOWITWORKS_VO_SRC = "/sound/howitworks1percentclub.mp3";

export default function Instructions({ playerName, onStart }: InstructionsProps) {
  const { narrate, narrateUrl, stop } = useNarration();
  const [sceneIdx, setSceneIdx] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountRef = useRef(0);
  /** Full how-it-works MP3 has been started (or suppressed via chapter jump). */
  const howItWorksVoDoneRef = useRef(false);
  const greetingVoDoneRef = useRef(false);

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
      if (clamped === 0) {
        howItWorksVoDoneRef.current = false;
      } else {
        // Chapter rail: short recap only, not the full VO from the top.
        howItWorksVoDoneRef.current = true;
      }
      setSceneIdx(clamped);
      scheduleFromScene(clamped);
      stop();
      const scene = SCENES[clamped];
      void narrate(`instructions-recap-${scene.key}`, scene.recapNarration(playerName));
    },
    [scheduleFromScene, stop, narrate, playerName],
  );

  useEffect(() => {
    let cancelled = false;
    clearAllTimers();
    setSceneIdx(0);
    mountRef.current = Date.now();
    howItWorksVoDoneRef.current = false;
    greetingVoDoneRef.current = false;

    // Gate the auto-timeline: do NOT advance to slide 2 until the greeting finishes
    // (or is muted/blocked and resolves immediately).
    const playGreetingThenStartTimeline = async () => {
      try {
        const src = `/api/greeting-tts?name=${encodeURIComponent(playerName)}`;
        await narrateUrl("instructions-greeting", src);
      } finally {
        if (cancelled) return;
        greetingVoDoneRef.current = true;
        // Start the scene timing *after* the greeting completes so scene 1 doesn't arrive early.
        mountRef.current = Date.now();
        scheduleFromScene(0);
      }
    };

    void playGreetingThenStartTimeline();

    return () => {
      cancelled = true;
      stop();
      clearAllTimers();
    };
  }, [playerName, narrateUrl, stop, scheduleFromScene, clearAllTimers]);

  // Full how-it-works VO starts when the second slide (index 1) is shown on the auto timeline.
  useEffect(() => {
    if (sceneIdx < 1) return;
    if (howItWorksVoDoneRef.current) return;
    howItWorksVoDoneRef.current = true;
    void narrateUrl("instructions-howitworks", HOWITWORKS_VO_SRC);
  }, [sceneIdx, narrateUrl]);

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
      className="absolute inset-0 z-10 flex min-h-full w-full flex-col overflow-hidden font-[Arial,Helvetica,sans-serif] text-[#ebe4d8] antialiased"
      style={{ backgroundColor: "#04020a" }}
    >
      {/* Solid black stage + warm centre bloom + edge vignette (no photo BG). */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 70% at 50% 58%, rgba(16,10,4,0.92) 0%, rgba(6,3,2,0.98) 60%, #020002 100%), radial-gradient(ellipse 140% 120% at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.085] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />

      {/* Mute (handled by MuteButton — already fixed-positioned) */}
      <MuteButton />

      {/* Corner HUD */}
      <HUD tone={scene.tone} onSkip={handleSkip} showSkip={!isFinal} />

      {/* THE STAGE — cross-fade (Arial-only section; rest of app keeps brand fonts).
          Bottom padding keeps copy clear of the chapter rail + voice chrome; overflow-hidden
          was clipping tall scenes (e.g. 90%) when vertically centered in the full viewport. */}
      <div className="relative z-[10] flex h-full min-h-0 w-full items-center justify-center px-6 py-8 pb-[clamp(5.5rem,14vh,10rem)] pt-10 md:px-14 md:pb-[clamp(6rem,16vh,11rem)] md:pt-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={scene.key}
            initial={{ opacity: 0, filter: "blur(14px)", x: -8 }}
            animate={{ opacity: 1, filter: "blur(0px)", x: 0 }}
            exit={{ opacity: 0, filter: "blur(10px)", x: 6 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="relative flex w-full max-w-[1280px] items-center justify-center"
          >
            {scene.render(playerName)}
          </motion.div>
        </AnimatePresence>
      </div>

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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

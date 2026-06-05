"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { Play, Pause } from "lucide-react";
import type { Question } from "./QuizGame";
import { formatRupees } from "./QuizGame";
import { useNarration } from "./NarrationProvider";

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

/** Last N seconds on the clock — one tick sound per second (WAV may ring slightly past 1s). */
const TIMER_TICK_LAST_SECONDS = 10;
/** Fire `onTimerVoCue` when remaining time hits this (3s before tick strip). */
const TIMER_VO_CUE_AT_REMAINING = TIMER_TICK_LAST_SECONDS + 3;
const TIMER_TICK_SRC = encodeURI("/sound/450509__abyeditsound__clockticksound_01.wav");

interface QuestionScreenProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  potPrize: number;
  remainingPlayers: number;
  totalPlayers: number;
  playerName: string;
  onAnswer: (index: number, typedAnswer?: string) => void | Promise<void>;
  onTimeUp: () => void;
  /** When ~3s remain before the last-10s tick SFX (13s left on a full round). */
  onTimerVoCue?: () => void;
  /** Notifies when async text/number validation is in progress (stops parent timer SFX). */
  onAnswerValidationPendingChange?: (pending: boolean) => void;
  /** True once the player has locked an answer (or time ran out): inputs
   *  disabled, local timer stops. Does NOT reveal correctness on its own. */
  answered: boolean;
  /** True only when correctness should be shown to everyone simultaneously
   *  (server flipped the round to "revealing"). Drives the green/red rim,
   *  the feedback banner and the reveal SFX. In the solo flow this tracks
   *  `answered` so behaviour is unchanged. Defaults to `answered` when
   *  omitted. */
  revealed?: boolean;
  selectedAnswer: number | null;
  isCorrect: boolean;
  paused?: boolean;
  /** Overlay rendered inside the screen frame (e.g. after-round elimination reveal). */
  afterRoundOverlay?: ReactNode;
}

const OPTION_LABELS = ["A", "B", "C", "D"];

/**
 * Drifting brass sparkle field across the stage. Adds ambient motion so the
 * question screen feels like a live broadcast rather than a static panel.
 *
 * Each particle is a CSS-only div animated with framer-motion — no canvas,
 * no JS-per-frame work after mount. Particle positions and timings are
 * deterministic so React doesn't re-render the array on prop changes.
 *
 * pointer-events-none + low opacity, so it never competes with the
 * question or option tiles for attention.
 */
const SPARKLE_COUNT = 28;
const SPARKLE_SEEDS = Array.from({ length: SPARKLE_COUNT }, (_, i) => {
  // Cheap deterministic pseudo-random so we don't re-roll on rerender.
  const r = (n: number) => {
    const x = Math.sin((i + 1) * n) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    x: r(11.3) * 100,            // % across the viewport
    yStart: 12 + r(17.7) * 76,   // % vertical baseline
    drift: 30 + r(23.1) * 70,    // vertical drift distance in px
    size: 1.5 + r(31.9) * 2.5,   // px diameter
    duration: 4 + r(41.3) * 5,   // seconds per cycle
    delay: r(53.7) * 5,          // seconds offset
    hue: r(67.7) > 0.7 ? "#fff4cf" : "#e6c45a", // mostly brass, a few hot whites
  };
});

function AmbientSparkles() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden" aria-hidden>
      {SPARKLE_SEEDS.map((s, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${s.x}%`,
            top: `${s.yStart}%`,
            width: s.size,
            height: s.size,
            background: s.hue,
            boxShadow: `0 0 ${s.size * 4}px ${s.size * 0.6}px ${s.hue}`,
            mixBlendMode: "screen",
          }}
          initial={{ opacity: 0, y: 0 }}
          animate={{
            opacity: [0, 0.85, 0.6, 0],
            y: [0, -s.drift],
          }}
          transition={{
            duration: s.duration,
            delay: s.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/**
 * StageSpotlightBeams
 * ─────────────────────────────────────────────────────────────────
 * Three angled spotlight cones swinging across the stage from above —
 * the visual equivalent of a TV game show rig sweeping the audience.
 * Each beam is a single CSS gradient inside a wide `<div>` rotated to
 * the right angle, with `mix-blend-mode: screen` so it adds light
 * without dimming. Animation oscillates `rotate` ± a few degrees so
 * the beams sway slowly. Cheap — no per-frame JS, just CSS transforms.
 */
function StageSpotlightBeams() {
  const beams = [
    { x: 22, hue: "rgba(255, 200, 110, 0.22)", duration: 7.4, delay: 0, swing: 6 },
    { x: 50, hue: "rgba(255, 240, 180, 0.18)", duration: 9.2, delay: 1.3, swing: 4 },
    { x: 78, hue: "rgba(180, 130, 255, 0.18)", duration: 8.1, delay: 2.6, swing: 7 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden" aria-hidden>
      {beams.map((b, i) => (
        <motion.div
          key={i}
          className="absolute origin-top"
          style={{
            top: "-10%",
            left: `${b.x}%`,
            width: 360,
            height: "140vh",
            marginLeft: -180,
            background: `linear-gradient(180deg, ${b.hue} 0%, ${b.hue.replace(/[\d.]+\)$/, "0.05)")} 60%, transparent 100%)`,
            filter: "blur(28px)",
            mixBlendMode: "screen",
          }}
          animate={{
            rotate: [-b.swing, b.swing, -b.swing],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: b.duration,
            delay: b.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/**
 * RotatingHaloRing
 * ─────────────────────────────────────────────────────────────────
 * A massive conic-gradient ring rotating slowly behind the question
 * frame. Reads as a "live" backdrop without competing with the UI.
 * One element, one CSS animation — extremely cheap.
 */
function RotatingHaloRing() {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2"
      style={{
        width: "min(120vh, 1100px)",
        height: "min(120vh, 1100px)",
        background:
          "conic-gradient(from 0deg, rgba(245,180,80,0.18), rgba(140,80,210,0.14), rgba(255,90,120,0.18), rgba(80,160,255,0.16), rgba(245,180,80,0.18))",
        filter: "blur(60px)",
        mixBlendMode: "screen",
        opacity: 0.55,
      }}
      animate={{ rotate: [0, 360] }}
      transition={{ duration: 38, ease: "linear", repeat: Infinity }}
    />
  );
}

/**
 * StrobeFlashes
 * ─────────────────────────────────────────────────────────────────
 * Periodic camera-flash bursts simulating photographers + paparazzi
 * around the stage. Each burst is a single full-screen white flash
 * that fades over ~150 ms. Random per-burst position + colour so the
 * stage feels lived-in, never repetitive.
 */
function StrobeFlashes() {
  const [flashes, setFlashes] = useState<
    Array<{ id: number; x: number; y: number; hue: string }>
  >([]);
  const idRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const fire = () => {
      if (cancelled) return;
      const id = idRef.current++;
      const x = Math.random() * 100;
      const y = 5 + Math.random() * 40; // upper half — feels like rig lights
      const hue =
        Math.random() < 0.7
          ? "rgba(255,255,250,0.85)"
          : Math.random() < 0.5
            ? "rgba(180,130,255,0.7)"
            : "rgba(255,160,90,0.8)";
      setFlashes((prev) => [...prev, { id, x, y, hue }]);
      window.setTimeout(() => {
        setFlashes((prev) => prev.filter((f) => f.id !== id));
      }, 240);
      // Next flash in 1.4–3.6 s
      window.setTimeout(fire, 1400 + Math.random() * 2200);
    };
    const initial = window.setTimeout(fire, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
    };
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[2] overflow-hidden"
      aria-hidden
    >
      {flashes.map((f) => (
        <motion.div
          key={f.id}
          className="absolute rounded-full"
          style={{
            left: `${f.x}%`,
            top: `${f.y}%`,
            width: 280,
            height: 280,
            marginLeft: -140,
            marginTop: -140,
            background: `radial-gradient(circle, ${f.hue} 0%, transparent 65%)`,
            mixBlendMode: "screen",
            filter: "blur(10px)",
          }}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 0], scale: [0.4, 1.1, 1.3] }}
          transition={{ duration: 0.24, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

/**
 * LaserSweeps
 * ─────────────────────────────────────────────────────────────────
 * Two thin neon laser beams traveling horizontally across the stage on
 * staggered loops. Mimics arena concert / TV-show laser rigs. Single
 * gradient div per beam, animating only `x` — extremely cheap.
 */
function LaserSweeps() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[2] overflow-hidden"
      aria-hidden
    >
      <motion.div
        className="absolute h-[2px]"
        style={{
          top: "32%",
          left: 0,
          width: "100%",
          background:
            "linear-gradient(90deg, transparent 0%, transparent 30%, rgba(120,220,255,0.85) 50%, transparent 70%, transparent 100%)",
          filter: "blur(1.5px) drop-shadow(0 0 8px rgba(120,220,255,0.7))",
          mixBlendMode: "screen",
        }}
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 5.2, ease: "easeInOut", repeat: Infinity, repeatDelay: 2.8 }}
      />
      <motion.div
        className="absolute h-[2px]"
        style={{
          top: "68%",
          left: 0,
          width: "100%",
          background:
            "linear-gradient(90deg, transparent 0%, transparent 30%, rgba(255,120,200,0.8) 50%, transparent 70%, transparent 100%)",
          filter: "blur(1.5px) drop-shadow(0 0 8px rgba(255,120,200,0.6))",
          mixBlendMode: "screen",
        }}
        animate={{ x: ["100%", "-100%"] }}
        transition={{ duration: 6.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1.9, delay: 2.4 }}
      />
    </div>
  );
}

/**
 * AuroraHueWash
 * ─────────────────────────────────────────────────────────────────
 * Slow-moving radial gradient that cycles between brass / violet /
 * crimson tints across the bottom half of the stage. Sits at very low
 * opacity so it reads as ambient color shift rather than a UI element.
 * Single element animating only `background-position` + `filter: hue-rotate`
 * — no layout, no DOM churn.
 */
function AuroraHueWash() {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1]"
      style={{
        background:
          "radial-gradient(ellipse 100% 60% at 30% 80%, rgba(245,180,80,0.18) 0%, transparent 60%), radial-gradient(ellipse 90% 55% at 75% 75%, rgba(140,80,210,0.14) 0%, transparent 65%), radial-gradient(ellipse 70% 50% at 50% 100%, rgba(220,90,120,0.12) 0%, transparent 60%)",
        mixBlendMode: "screen",
      }}
      animate={{
        filter: [
          "hue-rotate(0deg) saturate(1.05)",
          "hue-rotate(20deg) saturate(1.15)",
          "hue-rotate(-12deg) saturate(1.05)",
          "hue-rotate(0deg) saturate(1.05)",
        ],
      }}
      transition={{ duration: 10, ease: "easeInOut", repeat: Infinity }}
    />
  );
}

/** Skip bottom caption when it only repeats the corner letter (e.g. Q4 "A"/"B"/"C"). */
function isRedundantLetterCaption(caption: string, optionIndex: number): boolean {
  const label = OPTION_LABELS[optionIndex];
  if (!label) return false;
  return caption.trim().toUpperCase() === label.toUpperCase();
}

function correctAnswerLabel(q: Question): string {
  if (q.textInput && q.correctAnswerText) return q.correctAnswerText;
  if (q.numberInput && q.correctNumber !== undefined) return String(q.correctNumber);
  return q.options[q.correctIndex] ?? "—";
}

function answerChromeStyles(
  i: number,
  question: Question,
  selected: number | null,
  selectedAnswer: number | null,
  revealed: boolean,
) {
  const isSelected = selected === i || selectedAnswer === i;
  const isCorrectOption = i === question.correctIndex;
  // Green/red correctness only shows on the shared reveal. While a player is
  // locked-and-waiting (revealed === false) their pick keeps the neutral gold
  // "isSelected" rim, so right vs wrong is indistinguishable until reveal.
  const showResult = revealed;
  let rimBg: string = METALLIC_RIM_GRADIENT;
  let glow = `0 0 18px ${GOLD_GLOW}, 0 10px 28px -12px rgba(0,0,0,0.7)`;
  let textColor = GOLD_BRIGHT;
  let innerBg = "rgba(6,4,2,0.92)";

  if (showResult && isCorrectOption) {
    rimBg =
      "linear-gradient(180deg, #b7f7cb 0%, #5ad491 30%, #2a9a63 65%, #0d4d31 100%)";
    glow = "0 0 28px rgba(61,170,122,0.65), 0 10px 28px -12px rgba(0,0,0,0.7)";
    textColor = "#9bf0c0";
  } else if (showResult && isSelected && !isCorrectOption) {
    rimBg =
      "linear-gradient(180deg, #ffb3b3 0%, #f05050 30%, #a82626 65%, #4a0d0d 100%)";
    glow = "0 0 26px rgba(217,74,92,0.55), 0 10px 28px -12px rgba(0,0,0,0.7)";
    textColor = "#ffc0c0";
  } else if (showResult && !isSelected) {
    rimBg =
      "linear-gradient(180deg, rgba(228,207,106,0.28) 0%, rgba(122,90,20,0.25) 100%)";
    glow = "none";
    textColor = "rgba(228,207,106,0.35)";
    innerBg = "rgba(6,4,2,0.72)";
  } else if (isSelected) {
    rimBg =
      "linear-gradient(180deg, #fff4c8 0%, #f9e89a 22%, #d9b446 50%, #a6801f 78%, #6d4e13 100%)";
    glow = `0 0 28px ${GOLD_GLOW}, 0 0 0 2px rgba(255,240,190,0.6), 0 10px 28px -12px rgba(0,0,0,0.7)`;
  }

  return { isSelected, isCorrectOption, showResult, rimBg, glow, textColor, innerBg };
}

// Uniform styling — every option wears the same black fill + metallic gold rim + metallic gold badge.
const GOLD = "#e0a02b";
const GOLD_BRIGHT = "#e4cf6a";
const GOLD_GLOW = "rgba(224,160,43,0.45)";

/** Polished-brass gradient reused as the gold rim on the outer frame, the question panel,
 *  and the option cards. Top is warm-bright (specular highlight), bottom is deep bronze. */
export const METALLIC_RIM_GRADIENT =
  "linear-gradient(180deg, #fff0c2 0%, #f4dc7c 22%, #e6c45a 42%, #b28622 72%, #6d4e13 92%, #3a2708 100%)";

/** Slightly stronger rim for the outer frame (more contrast across the spec highlight). */
const METALLIC_RIM_STRONG =
  "linear-gradient(160deg, #fff4c8 0%, #f9e89a 14%, #d9b446 38%, #a6801f 66%, #6d4e13 86%, #2a1d05 100%)";

/** Dark bronze interior — same fill as `UserDetailsModal` (not a golden metallic wash). */
export const PANEL_INNER_FILL: CSSProperties = {
  background: `
    radial-gradient(ellipse 100% 52% at 50% 44%, rgba(90, 72, 48, 0.38) 0%, transparent 56%),
    linear-gradient(180deg, #070605 0%, #0f0d0a 18%, #181410 38%, #141210 55%, #0a0907 78%, #030302 100%)
  `,
  boxShadow:
    "inset 0 1px 0 rgba(255,245,210,0.08), inset 0 -1px 0 rgba(0,0,0,0.52), inset 0 0 32px rgba(0,0,0,0.48)",
};

// Vertical "journey" ticker — the 10 actual game checkpoints, top (90) to bottom (1).
const JOURNEY = [90, 80, 70, 60, 50, 40, 30, 20, 10, 1];

/** PNG in public/questionscreenimages/ — filenames like `90%.png`, `1%.png` */
function percentImageSrc(pct: number): string {
  return `/questionscreenimages/${encodeURIComponent(`${pct}%.png`)}`;
}

const VB = 100;
const CX = 50;
const CY = 50;
/** Bold bezeled timer — a brass donut with a black trough that fills with liquid gold.
 *   R_CHANNEL   = centerline of the black channel (stroke radius)
 *   CHANNEL_W   = width of the channel (bold ~10% of viewBox diameter)
 *   R_OUTER_RIM = hairline metallic rim sitting just outside the channel (convex — bright top / dark bottom)
 *   R_INNER_RIM = hairline metallic rim sitting just inside the channel  (concave — dark top / bright bottom)
 * The gold arc is drawn on top of the black trough and grows clockwise from 12. */
const R_CHANNEL = 37;
const CHANNEL_W = 10;
const R_OUTER_RIM = R_CHANNEL + CHANNEL_W / 2 + 0.5; // 42.5
const R_INNER_RIM = R_CHANNEL - CHANNEL_W / 2 - 0.5; // 31.5
const CIRC_CHANNEL = 2 * Math.PI * R_CHANNEL;

interface PercentTimerDockProps {
  timeLeft: number;
  timeLimit: number;
  /** True when the host has paused the timer mid-question. Renders the
   *  play button as the active action and shows a subtle "PAUSED" label. */
  timerPaused: boolean;
  /** Toggle handler bound to the play / pause buttons (and to the spacebar
   *  shortcut handled at the QuestionScreen root). */
  onTogglePause: () => void;
  /** Disable the pause/play controls when the question is already answered or
   *  while the host narration is playing — pausing wouldn't be meaningful then. */
  controlsDisabled: boolean;
}

function PercentTimerDock({
  timeLeft,
  timeLimit,
  timerPaused,
  onTogglePause,
  controlsDisabled,
}: PercentTimerDockProps) {
  /** Elapsed fraction: ring fills from 0 → full circumference as time runs out */
  const elapsed =
    timeLimit > 0 ? Math.max(0, Math.min(1, 1 - timeLeft / timeLimit)) : 0;
  const arcVisible = CIRC_CHANNEL * elapsed;
  const almostFull = elapsed > 0.75;

  return (
    // Outer wrapper accepts pointer events so the play/pause buttons inside
    // are clickable (was pointer-events-none on the original spec dock; the
    // SVG ring + countdown stay aria-hidden via the inner container).
    <div
      className="fixed bottom-4 left-3 z-20 md:bottom-6 md:left-6 select-none flex flex-col items-center gap-2 md:gap-3"
      data-tour-id="timer"
    >
      <div
        className="pointer-events-none relative h-[150px] w-[150px] md:h-[176px] md:w-[176px] amb-spot-flicker"
        aria-hidden
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${VB} ${VB}`}
          fill="none"
          overflow="visible"
          style={{ overflow: "visible" }}
          aria-hidden
        >
          <defs>
            {/* Brass fill — vertical gradient with a bright specular band near centre. */}
            <linearGradient id="qs-timer-brass" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#6d4e13" />
              <stop offset="10%" stopColor="#a6801f" />
              <stop offset="28%" stopColor="#d9b446" />
              <stop offset="46%" stopColor="#f4dc7c" />
              <stop offset="52%" stopColor="#f9e89a" />
              <stop offset="62%" stopColor="#e4c55a" />
              <stop offset="82%" stopColor="#b28622" />
              <stop offset="100%" stopColor="#6d4e13" />
            </linearGradient>
            {/* Outer rim — bright top, dark bottom → reads as a CONVEX metal lip. */}
            <linearGradient id="qs-timer-rim-outer" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fff0c2" />
              <stop offset="35%" stopColor="#e6c45a" />
              <stop offset="75%" stopColor="#9b7520" />
              <stop offset="100%" stopColor="#4e350a" />
            </linearGradient>
            {/* Inner rim — dark top, bright bottom → reads as a CONCAVE inner edge catching bounced light. */}
            <linearGradient id="qs-timer-rim-inner" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4e350a" />
              <stop offset="25%" stopColor="#7a5816" />
              <stop offset="65%" stopColor="#d9b446" />
              <stop offset="100%" stopColor="#f7e092" />
            </linearGradient>
            {/* Deep black trough — vertical gradient hints at a recessed channel. */}
            <linearGradient id="qs-timer-trough" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#000000" />
              <stop offset="50%" stopColor="#0a0805" />
              <stop offset="100%" stopColor="#030200" />
            </linearGradient>
          </defs>

          {/* 1. Black trough — full ring, solid black. This is the "empty" state. */}
          <circle
            cx={CX}
            cy={CY}
            r={R_CHANNEL}
            stroke="url(#qs-timer-trough)"
            strokeWidth={CHANNEL_W}
            vectorEffect="nonScalingStroke"
          />

          {/* 2. Brass fill — pours into the trough clockwise from 12 o'clock.
               strokeLinecap="butt" avoids the fill overshooting the start cap at 0%
               and creates a clean leading edge as it grows. */}
          <circle
            cx={CX}
            cy={CY}
            r={R_CHANNEL}
            stroke="url(#qs-timer-brass)"
            strokeWidth={CHANNEL_W}
            strokeLinecap="butt"
            strokeDasharray={`${arcVisible} ${CIRC_CHANNEL}`}
            transform={`rotate(-90 ${CX} ${CY})`}
            vectorEffect="nonScalingStroke"
            style={{
              transition: "stroke-dasharray 1s linear",
              // Keep glow minimal so it reads as a polished metal rim and never
              // clips into a visible square at the SVG / viewport boundary.
              filter: almostFull
                ? "drop-shadow(0 0 3px rgba(249, 232, 154, 0.45))"
                : "drop-shadow(0 0 1.5px rgba(244, 220, 124, 0.32))",
            }}
          />

          {/* 3. Outer metallic rim — hairline brass border on the outside of the channel. */}
          <circle
            cx={CX}
            cy={CY}
            r={R_OUTER_RIM}
            stroke="url(#qs-timer-rim-outer)"
            strokeWidth={1.3}
            vectorEffect="nonScalingStroke"
          />

          {/* 4. Inner metallic rim — hairline brass border on the inside of the channel. */}
          <circle
            cx={CX}
            cy={CY}
            r={R_INNER_RIM}
            stroke="url(#qs-timer-rim-inner)"
            strokeWidth={1.3}
            vectorEffect="nonScalingStroke"
          />

          {/* 5. Inner shadow — subtle darken just inside the inner rim, sells the
                recessed-disc feel without needing an inset filter. */}
          <circle
            cx={CX}
            cy={CY}
            r={R_INNER_RIM - 0.8}
            stroke="rgba(0,0,0,0.55)"
            strokeWidth={0.6}
            vectorEffect="nonScalingStroke"
          />
        </svg>

        {/* Blur disc + live countdown — number followed by an inline "s".
            The number uses the same metallic gold gradient as the journey
            progress chip so the timer reads as part of the same UI language. */}
        <div
          className="absolute left-1/2 top-1/2 flex h-[60%] w-[60%] -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full bg-black/65 shadow-[inset_0_0_32px_rgba(0,0,0,0.7)] backdrop-blur-md"
          style={{ WebkitBackdropFilter: "blur(16px)" }}
        >
          <motion.span
            className="font-display font-bold tabular-nums leading-none select-none flex items-baseline"
            style={{
              // Reduced ~35% from the original (clamp 40-64px → clamp 26-42px)
              // so the play/pause control row below has room to breathe without
              // pushing the dock off the bottom edge of the viewport.
              fontSize: "clamp(26px, 6vmin, 42px)",
              backgroundImage:
                "linear-gradient(180deg, #fff0c2 0%, #f9e89a 26%, #e4c55a 52%, #b28622 82%, #6d4e13 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
              filter:
                "drop-shadow(0 2px 8px rgba(0,0,0,0.7)) drop-shadow(0 0 14px rgba(228,207,106,0.45))",
            }}
            // Subtle pulse while paused so the dock visually communicates the
            // paused state without needing extra chrome. No effect on layout.
            animate={timerPaused ? { opacity: [1, 0.55, 1] } : { opacity: 1 }}
            transition={
              timerPaused
                ? { duration: 1.4, ease: "easeInOut", repeat: Infinity }
                : { duration: 0.2 }
            }
          >
            {Math.max(0, Math.ceil(timeLeft))}
            <span style={{ fontSize: "0.5em", marginLeft: "0.06em" }}>s</span>
          </motion.span>
        </div>
      </div>

      {/* ━━ Play / Pause control row — sits directly below the timer ring.
              Buttons are circular ~40px brass discs matching the rest of the
              UI's metallic language. The button representing the action you
              CAN take (pause when running, play when paused) is highlighted;
              the other is dimmed. Disabled outright when the question is
              already answered or the host narration is still in flight. ━━ */}
      <div
        className="pointer-events-auto flex items-center gap-2 md:gap-2.5"
        role="group"
        aria-label="Timer controls"
      >
        <TimerControlButton
          icon="play"
          label="Resume timer"
          active={timerPaused}
          onClick={onTogglePause}
          disabled={controlsDisabled || !timerPaused}
        />
        <TimerControlButton
          icon="pause"
          label="Pause timer"
          active={!timerPaused}
          onClick={onTogglePause}
          disabled={controlsDisabled || timerPaused}
        />
      </div>

      {/* Tiny "PAUSED" label — only when paused. Mono caps to match the rest
          of the brass enamel labels. Reserved space (h-3) when not paused so
          adding/removing it doesn't reflow the dock. */}
      <div className="h-3 flex items-center">
        {timerPaused && (
          <span
            className="font-mono text-[9px] uppercase tracking-[0.32em] font-bold pointer-events-none"
            style={{
              color: "#f4dc7c",
              textShadow:
                "0 1px 0 rgba(20,10,0,0.7), 0 0 8px rgba(228,174,68,0.5)",
            }}
          >
            Paused
          </span>
        )}
      </div>
    </div>
  );
}

interface TimerControlButtonProps {
  icon: "play" | "pause";
  label: string;
  /** Highlighted brass state — this is the action the host can take next. */
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function TimerControlButton({
  icon,
  label,
  active,
  onClick,
  disabled = false,
}: TimerControlButtonProps) {
  const Icon = icon === "play" ? Play : Pause;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`relative h-10 w-10 md:h-11 md:w-11 rounded-full p-[1.5px] overflow-hidden transition-all duration-200 ${
        disabled ? "cursor-not-allowed" : "cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
      } ${active && !disabled ? "amb-glow-pulse" : ""}`}
      style={{
        background: active && !disabled ? METALLIC_RIM_STRONG : METALLIC_RIM_GRADIENT,
        boxShadow:
          active && !disabled
            ? "0 0 18px rgba(228,207,106,0.55), 0 6px 14px -4px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.55)"
            : "0 4px 10px -4px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.55)",
        opacity: disabled ? 0.42 : 1,
        filter: disabled ? "saturate(0.45) brightness(0.85)" : undefined,
      }}
    >
      <span
        className="relative w-full h-full rounded-full flex items-center justify-center"
        style={{
          background: "rgba(8,5,2,0.9)",
          boxShadow:
            "inset 0 1px 0 rgba(255,245,210,0.08), inset 0 -1px 0 rgba(0,0,0,0.55), inset 0 0 14px rgba(0,0,0,0.45)",
        }}
      >
        <Icon
          // lucide icons inherit text color via currentColor; using brass
          // when active, dimmed brass otherwise.
          color={active && !disabled ? "#f9e89a" : "#a6801f"}
          fill={active && !disabled ? "#f9e89a" : "none"}
          strokeWidth={2}
          size={icon === "play" ? 16 : 15}
          // The Play glyph is rendered visually right-of-center because of
          // its triangle shape. A 0.5px nudge corrects that without breaking
          // the Pause icon's symmetry.
          style={{ marginLeft: icon === "play" ? "1px" : 0 }}
        />
      </span>
    </button>
  );
}

function IconPot({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3v2M7 5h10l-1 3H8L7 5zM6 9h12l-1 11H7L6 9z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPlayers({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 21v-1a5 5 0 0110 0v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="17" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 21v-1a3.5 3.5 0 017 0v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function QuestionScreen({
  question,
  questionNumber,
  totalQuestions,
  potPrize,
  remainingPlayers,
  totalPlayers,
  playerName,
  onAnswer,
  onTimeUp,
  onTimerVoCue,
  onAnswerValidationPendingChange,
  answered,
  revealed: revealedProp,
  selectedAnswer,
  isCorrect,
  paused = false,
  afterRoundOverlay,
}: QuestionScreenProps) {
  // In the solo flow `revealed` is omitted, so correctness shows the moment
  // the answer is locked (revealed tracks answered). In the live flow the
  // parent passes `revealed` explicitly so the green/red reveal is held until
  // the server flips the whole room to "revealing".
  const revealed = revealedProp ?? answered;
  /** Player has locked an answer but the shared reveal hasn't happened yet. */
  const awaitingReveal = answered && !revealed;
  const isThreeImageOptions =
    question.imagesAreOptions === true &&
    question.images?.length === 3 &&
    !question.compactImageRow;

  const [timeLeft, setTimeLeft] = useState(question.timeLimit);
  const [selected, setSelected] = useState<number | null>(null);
  const [textInputValue, setTextInputValue] = useState("");
  const [numberInputValue, setNumberInputValue] = useState("");
  const [answerChecking, setAnswerChecking] = useState(false);
  /** Host-controlled timer pause. Lives in QuestionScreen because the
   *  component is keyed on currentQuestion in QuizGame, so it auto-resets
   *  to false on every new question (matching the spec's "always reset to
   *  playing on new question load" requirement). When true, the tick effect
   *  bails, all answer surfaces lock, and the timer SFX/VO cue freeze. */
  const [timerPaused, setTimerPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasCalledTimeUp = useRef(false);
  const tickAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerVoCueFiredRef = useRef(false);
  const { muted: narrationMuted } = useNarration();

  /** Effective lock-out used by every answer surface. Combines the existing
   *  `paused` (host narration / tour) with the new `timerPaused` (host pause
   *  control). Anywhere `paused` was checked before, `inputsLocked` now goes. */
  const inputsLocked = paused || timerPaused;

  const togglePause = useCallback(() => {
    // No-op while the host is still narrating, after the answer is locked in,
    // or while the API call is in flight. Matches the controlsDisabled gate
    // on the pause/play buttons themselves.
    if (paused || answered || answerChecking) return;
    setTimerPaused((p) => !p);
  }, [paused, answered, answerChecking]);

  // Spacebar shortcut for pause/resume. Ignored when focus is inside an
  // editable element so typing answers (Q1 "the", Q4 "name", etc.) isn't
  // hijacked. Also ignored on repeat events so holding spacebar doesn't
  // toggle rapidly. And ignored while host narration is still playing —
  // pause/play has no meaning before the timer actually starts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code !== "Space" && e.key !== " ") return;
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      if (paused || answered || answerChecking) return;
      e.preventDefault();
      setTimerPaused((p) => !p);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused, answered, answerChecking]);

  // ── Cursor-driven 3D tilt on the question board ───────────────
  // Adds depth without changing colors or visuals — the board lifts off
  // the page and follows the cursor with a 1.5° max rotation on each
  // axis. Springs smooth the values so it never feels jittery. The
  // transform is applied via motion values to avoid React re-renders
  // on every mousemove (60fps DOM reads/writes only).
  const boardRef = useRef<HTMLDivElement>(null);
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const springTiltX = useSpring(tiltX, { stiffness: 90, damping: 22, mass: 0.6 });
  const springTiltY = useSpring(tiltY, { stiffness: 90, damping: 22, mass: 0.6 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = boardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const dx = (e.clientX - cx) / (vw / 2);
      const dy = (e.clientY - cy) / (vh / 2);
      tiltY.set(Math.max(-1, Math.min(1, dx)) * 1.5);
      tiltX.set(Math.max(-1, Math.min(1, dy)) * -1.5);
    };
    const onLeave = () => {
      tiltX.set(0);
      tiltY.set(0);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, [tiltX, tiltY]);

  useEffect(() => {
    timerVoCueFiredRef.current = false;
  }, [questionNumber, question.id]);

  useEffect(() => {
    onAnswerValidationPendingChange?.(answerChecking);
  }, [answerChecking, onAnswerValidationPendingChange]);

  useEffect(() => {
    return () => {
      onAnswerValidationPendingChange?.(false);
    };
  }, [onAnswerValidationPendingChange]);

  useEffect(() => {
    if (!onTimerVoCue) return;
    if (answered || paused || timerPaused || answerChecking) return;
    if (question.timeLimit < TIMER_VO_CUE_AT_REMAINING) return;
    if (timeLeft !== TIMER_VO_CUE_AT_REMAINING) return;
    if (timerVoCueFiredRef.current) return;
    timerVoCueFiredRef.current = true;
    onTimerVoCue();
  }, [timeLeft, answered, paused, timerPaused, answerChecking, onTimerVoCue, question.timeLimit, question.id]);

  const stopTickSound = useCallback(() => {
    const a = tickAudioRef.current;
    if (a) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {}
      tickAudioRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (narrationMuted || answered || paused || timerPaused || answerChecking) {
      stopTickSound();
      return;
    }
    if (timeLeft > TIMER_TICK_LAST_SECONDS || timeLeft < 1) {
      stopTickSound();
      return;
    }
    stopTickSound();
    const a = new Audio(TIMER_TICK_SRC);
    tickAudioRef.current = a;
    a.volume = 0.48;
    void a.play().catch(() => {});
    return () => {
      stopTickSound();
    };
  }, [timeLeft, narrationMuted, answered, paused, timerPaused, answerChecking, stopTickSound]);

  useEffect(() => {
    if (answered || paused || timerPaused || answerChecking) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    hasCalledTimeUp.current = false;
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (!hasCalledTimeUp.current) {
            hasCalledTimeUp.current = true;
            onTimeUp();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [answered, onTimeUp, paused, timerPaused, answerChecking]);

  const handleSelect = useCallback(
    (index: number) => {
      if (answered || selected !== null || inputsLocked) return;
      stopTickSound();
      setSelected(index);
      if (intervalRef.current) clearInterval(intervalRef.current);
      onAnswer(index);
    },
    [answered, selected, onAnswer, inputsLocked, stopTickSound],
  );

  const submitTextOrNumber = useCallback(
    async (typed: string) => {
      if (answered || inputsLocked || answerChecking) return;
      const t = typed.trim();
      if (!t) return;
      stopTickSound();
      if (intervalRef.current) clearInterval(intervalRef.current);
      setAnswerChecking(true);
      try {
        await Promise.resolve(onAnswer(0, t));
      } finally {
        setAnswerChecking(false);
      }
    },
    [answered, inputsLocked, answerChecking, onAnswer, stopTickSound],
  );

  const handleTextSubmit = useCallback(() => {
    void submitTextOrNumber(textInputValue);
  }, [submitTextOrNumber, textInputValue]);

  const handleNumberChange = useCallback(
    (raw: string, maxDigits: number) => {
      const digits = raw.replace(/\D/g, "").slice(0, maxDigits);
      setNumberInputValue(digits);
    },
    [],
  );

  const handleNumberSubmit = useCallback(() => {
    void submitTextOrNumber(numberInputValue);
  }, [submitTextOrNumber, numberInputValue]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className="w-full h-full relative overflow-hidden bg-black"
    >
      {/* ━━ Full-bleed stage BG — looping video that plays throughout the journey ━━ */}
      <video
        src={encodeURI("/new videos/bgvideo (1).mp4")}
        poster={encodeURI("/new videos/bgvideo (1).mp4.poster.jpg")}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        aria-hidden
      />
      {/* Violet tonal wash */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 30%, rgba(120,60,180,0.10) 0%, rgba(80,40,140,0.05) 45%, transparent 75%)",
          mixBlendMode: "screen",
        }}
      />

      {/* Warm spotlight wash + ambient sparkles + sweeping stage beams +
          aurora hue wash — the layered "live broadcast" treatment. All are
          pointer-events-none, sit between the BG video and the HUD/content,
          and use mix-blend: screen so they only ADD light to the scene. */}
      <motion.div
        aria-hidden
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 55%, rgba(255,210,120,0.22) 0%, rgba(255,170,60,0.1) 35%, transparent 70%)",
          mixBlendMode: "screen",
        }}
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 4.8, ease: "easeInOut", repeat: Infinity }}
      />
      <AuroraHueWash />
      <RotatingHaloRing />
      <StageSpotlightBeams />
      <LaserSweeps />
      <StrobeFlashes />
      <AmbientSparkles />

      <PercentTimerDock
        timeLeft={timeLeft}
        timeLimit={question.timeLimit}
        timerPaused={timerPaused}
        onTogglePause={togglePause}
        // Lock the pause/play buttons whenever the timer wouldn't actually
        // be running anyway: while the host is still narrating the question
        // (the `paused` prop is true during narration / tour), once an answer
        // has been submitted, or while the semantic-grade API call is in
        // flight. The buttons only light up after AK finishes speaking and
        // the countdown actually starts.
        controlsDisabled={paused || answered || answerChecking}
      />

      {/* ━━ Fullscreen blur backdrop — ONLY when after-round overlay is present.
            Blurs the whole stage (HUD, journey, stage lights, question, options) so
            the elimination modal reads as a focused surface instead of "pasted on".
            z-[25] sits BELOW the after-round overlay (z-[60]) so the reveal paints
            on top of the blur, not behind it. The percent ring timer is z-20 so it
            stays UNDER this layer (it was z-30 and sat above the blur). ━━ */}
      <AnimatePresence>
        {afterRoundOverlay && (
          <motion.div
            key="stage-blur-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
            className="absolute inset-0 z-[25] pointer-events-none"
            style={{
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(16px) saturate(125%)",
              WebkitBackdropFilter: "blur(16px) saturate(125%)",
            }}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* ━━ AFTER-ROUND OVERLAY — rendered at the VIEWPORT ROOT above the blur
            backdrop (z-[60]). Previously it was nested inside the content frame
            (z-10) which sat BELOW the blur, making it disappear behind the haze.
            Wrapped in the metallic-rim language so it matches the rest of the UI. ━━ */}
      <AnimatePresence>
        {afterRoundOverlay && (
          <motion.div
            key="after-round-overlay"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
            className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center px-4 md:px-8"
          >
            <div
              className="pointer-events-auto relative w-full max-w-[920px] max-h-[82vh] rounded-[22px] p-[3px] overflow-hidden"
              style={{
                background: METALLIC_RIM_STRONG,
                boxShadow:
                  "0 0 0 1px rgba(0,0,0,0.75), 0 32px 90px -22px rgba(0,0,0,0.85)",
              }}
            >
              <div
                className="relative w-full max-h-[calc(82vh-6px)] overflow-y-auto rounded-[19px]"
                style={{
                  background: "rgba(4, 3, 2, 0.94)",
                  backdropFilter: "blur(24px) saturate(140%)",
                  WebkitBackdropFilter: "blur(24px) saturate(140%)",
                  boxShadow:
                    "inset 0 0 0 1px rgba(255,235,190,0.08), inset 0 12px 60px rgba(0,0,0,0.55)",
                }}
              >
                {afterRoundOverlay}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━ TOP HUD STRIP — floats above the frame, near the top of the viewport.
            z-index bumped past the elim overlay (z-60) so the navbar pot-prize
            stays visible during the elimination card — required for the
            CoinTrailToNavbar handoff to land on a visible target. ━━ */}
      <div className="absolute top-3 md:top-5 left-0 right-0 z-[70] px-4 md:px-8">
        <div className="max-w-[720px] mx-auto flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: EASE_OUT }}
            className="metallic-chip amb-shine-host amb-glow-pulse flex items-center gap-2.5 rounded-lg px-3 py-1.5"
            data-tour-id="pot-prize"
          >
            <div
              className="relative z-[3] w-8 h-8 rounded-md flex items-center justify-center"
              style={{
                background: "rgba(0,0,0,0.28)",
                border: "1px solid rgba(40,24,0,0.55)",
                color: "#1b1205",
              }}
            >
              <IconPot />
            </div>
            <div className="relative z-[3]">
              <p className="font-mono text-[9px] uppercase tracking-[0.28em] leading-none" style={{ color: "#2a1d05" }}>
                Pot
              </p>
              <p className="font-mono text-sm font-bold tabular-nums leading-none mt-0.5" style={{ color: "#120a02" }}>
                {formatRupees(potPrize)}
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: EASE_OUT }}
            className="metallic-chip amb-shine-host amb-glow-pulse flex items-center gap-2.5 rounded-lg px-3 py-1.5"
            style={{ ["--shine-delay" as string]: "3.5s" }}
          >
            <div className="relative z-[3] text-right">
              <p className="font-mono text-[9px] uppercase tracking-[0.28em] leading-none" style={{ color: "#2a1d05" }}>
                Players
              </p>
              <p className="font-mono text-sm font-bold tabular-nums leading-none mt-0.5" style={{ color: "#120a02" }}>
                {remainingPlayers}
                <span className="text-[10px]" style={{ color: "#3a280a" }}>
                  /{totalPlayers}
                </span>
              </p>
            </div>
            <div
              className="relative z-[3] w-8 h-8 rounded-md flex items-center justify-center"
              style={{
                background: "rgba(0,0,0,0.28)",
                border: "1px solid rgba(40,24,0,0.55)",
                color: "#1b1205",
              }}
            >
              <IconPlayers />
            </div>
          </motion.div>
        </div>
      </div>

      {/* ━━ JOURNEY TICKER — pinned to the RIGHT EDGE, vertically centered.
            IMPORTANT: framer-motion sets `transform: translateX(...)` inline on the
            animated element, which overrides Tailwind's `-translate-y-1/2` utility.
            So the OUTER positioning wrapper (non-motion) does the vertical centering,
            and motion animates opacity/x on an INNER element only. ━━ */}
      <div
        className="pointer-events-none absolute top-1/2 -translate-y-1/2 right-2 md:right-4 z-20"
        aria-label="Your journey from 90% to 1%"
      >
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25, duration: 0.5, ease: EASE_OUT }}
          className="pointer-events-auto relative rounded-xl p-[1.5px] shadow-[0_12px_32px_-10px_rgba(0,0,0,0.75)]"
          style={{ background: METALLIC_RIM_GRADIENT }}
        >
          <div className="relative flex min-h-[min(72vh,640px)] w-[5.25rem] flex-col items-stretch rounded-[10px] bg-black/70 backdrop-blur-md px-2 py-5 sm:w-[5.75rem] md:w-[6.25rem] md:px-3 md:py-6">
            <p
              className="shrink-0 text-center font-mono text-[9px] font-bold uppercase leading-tight sm:text-[10px] md:text-[11px] px-0.5"
              style={{
                color: "#e7cf6a",
                letterSpacing: "0.18em",
                textShadow:
                  "0 1px 0 rgba(20,10,0,0.6), 0 0 10px rgba(228,174,68,0.28)",
              }}
            >
              Journey
            </p>
            <div className="relative flex min-h-0 flex-1 flex-col items-center justify-evenly py-3 md:py-4">
              {JOURNEY.map((pct) => {
                const isCurrent = pct === question.percentage;
                const isReached = pct >= question.percentage;
                if (isCurrent) {
                  return (
                    <motion.div
                      key={pct}
                      initial={{ scale: 0.6 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", bounce: 0.5 }}
                      className="relative flex items-center justify-center"
                    >
                      <div
                        className="absolute -inset-3 rounded-lg blur-xl opacity-90 sm:-inset-3.5"
                        style={{
                          background:
                            "radial-gradient(closest-side, rgba(255,230,150,0.75), rgba(228,190,80,0.35) 55%, transparent 82%)",
                        }}
                      />
                      <div
                        className="metallic-chip relative rounded-lg px-3 py-2 text-sm font-bold tabular-nums leading-none shadow-[0_0_20px_rgba(228,207,106,0.45)] sm:px-3.5 sm:py-2.5 sm:text-base md:px-4 md:py-3 md:text-lg font-display"
                        style={{
                          color: "#1a1105",
                          textShadow:
                            "0 1px 0 rgba(255,236,180,0.55), 0 -1px 0 rgba(36,22,0,0.4)",
                        }}
                      >
                        <span className="relative z-[3]">{pct}%</span>
                      </div>
                    </motion.div>
                  );
                }
                // Non-current rungs: reached = bright brass, not-reached = dim
                // but still legible against the black panel. Added a subtle
                // text-shadow so the numerals pop against dark backgrounds.
                return (
                  <span
                    key={pct}
                    className="font-display text-sm font-bold tabular-nums leading-none transition-colors sm:text-base md:text-lg"
                    style={{
                      color: isReached ? "#f4dc7c" : "rgba(228,207,106,0.62)",
                      textShadow: isReached
                        ? "0 1px 0 rgba(20,10,0,0.75), 0 0 10px rgba(228,174,68,0.38)"
                        : "0 1px 0 rgba(20,10,0,0.75)",
                    }}
                  >
                    {pct}
                  </span>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ━━ Centered content frame — pushed down to clear the 3D logo in the navbar ━━ */}
      <div className="relative z-10 w-full h-full flex items-center justify-center px-4 md:px-8 pt-28 md:pt-36 pb-16 md:pb-20">
        {/* Perspective container — required for the rotateX/rotateY on
            the board below to actually produce a depth illusion. Without
            perspective on a parent, 3D rotations collapse to a flat skew. */}
        <div
          className="relative w-full max-w-[920px]"
          style={{ perspective: "1500px", perspectiveOrigin: "50% 50%" }}
        >


          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              SCREEN FRAME — gold rim; interior matches registration modal
              (dark bronze fill, not golden wash). Enhanced with multi-
              layer drop-shadow elevation + cursor-driven 3D tilt for
              perceived depth (no visual or color change — only z-axis).
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <motion.div
            ref={boardRef}
            className="relative w-full mx-auto rounded-[24px] p-[4px] md:p-[5px] overflow-hidden"
            style={{
              background: METALLIC_RIM_STRONG,
              boxShadow: [
                "0 0 0 1px rgba(0,0,0,0.75)",
                "0 1px 2px rgba(0,0,0,0.45)",
                "0 4px 10px -2px rgba(0,0,0,0.55)",
                "0 12px 28px -6px rgba(0,0,0,0.65)",
                "0 28px 90px -22px rgba(0,0,0,0.78)",
                "0 60px 140px -40px rgba(0,0,0,0.55)",
                "0 0 28px 3px rgba(196,160,53,0.35)",
                "inset 0 1px 0 rgba(255,245,210,0.55)",
                "inset 0 -1px 0 rgba(0,0,0,0.55)",
              ].join(", "),
              minHeight: "min(46vh, 380px)",
              rotateX: springTiltX,
              rotateY: springTiltY,
              transformStyle: "preserve-3d",
              willChange: "transform",
            }}
          >
            <div
              className="relative flex min-h-[inherit] flex-col gap-5 overflow-hidden rounded-[22px] p-5 md:p-7 md:gap-6 backdrop-blur-sm"
              style={PANEL_INNER_FILL}
            >
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
              }}
              aria-hidden
            />

            <div className="relative flex min-h-[inherit] flex-col gap-5 md:gap-6">
              {/* ───────── MAIN BODY — question + options (ticker & HUD moved outside) ───────── */}
              <div className="flex-1 flex flex-col gap-5 md:gap-6 justify-center">

                  {/* Host status chip — metallic brass plate. Dark engraved text + pulsing
                      dark "indicator light" sells the enamel-on-brass feel. Uses the same
                      .metallic-chip treatment as the HUD chips and option badges. */}
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.35, ease: EASE_OUT }}
                    className="flex justify-center"
                  >
                    {paused && !answered ? (
                      <div
                        className="metallic-chip flex items-center gap-2 px-3.5 py-1.5 rounded-full"
                        style={{
                          boxShadow: `0 0 22px ${GOLD_GLOW}, 0 6px 18px rgba(196,160,53,0.3)`,
                        }}
                      >
                        <span className="relative z-[3] flex w-2 h-2">
                          <span
                            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                            style={{ background: "#2a1d05" }}
                          />
                          <span
                            className="relative inline-flex rounded-full h-2 w-2"
                            style={{
                              background: "#120a02",
                              boxShadow: "0 0 4px rgba(255,245,190,0.7)",
                            }}
                          />
                        </span>
                        <span
                          className="relative z-[3] font-mono text-[10px] uppercase tracking-[0.28em] font-bold"
                          style={{
                            color: "#120a02",
                            textShadow:
                              "0 1px 0 rgba(255,236,180,0.55), 0 -1px 0 rgba(36,22,0,0.35)",
                          }}
                        >
                          Host is speaking
                        </span>
                      </div>
                    ) : (
                      <div
                        className="metallic-chip flex items-center gap-2 px-3.5 py-1.5 rounded-full"
                        style={{
                          filter: "saturate(0.55) brightness(0.78)",
                          opacity: 0.88,
                        }}
                      >
                        <span className="relative z-[3] flex w-2 h-2">
                          <span
                            className="inline-flex rounded-full h-2 w-2"
                            style={{ background: "#2a1d05", opacity: 0.55 }}
                          />
                        </span>
                        <span
                          className="relative z-[3] font-mono text-[10px] uppercase tracking-[0.28em] font-bold"
                          style={{
                            color: "#1a1105",
                            textShadow:
                              "0 1px 0 rgba(255,236,180,0.4), 0 -1px 0 rgba(36,22,0,0.3)",
                            opacity: 0.85,
                          }}
                        >
                          Host muted
                        </span>
                      </div>
                    )}
                  </motion.div>

                  {/* ───────── QUESTION PANEL — renders FIRST inside the
                        frame (above any media / word blocks / options). Gold
                        rim + dark bronze fill matches the registration modal. */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25, duration: 0.5, ease: EASE_OUT }}
                    className="relative w-full"
                    data-tour-id="question-area"
                  >
                    <div
                      className="relative w-full rounded-2xl p-[2.5px] overflow-hidden"
                      style={{
                        background: METALLIC_RIM_GRADIENT,
                        boxShadow:
                          "0 0 24px -4px rgba(228,207,106,0.35), 0 12px 32px -14px rgba(0,0,0,0.7)",
                      }}
                    >
                      <div
                        className="relative w-full min-w-0 overflow-hidden rounded-[14px] backdrop-blur-sm"
                        style={PANEL_INNER_FILL}
                      >
                        <div className="absolute top-1.5 left-[14%] right-[14%] h-px bg-gradient-to-r from-transparent via-brass-bright/40 to-transparent" />
                        <div className="absolute bottom-1.5 left-[14%] right-[14%] h-px bg-gradient-to-r from-transparent via-brass/35 to-transparent" />
                        <div className="px-5 md:px-8 py-4 md:py-6 text-center flex items-center justify-center min-h-[84px] md:min-h-[104px]">
                          <p className="text-base md:text-lg lg:text-xl text-foreground font-medium leading-[1.4] tracking-[-0.005em]">
                            {question.question}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* ───────── MEDIA BLOCK — images / row of images / glyph
                        tiles. Renders BELOW the question panel and ABOVE the
                        options. Every variant wears the METALLIC_RIM_GRADIENT
                        border to stay consistent with the rest of the UI. */}
                  {(question.image || question.images || question.labelGlyphs) && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.45, ease: EASE_OUT }}
                      className="relative w-full flex justify-center"
                    >
                      {/* 1a. Single image — not shown here when numberInput+image (see numberInput block) */}
                      {question.image && !question.images && !question.labelGlyphs && !question.numberInput && (
                        <div
                          className="relative rounded-xl p-[2.5px] overflow-hidden"
                          style={{
                            background: METALLIC_RIM_GRADIENT,
                            boxShadow:
                              "0 0 24px -4px rgba(228,207,106,0.35), 0 10px 28px -14px rgba(0,0,0,0.7)",
                          }}
                        >
                          <div className="relative rounded-[10px] bg-black/70 p-2 md:p-3 flex items-center justify-center">
                            <img
                              src={question.image}
                              alt="question media"
                              className="max-h-[180px] md:max-h-[220px] w-auto object-contain rounded-md"
                              draggable={false}
                            />
                          </div>
                        </div>
                      )}

                      {/* 1b. Row of images with optional captions — Q3 (3 Gandhi
                              photos), Q6 (4 transport images). Caption sits
                              under each tile in a small mono label. */}
                      {question.images && (
                        <div
                          className={isThreeImageOptions ? "w-full" : "w-full overflow-x-auto"}
                          data-tour-id={question.imagesAreOptions ? "options-area" : undefined}
                        >
                          <div
                            className={
                              question.compactImageRow
                                ? "flex flex-nowrap items-stretch justify-center gap-2 sm:gap-2.5 w-full min-w-0" +
                                    (question.imagesAreOptions
                                      ? " pt-3.5 pl-2.5 pr-1 sm:pt-4 sm:pl-3 md:pt-4 md:pl-3.5"
                                      : "")
                                : isThreeImageOptions
                                  ? "grid grid-cols-2 md:grid-cols-3 w-full max-w-4xl mx-auto gap-2.5 md:gap-3 items-stretch justify-items-center pt-3.5 px-1 sm:pt-4 sm:px-2"
                                  : "flex flex-nowrap md:flex-wrap items-stretch justify-center gap-2.5 md:gap-3 min-w-max md:min-w-0" +
                                    (question.imagesAreOptions
                                      ? " pt-3.5 pl-2.5 pr-1 sm:pt-4 sm:pl-3 md:pt-4 md:pl-3.5"
                                      : "")
                            }
                          >
                            {question.images.map((src, i) => {
                              if (question.imagesAreOptions) {
                                const { rimBg, glow, innerBg, showResult, isCorrectOption, isSelected } =
                                  answerChromeStyles(i, question, selected, selectedAnswer, revealed);
                                const imgH = question.compactImageRow
                                  ? "h-[92px] sm:h-[108px] md:h-[120px] w-auto max-w-[min(22vw,120px)] md:max-w-[min(20vw,140px)]"
                                  : isThreeImageOptions
                                    // Q2 (Gandhi photos): tall portraits → use
                                    // big boxes so the photos render at usable
                                    // scale.
                                    // Q5 (Squares): the source PNGs are
                                    // landscape canvases with small shapes in
                                    // the middle, so a tall box just leaves
                                    // empty letterboxing top/bottom. Smaller
                                    // boxes hug the actual content.
                                    ? question.id === 5
                                      ? "h-[170px] sm:h-[190px] md:h-[210px] lg:h-[220px] w-full max-w-[min(38vw,260px)] md:max-w-[min(28vw,300px)] object-contain rounded"
                                      : "h-[280px] sm:h-[320px] md:h-[360px] lg:h-[380px] w-full max-w-[min(38vw,260px)] md:max-w-[min(28vw,300px)] object-contain rounded"
                                    : "h-[236px] sm:h-[252px] md:h-[300px] lg:h-[320px] w-auto max-w-[min(34vw,200px)] md:max-w-[min(30vw,280px)]";
                                return (
                                  <motion.button
                                    key={`${src}-${i}`}
                                    type="button"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 + i * 0.06, duration: 0.4, ease: EASE_OUT }}
                                    onClick={() => handleSelect(i)}
                                    disabled={answered || selected !== null || inputsLocked}
                                    className={`relative group border-0 bg-transparent p-0 appearance-none text-left ${
                                      isThreeImageOptions
                                        ? "w-full max-w-[240px] justify-self-center"
                                        : "flex-shrink-0"
                                    } ${
                                      !answered && selected === null && !inputsLocked
                                        ? "cursor-pointer hover:-translate-y-0.5"
                                        : "cursor-not-allowed"
                                    } ${inputsLocked && !answered ? "opacity-60 saturate-50" : ""} transition-transform duration-200`}
                                    style={{
                                      animation:
                                        showResult && isSelected && !isCorrectOption
                                          ? "wrong-shake 0.4s ease-in-out"
                                          : undefined,
                                    }}
                                  >
                                    <div
                                      className="relative rounded-xl p-[2.5px] overflow-hidden"
                                      style={{ background: rimBg, boxShadow: glow }}
                                    >
                                      <div
                                        className="relative rounded-[10px] flex flex-col items-center gap-1.5 p-1.5 md:p-2"
                                        style={{
                                          backgroundColor: innerBg,
                                          boxShadow:
                                            "inset 0 1px 0 rgba(255,245,210,0.06), inset 0 -1px 0 rgba(0,0,0,0.55), inset 0 0 24px rgba(0,0,0,0.45)",
                                        }}
                                      >
                                        <img
                                          src={src}
                                          alt={question.imageCaptions?.[i] ?? `Photo ${i + 1}`}
                                          className={`${imgH} object-contain rounded`}
                                          draggable={false}
                                        />
                                        {question.imageCaptions?.[i] &&
                                          !isRedundantLetterCaption(question.imageCaptions[i], i) && (
                                          <span
                                            className={
                                              isThreeImageOptions
                                                ? "font-mono text-[9px] md:text-[10px] normal-case font-bold tracking-wide px-1.5 py-0.5 rounded"
                                                : "font-mono text-[9px] md:text-[10px] uppercase tracking-[0.25em] font-bold px-1.5 py-0.5 rounded"
                                            }
                                            style={{
                                              color: "#e7cf6a",
                                              background: "rgba(0,0,0,0.55)",
                                              textShadow: "0 1px 0 rgba(20,10,0,0.7)",
                                            }}
                                          >
                                            {question.imageCaptions[i]}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div
                                      className="absolute -top-2 -left-2 md:-top-2.5 md:-left-2.5 w-8 h-8 md:w-9 md:h-9 rounded-md p-[1.5px] overflow-hidden pointer-events-none"
                                      style={{
                                        background: METALLIC_RIM_STRONG,
                                        boxShadow:
                                          "0 2px 6px rgba(0,0,0,0.55), 0 0 12px rgba(228,207,106,0.4), 0 0 0 1px rgba(0,0,0,0.6)",
                                      }}
                                    >
                                      <div
                                        className="relative w-full h-full rounded-[5px] flex items-center justify-center font-display font-bold text-xs md:text-sm"
                                        style={{
                                          background:
                                            "linear-gradient(180deg, #7a5816 0%, #a6801f 10%, #d9b446 28%, #f4dc7c 46%, #f9e89a 52%, #e4c55a 62%, #b28622 82%, #6d4e13 100%)",
                                          color: "#1a1105",
                                          textShadow:
                                            "0 1px 0 rgba(255,246,200,0.75), 0 -1px 0 rgba(36,22,0,0.45)",
                                          boxShadow:
                                            "inset 0 1px 0 rgba(255,252,220,0.95), inset 0 -1px 0 rgba(40,24,0,0.6), inset 0 -2px 4px rgba(60,38,6,0.3)",
                                        }}
                                      >
                                        <span className="relative z-[3]">{OPTION_LABELS[i]}</span>
                                      </div>
                                    </div>
                                  </motion.button>
                                );
                              }
                              return (
                                <div
                                  key={`${src}-${i}`}
                                  className="relative rounded-xl p-[2px] overflow-hidden flex-shrink-0"
                                  style={{
                                    background: METALLIC_RIM_GRADIENT,
                                    boxShadow:
                                      "0 0 14px -4px rgba(228,207,106,0.35), 0 8px 22px -14px rgba(0,0,0,0.7)",
                                  }}
                                >
                                  <div
                                    className={`relative rounded-[10px] bg-black/75 flex flex-col items-center gap-1.5 ${
                                      question.compactImageRow ? "p-1 md:p-1.5" : "p-1.5 md:p-2"
                                    }`}
                                  >
                                    <img
                                      src={src}
                                      alt={question.imageCaptions?.[i] ?? `image ${i + 1}`}
                                      className={
                                        question.compactImageRow
                                          ? "h-[88px] sm:h-[104px] md:h-[118px] w-auto max-w-[min(24vw,130px)] object-contain rounded"
                                          : "h-[200px] md:h-[260px] w-auto object-contain rounded"
                                      }
                                      draggable={false}
                                    />
                                    {question.imageCaptions?.[i] && (
                                      <span
                                        className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.25em] font-bold px-1.5 py-0.5 rounded"
                                        style={{
                                          color: "#e7cf6a",
                                          background: "rgba(0,0,0,0.55)",
                                          textShadow: "0 1px 0 rgba(20,10,0,0.7)",
                                        }}
                                      >
                                        {question.imageCaptions[i]}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* 1c. Row of label tiles — Q1 (A-Bat, B-Cricket, C-Cock,
                              D-Duck). Large letter chip + caption beneath. */}
                      {question.labelGlyphs && (
                        <div className="flex flex-wrap items-stretch justify-center gap-2.5 md:gap-3">
                          {question.labelGlyphs.map((tile) => (
                            <div
                              key={tile.letter}
                              className="relative rounded-xl p-[2px] overflow-hidden"
                              style={{
                                background: METALLIC_RIM_GRADIENT,
                                boxShadow:
                                  "0 0 14px -4px rgba(228,207,106,0.35), 0 8px 22px -14px rgba(0,0,0,0.7)",
                              }}
                            >
                              <div className="relative rounded-[10px] bg-black/75 px-4 py-2.5 md:px-5 md:py-3 flex flex-col items-center gap-1.5 min-w-[84px] md:min-w-[100px]">
                                <span
                                  className="font-display text-2xl md:text-3xl font-bold leading-none"
                                  style={{
                                    color: "#f4dc7c",
                                    textShadow:
                                      "0 1px 0 rgba(20,10,0,0.75), 0 0 10px rgba(228,174,68,0.35)",
                                  }}
                                >
                                  {tile.letter}
                                </span>
                                <span
                                  className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.2em] font-semibold"
                                  style={{ color: "#e7cf6a" }}
                                >
                                  {tile.caption}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ───────── WORD SEQUENCE ROW — Q4. Each word becomes a
                        chip; the final "?" chip calls out the slot the player
                        is solving for. Rendered only when the question carries
                        a wordSequence array. */}
                  {question.wordSequence && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.32, duration: 0.45, ease: EASE_OUT }}
                      className="relative w-full flex justify-center"
                    >
                      <div className="flex flex-wrap items-stretch justify-center gap-2 md:gap-2.5">
                        {question.wordSequence.map((word, i) => {
                          const isBlank = word === "?";
                          return (
                            <div
                              key={`${word}-${i}`}
                              className="relative rounded-xl p-[2px] overflow-hidden"
                              style={{
                                background: METALLIC_RIM_GRADIENT,
                                boxShadow: isBlank
                                  ? "0 0 18px -2px rgba(228,207,106,0.55), 0 8px 22px -14px rgba(0,0,0,0.7)"
                                  : "0 0 14px -4px rgba(228,207,106,0.35), 0 8px 22px -14px rgba(0,0,0,0.7)",
                              }}
                            >
                              <div
                                className="relative rounded-[10px] bg-black/75 px-3.5 py-2 md:px-4 md:py-2.5 flex items-center justify-center min-w-[64px] md:min-w-[76px]"
                                style={isBlank ? { background: "rgba(20,12,0,0.88)" } : undefined}
                              >
                                <span
                                  className="font-display text-base md:text-lg font-bold leading-none tracking-wide"
                                  style={{
                                    color: isBlank ? "#fff0c2" : "#f4dc7c",
                                    textShadow:
                                      "0 1px 0 rgba(20,10,0,0.75), 0 0 10px rgba(228,174,68,0.35)",
                                  }}
                                >
                                  {word}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {/* ───────── WORD PUZZLE BLOCK — Q8. Shows a single large
                        monospace string (e.g. "TNECREPE _ _") so the reversed-
                        phrase puzzle reads at a glance between the question
                        and the options. */}
                  {question.wordPuzzle && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.32, duration: 0.45, ease: EASE_OUT }}
                      className="relative w-full flex justify-center"
                    >
                      <div
                        className="relative rounded-xl p-[2.5px] overflow-hidden"
                        style={{
                          background: METALLIC_RIM_GRADIENT,
                          boxShadow:
                            "0 0 26px -2px rgba(228,207,106,0.55), 0 10px 28px -14px rgba(0,0,0,0.7)",
                        }}
                      >
                        <div
                          className="relative rounded-[10px] px-4 py-3 md:px-8 md:py-5 flex items-center justify-center"
                          style={{ background: "rgba(8,5,2,0.92)" }}
                        >
                          <span
                            className="font-mono font-bold tabular-nums leading-none whitespace-nowrap tracking-[0.22em] md:tracking-[0.3em] text-lg md:text-3xl lg:text-4xl"
                            style={{
                              color: "#f9e89a",
                              textShadow:
                                "0 1px 0 rgba(20,10,0,0.85), 0 0 14px rgba(249,232,154,0.45), 0 0 28px rgba(228,174,68,0.25)",
                            }}
                          >
                            {question.wordPuzzle}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Typed answer — Q1, Q3 (text) or Q5, Q7 (number) */}
                  {question.textInput && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.34, duration: 0.45, ease: EASE_OUT }}
                      className="relative w-full flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-center sm:gap-4"
                      data-tour-id="options-area"
                    >
                      <div
                        className="relative flex-1 min-w-0 max-w-md mx-auto sm:mx-0 rounded-lg overflow-hidden p-[2px]"
                        style={{
                          background: METALLIC_RIM_GRADIENT,
                          boxShadow: `0 0 18px ${GOLD_GLOW}, 0 10px 28px -12px rgba(0,0,0,0.7)`,
                        }}
                      >
                        <input
                          type="text"
                          className="w-full min-h-[48px] md:min-h-[54px] rounded-[7px] border-0 bg-[rgba(6,4,2,0.92)] px-3.5 py-2.5 md:px-4 text-center text-xs md:text-sm font-bold tracking-[0.04em] outline-none"
                          style={{
                            color: GOLD_BRIGHT,
                            boxShadow:
                              "inset 0 1px 0 rgba(255,245,210,0.06), inset 0 -1px 0 rgba(0,0,0,0.55), inset 0 0 24px rgba(0,0,0,0.45)",
                          }}
                          placeholder="Type your answer here..."
                          value={textInputValue}
                          onChange={(e) => setTextInputValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleTextSubmit();
                            }
                          }}
                          disabled={answered || inputsLocked || answerChecking}
                          autoComplete="off"
                        />
                      </div>
                      <motion.button
                        type="button"
                        onClick={handleTextSubmit}
                        disabled={!textInputValue.trim() || answered || inputsLocked || answerChecking}
                        whileHover={textInputValue.trim() && !answered && !inputsLocked && !answerChecking ? { scale: 1.02 } : undefined}
                        whileTap={textInputValue.trim() && !answered && !inputsLocked && !answerChecking ? { scale: 0.97 } : undefined}
                        className={`game-show-btn relative z-0 shrink-0 cursor-pointer rounded-xl px-8 py-3 text-center text-[12px] font-semibold uppercase tracking-[0.2em] min-h-[48px] md:min-h-[54px] ${
                          !textInputValue.trim() || answered || inputsLocked || answerChecking ? "opacity-50 pointer-events-none" : ""
                        } ${answerChecking ? "animate-pulse" : ""}`}
                      >
                        <span className="relative z-10">{answerChecking ? "Checking…" : "Submit"}</span>
                      </motion.button>
                    </motion.div>
                  )}

                  {question.numberInput && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.34, duration: 0.45, ease: EASE_OUT }}
                      className="relative w-full flex flex-col gap-3 items-center"
                      data-tour-id="options-area"
                    >
                      {question.image && (
                        <div className="relative w-full flex justify-center">
                          <div
                            className="relative rounded-xl p-[2.5px] overflow-hidden"
                            style={{
                              background: METALLIC_RIM_GRADIENT,
                              boxShadow:
                                "0 0 24px -4px rgba(228,207,106,0.35), 0 10px 28px -14px rgba(0,0,0,0.7)",
                            }}
                          >
                            <div
                              className={`relative rounded-[10px] bg-black/70 flex items-center justify-center ${
                                question.id === 7 ? "p-1.5 md:p-2" : "p-2 md:p-3"
                              }`}
                            >
                              <img
                                src={question.image}
                                alt="question media"
                                className={
                                  question.id === 7
                                    ? "max-h-48 md:max-h-56 w-auto object-contain rounded-md"
                                    : "max-h-[180px] md:max-h-[220px] w-auto object-contain rounded-md"
                                }
                                draggable={false}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-center sm:gap-4">
                      <div
                        className="relative flex-1 min-w-0 max-w-xs mx-auto sm:mx-0 rounded-lg overflow-hidden p-[2px] flex justify-center"
                        style={{
                          background: METALLIC_RIM_GRADIENT,
                          boxShadow: `0 0 18px ${GOLD_GLOW}, 0 10px 28px -12px rgba(0,0,0,0.7)`,
                        }}
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className={`min-h-[48px] md:min-h-[54px] rounded-[7px] border-0 bg-[rgba(6,4,2,0.92)] px-3.5 py-2.5 text-center text-sm md:text-base font-bold tabular-nums outline-none ${
                            (question.maxDigits ?? 1) >= 2 ? "w-28" : "w-20"
                          }`}
                          style={{
                            color: GOLD_BRIGHT,
                            boxShadow:
                              "inset 0 1px 0 rgba(255,245,210,0.06), inset 0 -1px 0 rgba(0,0,0,0.55), inset 0 0 24px rgba(0,0,0,0.45)",
                          }}
                          value={numberInputValue}
                          onChange={(e) => handleNumberChange(e.target.value, question.maxDigits ?? 2)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleNumberSubmit();
                            }
                          }}
                          disabled={answered || inputsLocked || answerChecking}
                          autoComplete="off"
                        />
                      </div>
                      <motion.button
                        type="button"
                        onClick={handleNumberSubmit}
                        disabled={!numberInputValue.trim() || answered || inputsLocked || answerChecking}
                        whileHover={numberInputValue.trim() && !answered && !inputsLocked && !answerChecking ? { scale: 1.02 } : undefined}
                        whileTap={numberInputValue.trim() && !answered && !inputsLocked && !answerChecking ? { scale: 0.97 } : undefined}
                        className={`game-show-btn relative z-0 shrink-0 cursor-pointer rounded-xl px-8 py-3 text-center text-[12px] font-semibold uppercase tracking-[0.2em] min-h-[48px] md:min-h-[54px] ${
                          !numberInputValue.trim() || answered || inputsLocked || answerChecking ? "opacity-50 pointer-events-none" : ""
                        } ${answerChecking ? "animate-pulse" : ""}`}
                      >
                        <span className="relative z-10">{answerChecking ? "Checking…" : "Submit"}</span>
                      </motion.button>
                      </div>
                    </motion.div>
                  )}

                  {/* Options row — hidden when images are the answers, or text/number input. */}
                  {!question.imagesAreOptions && !question.textInput && !question.numberInput && question.options.length > 0 && (
                  <div
                    // Grid columns track the option count exactly so 2-option
                    // questions (Q3 cards/glasses, Q8 gymnast) fill the row
                    // instead of leaving an empty right half. 3-option
                    // questions get a tight 3-col grid; 4-option questions
                    // (Q10) get the standard 4-col grid.
                    className={`${
                      question.options.length === 2
                        ? "grid grid-cols-2"
                        : question.options.length === 3
                          ? "grid grid-cols-3"
                          : "grid grid-cols-4"
                    } gap-3 md:gap-4`}
                    data-tour-id="options-area"
                  >
                    {question.options.map((option, i) => {
                      const { isSelected, isCorrectOption, showResult, rimBg, glow, textColor, innerBg } =
                        answerChromeStyles(i, question, selected, selectedAnswer, revealed);

                      return (
                        <motion.button
                          key={i}
                          type="button"
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.36 + i * 0.06, duration: 0.38, ease: EASE_OUT }}
                          onClick={() => handleSelect(i)}
                          disabled={answered || selected !== null || inputsLocked}
                          className={`relative group block p-0 border-0 bg-transparent appearance-none text-left ${
                            !answered && selected === null && !inputsLocked
                              ? "cursor-pointer hover:-translate-y-0.5"
                              : "cursor-not-allowed"
                          } ${inputsLocked && !answered ? "opacity-60 saturate-50" : ""} transition-transform duration-200`}
                          style={{
                            animation: showResult && isSelected && !isCorrectOption ? "wrong-shake 0.4s ease-in-out" : undefined,
                          }}
                        >
                          {/* Metallic gradient rim wrapper (thicker, polished) */}
                          <div
                            className="relative rounded-lg overflow-hidden p-[2px] transition-all duration-300"
                            style={{
                              background: rimBg,
                              boxShadow: glow,
                            }}
                          >
                            <div
                              className="relative rounded-[7px] overflow-hidden"
                              style={{
                                backgroundColor: innerBg,
                                boxShadow:
                                  "inset 0 1px 0 rgba(255,245,210,0.06), inset 0 -1px 0 rgba(0,0,0,0.55), inset 0 0 24px rgba(0,0,0,0.45)",
                              }}
                            >
                              <div className="px-2.5 md:px-3 py-2 md:py-2.5 min-h-[48px] md:min-h-[54px] flex items-center justify-center">
                                <span
                                  className="text-center text-xs md:text-sm font-bold uppercase tracking-[0.04em] leading-tight transition-colors duration-200"
                                  style={{ color: textColor }}
                                >
                                  {option}
                                </span>
                              </div>

                              {showResult && isCorrectOption && (
                                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                                  <div className="panel-sheen-wrap">
                                    <div
                                      className="panel-sheen opacity-90"
                                      style={{ animation: "sheen-ltr 0.85s ease-out 1 forwards" }}
                                    />
                                  </div>
                                </div>
                              )}

                              {!showResult && !answered && selected === null && (
                                <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                                  <div className="panel-sheen-wrap">
                                    <div className="panel-sheen" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* A/B/C/D — polished brass plate, metallic FROM THE FIRST FRAME.
                              No sheen animation. The multi-stop gradient (dark → bright spec
                              highlight → darker) is what sells the metal — the bright band
                              in the middle is the permanent specular highlight, so the badge
                              looks equally polished at rest and in motion. */}
                          <div
                            className="absolute -top-2 -left-2 md:-top-2.5 md:-left-2.5 w-8 h-8 md:w-9 md:h-9 rounded-md p-[1.5px] overflow-hidden"
                            style={{
                              background: METALLIC_RIM_STRONG,
                              boxShadow:
                                "0 2px 6px rgba(0,0,0,0.55), 0 0 12px rgba(228,207,106,0.4), 0 0 0 1px rgba(0,0,0,0.6)",
                            }}
                          >
                            <div
                              className="relative w-full h-full rounded-[5px] flex items-center justify-center font-display font-bold text-xs md:text-sm"
                              style={{
                                background:
                                  "linear-gradient(180deg, #7a5816 0%, #a6801f 10%, #d9b446 28%, #f4dc7c 46%, #f9e89a 52%, #e4c55a 62%, #b28622 82%, #6d4e13 100%)",
                                color: "#1a1105",
                                textShadow:
                                  "0 1px 0 rgba(255,246,200,0.75), 0 -1px 0 rgba(36,22,0,0.45)",
                                boxShadow:
                                  "inset 0 1px 0 rgba(255,252,220,0.95), inset 0 -1px 0 rgba(40,24,0,0.6), inset 0 -2px 4px rgba(60,38,6,0.3)",
                              }}
                            >
                              <span className="relative z-[3]">{OPTION_LABELS[i]}</span>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                  )}
              </div>

              {/* ───────── FEEDBACK BANNER ───────── */}
              <AnimatePresence>
                {awaitingReveal && (
                  <motion.div
                    key="locked-waiting"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: 0.1, duration: 0.3, ease: EASE_OUT }}
                    className="flex justify-center"
                  >
                    <div className="flex items-center gap-2 rounded-lg border border-brass/45 bg-black/70 backdrop-blur-sm px-4 py-2 text-center shadow-[0_0_20px_rgba(228,207,106,0.18)]">
                      <span className="inline-block h-2 w-2 rounded-full bg-brass-bright motion-safe:animate-pulse" aria-hidden />
                      <p className="text-brass-bright/95 text-xs md:text-sm font-medium tracking-wide">
                        Answer locked — waiting for the timer…
                      </p>
                    </div>
                  </motion.div>
                )}
                {revealed && (
                  <motion.div
                    key="reveal-banner"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: 0.15, duration: 0.3, ease: EASE_OUT }}
                    className="flex justify-center"
                  >
                    {selectedAnswer === null ? (
                      <div className="rounded-lg border border-red-500/60 bg-red-950/70 backdrop-blur-sm px-4 py-2 text-center shadow-[0_0_20px_rgba(217,74,92,0.25)]">
                        <p className="text-red-200/95 text-xs md:text-sm font-medium">
                          Time&apos;s up.
                          {!question.acceptAny && (
                            <>
                              {" "}The answer was{" "}
                              <span className="text-brass-bright font-semibold">{correctAnswerLabel(question)}</span>
                            </>
                          )}
                        </p>
                      </div>
                    ) : isCorrect ? (
                      <motion.div
                        initial={{ scale: 0.96 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", bounce: 0.35 }}
                        className="rounded-lg border border-emerald-400/70 bg-emerald-950/70 backdrop-blur-sm px-5 py-2 text-center shadow-[0_0_28px_rgba(61,170,122,0.35)]"
                      >
                        <p className="font-display text-sm md:text-base font-semibold text-emerald-200 tracking-wide">
                          {question.acceptAny ? "Well observed." : "Correct!"}
                        </p>
                      </motion.div>
                    ) : (
                      <div className="rounded-lg border border-red-500/60 bg-red-950/70 backdrop-blur-sm px-4 py-2 text-center shadow-[0_0_20px_rgba(217,74,92,0.25)]">
                        <p className="text-red-200/95 text-xs md:text-sm font-medium">
                          Wrong answer. It was{" "}
                          <span className="text-brass-bright font-semibold">{correctAnswerLabel(question)}</span>
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

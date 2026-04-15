"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Question } from "./QuizGame";
import { formatRupees } from "./QuizGame";

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

interface QuestionScreenProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  potPrize: number;
  remainingPlayers: number;
  totalPlayers: number;
  playerName: string;
  onAnswer: (index: number) => void;
  onTimeUp: () => void;
  answered: boolean;
  selectedAnswer: number | null;
  isCorrect: boolean;
  paused?: boolean;
  /** Overlay rendered inside the screen frame (e.g. after-round elimination reveal). */
  afterRoundOverlay?: ReactNode;
}

// Difficulty % badge gradient
function getDifficultyColor(pct: number) {
  if (pct >= 80) return { gradient: "from-emerald-400 to-teal-400", bg: "#3daa7a" };
  if (pct >= 50) return { gradient: "from-amber-400 to-yellow-300", bg: "#c4a035" };
  if (pct >= 20) return { gradient: "from-orange-400 to-amber-400", bg: "#d4913a" };
  return { gradient: "from-red-400 to-rose-400", bg: "#d94a5c" };
}

const OPTION_LABELS = ["A", "B", "C", "D"];

// Uniform styling — every option wears the same black fill + gold border + gold badge.
const GOLD = "#e0a02b";
const GOLD_BRIGHT = "#e4cf6a";
const GOLD_GLOW = "rgba(224,160,43,0.45)";

// Vertical "journey" ticker — the 8 actual game checkpoints, top (90) to bottom (1).
const JOURNEY = [90, 80, 70, 60, 50, 30, 10, 1];

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
  answered,
  selectedAnswer,
  isCorrect,
  paused = false,
  afterRoundOverlay,
}: QuestionScreenProps) {
  const [timeLeft, setTimeLeft] = useState(question.timeLimit);
  const [selected, setSelected] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasCalledTimeUp = useRef(false);

  const difficulty = getDifficultyColor(question.percentage);

  useEffect(() => {
    if (answered || paused) {
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
  }, [answered, onTimeUp, paused]);

  const handleSelect = useCallback((index: number) => {
    if (answered || selected !== null || paused) return;
    setSelected(index);
    if (intervalRef.current) clearInterval(intervalRef.current);
    onAnswer(index);
  }, [answered, selected, onAnswer, paused]);

  const timerProgress = timeLeft / question.timeLimit;
  const timerColor = timerProgress > 0.5 ? "#c4a035" : timerProgress > 0.2 ? "#d4913a" : "#d94a5c";
  const arcLength = 251.2;
  const arcDash = arcLength * timerProgress;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className="w-full h-full relative overflow-hidden bg-black"
    >
      {/* ━━ Full-bleed stage BG ━━ */}
      <img
        src="/questionscreenimages/stage-bg-new.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        draggable={false}
      />
      {/* Violet tonal wash */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 30%, rgba(120,60,180,0.10) 0%, rgba(80,40,140,0.05) 45%, transparent 75%)",
          mixBlendMode: "screen",
        }}
      />

      {/* ━━ TOP HUD STRIP — floats above the frame, near the top of the viewport ━━ */}
      <div className="absolute top-3 md:top-5 left-0 right-0 z-20 px-4 md:px-8">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: EASE_OUT }}
            className="flex items-center gap-2.5 rounded-lg bg-black/55 border border-brass/35 backdrop-blur-md px-3 py-1.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]"
            data-tour-id="pot-prize"
          >
            <div className="w-8 h-8 rounded-md bg-brass/15 border border-brass/50 flex items-center justify-center text-brass-bright">
              <IconPot />
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-brass-dim leading-none">Pot</p>
              <p className="font-mono text-sm font-semibold text-brass-bright tabular-nums leading-none mt-0.5">
                {formatRupees(potPrize)}
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: EASE_OUT }}
            className="flex items-center gap-2.5 rounded-lg bg-black/55 border border-brass/35 backdrop-blur-md px-3 py-1.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]"
          >
            <div className="text-right">
              <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-brass-dim leading-none">Players</p>
              <p className="font-mono text-sm font-semibold text-foreground tabular-nums leading-none mt-0.5">
                {remainingPlayers}<span className="text-muted text-[10px]">/{totalPlayers}</span>
              </p>
            </div>
            <div className="w-8 h-8 rounded-md bg-brass/15 border border-brass/50 flex items-center justify-center text-brass-bright">
              <IconPlayers />
            </div>
          </motion.div>
        </div>
      </div>

      {/* ━━ RIGHT-EDGE JOURNEY TICKER — spans most of the viewport height on the right ━━ */}
      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.25, duration: 0.5, ease: EASE_OUT }}
        className="absolute top-20 bottom-10 right-3 md:right-6 z-20 flex items-center"
        aria-label="Your journey from 100% to 1%"
      >
        <div className="relative flex flex-col items-center rounded-2xl bg-black/60 border border-brass/40 backdrop-blur-md px-3 md:px-4 py-4 md:py-5 shadow-[0_12px_36px_-10px_rgba(0,0,0,0.7)] h-full">
          <p className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.28em] text-brass-dim mb-3">
            Journey
          </p>
          <div className="relative w-full flex-1 flex flex-col items-center justify-between">
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
                    className="relative"
                  >
                    <div
                      className="absolute -inset-2 rounded-md blur-md opacity-70"
                      style={{ background: GOLD }}
                    />
                    <div
                      className="relative px-2.5 py-1 rounded-md text-sm md:text-base font-display font-bold tabular-nums"
                      style={{
                        backgroundColor: GOLD,
                        color: "#0a0805",
                        boxShadow: `0 0 12px ${GOLD_GLOW}`,
                      }}
                    >
                      {pct}%
                    </div>
                  </motion.div>
                );
              }
              return (
                <span
                  key={pct}
                  className="font-mono text-sm md:text-base tabular-nums font-semibold transition-colors"
                  style={{
                    color: isReached ? "rgba(228,207,106,0.9)" : "rgba(228,207,106,0.32)",
                  }}
                >
                  {pct}
                </span>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ━━ Centered content frame ━━ */}
      <div className="relative z-10 w-full h-full flex items-center justify-center px-4 md:px-8 py-20 md:py-24">
        <div className="w-full max-w-[1100px]">

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              SCREEN FRAME — rounded amber-bordered panel. Big and tall
              so after-round overlays fit inside without resizing.
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <div
            className="relative w-full mx-auto rounded-[32px] overflow-hidden"
            style={{
              background: "linear-gradient(180deg, #0b0906 0%, #050403 100%)",
              border: "6px solid #e0a02b",
              boxShadow: [
                "0 0 0 1px rgba(0,0,0,0.7)",
                "0 0 34px 6px rgba(224,160,43,0.50)",
                "0 0 110px 16px rgba(224,160,43,0.20)",
                "inset 0 0 0 1px rgba(255,220,140,0.4)",
                "inset 0 3px 32px rgba(255,220,140,0.08)",
              ].join(", "),
              minHeight: "min(68vh, 560px)",
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(255,220,140,0.08) 0%, transparent 60%)",
              }}
            />

            <div className="relative p-6 md:p-10 flex flex-col gap-7 md:gap-10 min-h-[inherit]">
              {/* After-round overlay (elimination reveal) — rendered INSIDE the same frame */}
              <AnimatePresence>
                {afterRoundOverlay && (
                  <motion.div
                    key="after-round-overlay"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.45, ease: EASE_OUT }}
                    className="absolute inset-4 md:inset-6 z-30 rounded-2xl bg-black/85 backdrop-blur-md overflow-y-auto"
                  >
                    {afterRoundOverlay}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ───────── MAIN BODY — question + options (ticker & HUD moved outside) ───────── */}
              <div className="flex-1 flex flex-col gap-6 md:gap-8 justify-center">

                  {/* Host status chip — ABOVE the question panel, always visible */}
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.35, ease: EASE_OUT }}
                    className="flex justify-center"
                  >
                    {paused && !answered ? (
                      <div
                        className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/80 border"
                        style={{
                          borderColor: GOLD,
                          boxShadow: `0 0 18px ${GOLD_GLOW}, 0 0 4px ${GOLD_GLOW}`,
                        }}
                      >
                        <span className="relative flex w-2 h-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brass-bright opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-brass-bright" />
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-brass-bright">
                          Host is speaking
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 border border-white/15">
                        <span className="relative flex w-2 h-2">
                          <span className="inline-flex rounded-full h-2 w-2 bg-white/25" />
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/45">
                          Host muted
                        </span>
                      </div>
                    )}
                  </motion.div>

                  {/* Question strip — question panel (flex-1) + timer (right) */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25, duration: 0.5, ease: EASE_OUT }}
                    className="relative flex items-stretch gap-3 md:gap-4"
                    data-tour-id="question-area"
                  >
                    <div className="relative flex-1 min-w-0 rounded-2xl border border-brass/40 bg-black/75 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_24px_-6px_rgba(224,160,43,0.25)]">
                      <div className="absolute top-0 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-brass/60 to-transparent" />
                      <div className="absolute bottom-0 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-brass/40 to-transparent" />
                      <div className="px-5 md:px-8 py-4 md:py-6 text-center flex items-center justify-center min-h-[88px] md:min-h-[112px]">
                        <p className="text-base md:text-lg lg:text-xl text-foreground font-medium leading-[1.4] tracking-[-0.005em]">
                          {question.question}
                        </p>
                      </div>
                    </div>


                    {/* Timer — docked to the right of the question panel */}
                    <div className="flex-shrink-0 flex items-center">
                      <div className="relative w-[60px] h-[60px] md:w-[76px] md:h-[76px]" data-tour-id="timer">
                        {timeLeft <= 8 && !answered && (
                          <motion.div
                            className="absolute -inset-2 rounded-full"
                            style={{ border: `2px solid ${timerColor}33` }}
                            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ duration: 0.6, repeat: Infinity }}
                          />
                        )}
                        <svg width="100%" height="100%" viewBox="0 0 88 88" className="-rotate-90">
                          <circle cx="44" cy="44" r="40" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
                          <circle
                            cx="44" cy="44" r="40"
                            fill="none"
                            stroke={timerColor}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray={arcLength}
                            strokeDashoffset={arcLength - arcDash}
                            style={{
                              transition: "stroke-dashoffset 1s linear, stroke 0.3s",
                              filter: timeLeft <= 5 ? `drop-shadow(0 0 6px ${timerColor})` : "none",
                            }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span
                            className="font-mono text-lg md:text-2xl font-bold tabular-nums"
                            style={{
                              color: timerColor,
                              animation: timeLeft <= 5 && !answered ? "tick-pulse 0.5s ease-in-out infinite" : "none",
                            }}
                          >
                            {timeLeft}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Options row — 4 uniform black+gold cards */}
                  <div className="grid grid-cols-4 gap-3 md:gap-4" data-tour-id="options-area">
                    {question.options.map((option, i) => {
                      const isSelected = selected === i || selectedAnswer === i;
                      const isCorrectOption = i === question.correctIndex;
                      const showResult = answered;

                      // Uniform: black fill, gold border, gold badge, gold text
                      let borderColor = GOLD;
                      let fillBg = "rgba(10,8,5,0.92)";
                      let glow = `0 0 14px ${GOLD_GLOW}`;
                      let textColor = GOLD_BRIGHT;

                      if (showResult && isCorrectOption) {
                        borderColor = "#34d399";
                        glow = "0 0 26px rgba(61,170,122,0.55)";
                        textColor = "#6ee7b7";
                      } else if (showResult && isSelected && !isCorrectOption) {
                        borderColor = "#ef4444";
                        glow = "0 0 22px rgba(217,74,92,0.5)";
                        textColor = "#fca5a5";
                      } else if (showResult && !isSelected) {
                        borderColor = "rgba(228,207,106,0.22)";
                        glow = "none";
                        textColor = "rgba(228,207,106,0.3)";
                      } else if (isSelected) {
                        borderColor = GOLD_BRIGHT;
                        glow = `0 0 22px ${GOLD_GLOW}, 0 0 0 2px ${GOLD_BRIGHT}`;
                      }

                      return (
                        <motion.button
                          key={i}
                          type="button"
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.36 + i * 0.06, duration: 0.38, ease: EASE_OUT }}
                          onClick={() => handleSelect(i)}
                          disabled={answered || selected !== null || paused}
                          className={`relative group block p-0 border-0 bg-transparent appearance-none text-left ${
                            !answered && selected === null && !paused
                              ? "cursor-pointer hover:-translate-y-0.5"
                              : "cursor-not-allowed"
                          } ${paused && !answered ? "opacity-60 saturate-50" : ""} transition-transform duration-200`}
                          style={{
                            animation: showResult && isSelected && !isCorrectOption ? "wrong-shake 0.4s ease-in-out" : undefined,
                          }}
                        >
                          <div
                            className="relative rounded-lg overflow-hidden transition-all duration-300"
                            style={{
                              backgroundColor: fillBg,
                              border: `2px solid ${borderColor}`,
                              boxShadow: glow,
                            }}
                          >
                            {/* Smaller option box: tighter padding + smaller min-height */}
                            <div className="px-2.5 md:px-3 py-2.5 md:py-3 min-h-[52px] md:min-h-[60px] flex items-center justify-center">
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

                          {/* Rounded-square badge — black fill, gold border, gold letter. Uniform on all 4. */}
                          <div
                            className="absolute -top-2 -left-2 md:-top-2.5 md:-left-2.5 w-7 h-7 md:w-8 md:h-8 rounded-md flex items-center justify-center font-display font-bold text-xs md:text-sm"
                            style={{
                              backgroundColor: "#0a0805",
                              color: GOLD_BRIGHT,
                              border: `1.5px solid ${GOLD}`,
                              boxShadow: [
                                "0 0 0 2px rgba(0,0,0,0.9)",
                                `0 0 12px ${GOLD_GLOW}`,
                                "0 4px 12px -3px rgba(0,0,0,0.75)",
                              ].join(", "),
                            }}
                          >
                            {OPTION_LABELS[i]}
                          </div>

                          {showResult && isCorrectOption && (
                            <motion.span
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
                              className="absolute -top-2 -right-2 md:-top-2.5 md:-right-2.5 w-6 h-6 md:w-7 md:h-7 rounded-md bg-emerald-400 text-black flex items-center justify-center text-xs md:text-sm font-bold drop-shadow-[0_0_10px_rgba(61,170,122,0.9)] ring-2 ring-black/40"
                              aria-hidden
                            >
                              ✓
                            </motion.span>
                          )}
                          {showResult && isSelected && !isCorrectOption && (
                            <motion.span
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
                              className="absolute -top-2 -right-2 md:-top-2.5 md:-right-2.5 w-6 h-6 md:w-7 md:h-7 rounded-md bg-red-500 text-white flex items-center justify-center text-xs md:text-sm font-bold ring-2 ring-black/40"
                              aria-hidden
                            >
                              ✗
                            </motion.span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
              </div>

              {/* ───────── FEEDBACK BANNER ───────── */}
              <AnimatePresence>
                {answered && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: 0.15, duration: 0.3, ease: EASE_OUT }}
                    className="flex justify-center"
                  >
                    {selectedAnswer === null ? (
                      <div className="rounded-lg border border-red-500/60 bg-red-950/70 backdrop-blur-sm px-4 py-2 text-center shadow-[0_0_20px_rgba(217,74,92,0.25)]">
                        <p className="text-red-200/95 text-xs md:text-sm font-medium">
                          Time&apos;s up. The answer was{" "}
                          <span className="text-brass-bright font-semibold">{question.options[question.correctIndex]}</span>
                        </p>
                      </div>
                    ) : isCorrect ? (
                      <motion.div
                        initial={{ scale: 0.96 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", bounce: 0.35 }}
                        className="rounded-lg border border-emerald-400/70 bg-emerald-950/70 backdrop-blur-sm px-5 py-2 text-center shadow-[0_0_28px_rgba(61,170,122,0.35)]"
                      >
                        <p className="font-display text-sm md:text-base font-semibold text-emerald-200 tracking-wide">Correct!</p>
                      </motion.div>
                    ) : (
                      <div className="rounded-lg border border-red-500/60 bg-red-950/70 backdrop-blur-sm px-4 py-2 text-center shadow-[0_0_20px_rgba(217,74,92,0.25)]">
                        <p className="text-red-200/95 text-xs md:text-sm font-medium">
                          Not quite. It was{" "}
                          <span className="text-brass-bright font-semibold">{question.options[question.correctIndex]}</span>
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

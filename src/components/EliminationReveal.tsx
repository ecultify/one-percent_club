"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { formatRupees } from "./QuizGame";

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

interface EliminationRevealProps {
  questionNumber: number;
  percentage: number;
  eliminated: number;
  remainingPlayers: number;
  totalPlayers: number;
  potPrize: number;
  playerGotItRight: boolean;
  isLastQuestion: boolean;
  onContinue: () => void;
  previouslyEliminated: number;
  /** When true, skip the full-screen wrapper + atmospheric BG. Used when embedded inside the question frame. */
  embedded?: boolean;
}

// Animated counter that ticks up from 0 to target
function useAnimatedCounter(target: number, duration: number = 1500, delay: number = 500) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay]);

  return count;
}

// ── Person Icon (silhouette with elimination state) ──
function PersonIcon({ eliminated, isNew, delay }: { eliminated: boolean; isNew: boolean; delay: number }) {
  return (
    <motion.div className="relative flex items-center justify-center">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 24 24"
        fill="none"
        className={`transition-all duration-500 ${
          eliminated ? "text-red-500/20" : "text-[var(--gold)]/60"
        }`}
      >
        <circle cx="12" cy="7" r="4" fill="currentColor" />
        <path
          d="M12 13c-4.42 0-8 1.79-8 4v1h16v-1c0-2.21-3.58-4-8-4z"
          fill="currentColor"
        />
      </svg>

      {/* Animated X for eliminated */}
      {eliminated && isNew && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0, rotate: -45 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ delay, duration: 0.2, ease: "easeOut" }}
        >
          <svg width="70%" height="70%" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="var(--danger)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>
        </motion.div>
      )}
      {eliminated && !isNew && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg width="70%" height="70%" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="var(--danger)"
              strokeWidth="3.5"
              strokeLinecap="round"
              opacity="0.4"
            />
          </svg>
        </div>
      )}
    </motion.div>
  );
}

// ── 10×10 Player Grid ──
function PlayerGrid({
  totalPlayers,
  previouslyEliminated,
  newlyEliminated,
}: {
  totalPlayers: number;
  previouslyEliminated: number;
  newlyEliminated: number;
}) {
  const eliminatedIndices = useMemo(() => {
    const indices = Array.from({ length: totalPlayers }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(((i * 7 + 13) % indices.length));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const previousSet = new Set(indices.slice(0, previouslyEliminated));
    const newSet = new Set(indices.slice(previouslyEliminated, previouslyEliminated + newlyEliminated));
    return { previousSet, newSet };
  }, [totalPlayers, previouslyEliminated, newlyEliminated]);

  return (
    <div className="grid grid-cols-10 gap-[3px] max-w-[300px] mx-auto">
      {Array.from({ length: totalPlayers }).map((_, i) => {
        const wasPreviouslyEliminated = eliminatedIndices.previousSet.has(i);
        const isNewlyEliminated = eliminatedIndices.newSet.has(i);
        const isEliminated = wasPreviouslyEliminated || isNewlyEliminated;

        const newSetArr = Array.from(eliminatedIndices.newSet);
        const idx = newSetArr.indexOf(i);
        const staggerDelay = isNewlyEliminated
          ? 0.8 + (idx / Math.max(newSetArr.length, 1)) * 1.0
          : 0;

        return (
          <div key={i} className="aspect-square w-full">
            <PersonIcon
              eliminated={isEliminated}
              isNew={isNewlyEliminated}
              delay={staggerDelay}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function EliminationReveal({
  questionNumber,
  percentage,
  eliminated,
  remainingPlayers,
  totalPlayers,
  potPrize,
  playerGotItRight,
  isLastQuestion,
  onContinue,
  previouslyEliminated,
  embedded = false,
}: EliminationRevealProps) {
  const animatedEliminated = useAnimatedCounter(eliminated, 1200, 800);
  const animatedPot = useAnimatedCounter(potPrize, 1500, 2200);
  const animatedRemaining = useAnimatedCounter(remainingPlayers, 1200, 2200);

  // ───────── Reusable pieces ─────────
  const statusChip = playerGotItRight ? (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", bounce: 0.4, delay: 0.3 }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--success)]/10 border border-[var(--success)]/30"
    >
      <div className="w-1.5 h-1.5 rounded-full bg-[var(--success)] shadow-[0_0_6px_rgba(67,181,129,0.6)]" />
      <span className="text-[var(--success)] text-[10px] font-semibold uppercase tracking-wider">Survived</span>
    </motion.div>
  ) : (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", bounce: 0.4, delay: 0.3 }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--danger)]/10 border border-[var(--danger)]/30"
    >
      <div className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] shadow-[0_0_6px_rgba(232,72,85,0.6)]" />
      <span className="text-[var(--danger)] text-[10px] font-semibold uppercase tracking-wider">Eliminated</span>
    </motion.div>
  );

  const gridPanel = (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.4, duration: 0.6, ease: EASE_OUT }}
      className="h-full flex flex-col justify-between p-3 rounded-xl bg-black/45 border-2 border-white/[0.1] shadow-inner"
    >
      <div className="flex-1 flex items-center justify-center min-h-0">
        <PlayerGrid
          totalPlayers={totalPlayers}
          previouslyEliminated={previouslyEliminated}
          newlyEliminated={eliminated}
        />
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.4 }}
        className="text-center mt-3 flex-shrink-0"
      >
        <div className="inline-flex items-center gap-2">
          <motion.span
            className="font-display text-2xl md:text-3xl text-[var(--danger)] tracking-wider"
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.6, type: "spring", bounce: 0.3 }}
          >
            {animatedEliminated}
          </motion.span>
          <span className="text-[var(--danger)]/55 text-[10px] uppercase tracking-[0.2em]">
            eliminated this round
          </span>
        </div>
      </motion.div>
    </motion.div>
  );

  const statsBlock = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 2.0, duration: 0.5, ease: EASE_OUT }}
      className="grid grid-cols-2 gap-2"
    >
      <div className="relative p-3 rounded-xl overflow-hidden border-2 border-white/[0.2] bg-white/[0.04]">
        <div className="panel-sheen-wrap">
          <div className="panel-sheen opacity-40" style={{ animationDuration: "3.6s" }} />
        </div>
        <div className="relative z-[1] text-center">
          <p className="font-mono text-xl md:text-2xl font-bold text-foreground tabular-nums">
            {animatedRemaining}
          </p>
          <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-muted mt-0.5">Still standing</p>
        </div>
      </div>
      <div className="relative p-3 rounded-xl overflow-hidden border-2 border-brass/50 bg-brass/[0.1] shadow-[0_0_24px_rgba(196,160,53,0.14)]">
        <div className="panel-sheen-wrap">
          <div className="panel-sheen opacity-55" style={{ animationDuration: "2.9s" }} />
        </div>
        <div className="relative z-[1] text-center">
          <p className="font-mono text-xl md:text-2xl font-bold text-brass-bright tabular-nums">
            {formatRupees(animatedPot)}
          </p>
          <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-brass-dim mt-0.5">In the pot</p>
        </div>
      </div>
    </motion.div>
  );

  const continueButton = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 2.6, duration: 0.4, ease: EASE_OUT }}
    >
      <motion.button
        onClick={onContinue}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="game-show-btn relative z-0 w-full cursor-pointer rounded-xl bg-brass py-3.5 text-center text-[13px] font-semibold uppercase tracking-[0.18em] text-[#14110a] transition-colors hover:bg-brass-bright"
      >
        <span className="relative z-10">{isLastQuestion ? "See final results" : "Next question"}</span>
      </motion.button>
    </motion.div>
  );

  const headerRow = (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5, ease: EASE_OUT }}
      className="flex items-center justify-between"
    >
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-brass/15 border-2 border-brass/35 flex items-center justify-center shadow-[0_0_12px_rgba(196,160,53,0.2)]">
          <span className="font-display text-xs text-brass-bright">Q{questionNumber}</span>
        </div>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-brass-dim/90">After round</p>
          <p className="text-xs text-foreground/80 font-mono font-medium">{percentage}% question</p>
        </div>
      </div>
      {statusChip}
    </motion.div>
  );

  // Inner content (card) for the FULL-SCREEN mode — stacked vertical
  const card = (
    <div className="relative w-full max-w-md mx-4">
        {/* ── Card ── */}
        <div className="relative">
          <div className="pointer-events-none absolute -top-3 left-[8%] right-[8%] h-20 rounded-[100%] bg-[radial-gradient(ellipse_100%_100%_at_50%_0%,rgba(228,207,106,0.35),rgba(196,160,53,0.08)_45%,transparent_72%)] blur-lg" />

          <div className="relative rounded-2xl bg-gradient-to-b from-[#120808] to-[#0a0904] px-5 py-5 border-2 border-white/[0.16] overflow-hidden shadow-[0_0_48px_-8px_rgba(217,74,92,0.12)]">

            {/* ── Header Row ── */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5, ease: EASE_OUT }}
              className="flex items-center justify-between mb-4"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-brass/15 border-2 border-brass/35 flex items-center justify-center shadow-[0_0_12px_rgba(196,160,53,0.2)]">
                  <span className="font-display text-xs text-brass-bright">Q{questionNumber}</span>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-brass-dim/90">After round</p>
                  <p className="text-xs text-foreground/80 font-mono font-medium">{percentage}% question</p>
                </div>
              </div>

              {playerGotItRight ? (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", bounce: 0.4, delay: 0.3 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--success)]/8 border border-[var(--success)]/20"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--success)] shadow-[0_0_6px_rgba(67,181,129,0.6)]" />
                  <span className="text-[var(--success)] text-[10px] font-semibold uppercase tracking-wider">Survived</span>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", bounce: 0.4, delay: 0.3 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--danger)]/8 border border-[var(--danger)]/20"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] shadow-[0_0_6px_rgba(232,72,85,0.6)]" />
                  <span className="text-[var(--danger)] text-[10px] font-semibold uppercase tracking-wider">Eliminated</span>
                </motion.div>
              )}
            </motion.div>

            {/* ── Player Grid ── */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 0.6, ease: EASE_OUT }}
              className="mb-3 p-3 rounded-xl bg-black/35 border-2 border-white/[0.1] shadow-inner"
            >
              <PlayerGrid
                totalPlayers={totalPlayers}
                previouslyEliminated={previouslyEliminated}
                newlyEliminated={eliminated}
              />
            </motion.div>

            {/* ── Elimination Count ── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5, duration: 0.4 }}
              className="text-center mb-4"
            >
              <div className="inline-flex items-center gap-2">
                <motion.span
                  className="font-display text-3xl text-[var(--danger)] tracking-wider"
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.6, type: "spring", bounce: 0.3 }}
                >
                  {animatedEliminated}
                </motion.span>
                <span className="text-[var(--danger)]/40 text-[10px] uppercase tracking-[0.2em]">
                  eliminated this round
                </span>
              </div>
            </motion.div>

            {/* ── Stats Row ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.0, duration: 0.5, ease: EASE_OUT }}
              className="grid grid-cols-2 gap-2 mb-4"
            >
              {/* Still Standing */}
              <div className="relative p-3 rounded-xl overflow-hidden border-2 border-white/[0.2] bg-white/[0.04]">
                <div className="panel-sheen-wrap">
                  <div className="panel-sheen opacity-40" style={{ animationDuration: "3.6s" }} />
                </div>
                <div className="relative z-[1] text-center">
                  <p className="font-mono text-2xl font-bold text-foreground tabular-nums">
                    {animatedRemaining}
                  </p>
                  <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-muted mt-0.5">Still standing</p>
                </div>
              </div>

              <div className="relative p-3 rounded-xl overflow-hidden border-2 border-brass/50 bg-brass/[0.1] shadow-[0_0_24px_rgba(196,160,53,0.14)]">
                <div className="panel-sheen-wrap">
                  <div className="panel-sheen opacity-55" style={{ animationDuration: "2.9s" }} />
                </div>
                <div className="relative z-[1] text-center">
                  <p className="font-mono text-2xl font-bold text-brass-bright tabular-nums">
                    {formatRupees(animatedPot)}
                  </p>
                  <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-brass-dim mt-0.5">In the pot</p>
                </div>
              </div>
            </motion.div>

            {/* ── Continue Button ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.6, duration: 0.4, ease: EASE_OUT }}
            >
              <motion.button
                onClick={onContinue}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="game-show-btn relative z-0 w-full cursor-pointer rounded-xl bg-brass py-3.5 text-center text-[13px] font-semibold uppercase tracking-[0.18em] text-[#14110a] transition-colors hover:bg-brass-bright"
              >
                <span className="relative z-10">{isLastQuestion ? "See final results" : "Next question"}</span>
              </motion.button>
            </motion.div>
          </div>
        </div>
    </div>
  );

  // Embedded mode — 2-column layout: grid LEFT, stats + button RIGHT
  if (embedded) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full h-full flex items-center justify-center p-4 md:p-6"
      >
        <div className="w-full h-full flex flex-col gap-3">
          {/* Header row on top */}
          {headerRow}

          {/* 2-column body */}
          <div className="flex-1 grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-4 md:gap-5 items-stretch min-h-0">
            {/* LEFT: player grid + eliminated count (stretches to column height) */}
            <div className="h-full flex flex-col min-h-0">
              {gridPanel}
            </div>

            {/* RIGHT: stats on top, continue button at bottom (same height as left) */}
            <div className="h-full flex flex-col justify-between gap-3 min-h-0">
              {statsBlock}
              {continueButton}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Full-screen mode — original behaviour with atmospheric BG
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full h-full flex items-center justify-center relative overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(232,72,85,0.08) 0%, transparent 70%)" }}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: [0, 1, 0.5], scale: [0.3, 1.2, 1] }}
          transition={{ duration: 1.8, ease: "easeOut" }}
        />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(110vw,900px)] h-[min(50vh,520px)]"
          style={{
            background: "radial-gradient(ellipse at 50% 0%, rgba(255,220,140,0.14) 0%, rgba(196,160,53,0.07) 40%, transparent 68%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          }}
        />
      </div>
      {card}
    </motion.div>
  );
}

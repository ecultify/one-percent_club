"use client";

import { useState, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatRupees } from "./QuizGame";
import { useNarration } from "./NarrationProvider";
// Pot animation temporarily disabled per client request — replaced inside the
// elimination reveal with a flat text card. Keep the import commented out so
// the component is one uncomment away when the client wants it back.
// import PotFill3D from "./PotFill3D";
import CoinTrailToNavbar from "./CoinTrailToNavbar";
import { ZText3DDanger } from "./MetallicText3D";

// Stake per eliminated player (mirrors getDefaultQuizGameState in QuizGame.tsx).
// Used to derive the per-round contribution and compute proportional fill levels.
const STAKE_PER_PLAYER = 100000;

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

/** Dramatic elimination decision stinger — plays once during the grid phase.
 *  Clip is ~9s long; the grid animation duration is tuned to match (see GRID_PHASE_MS). */
const ELIMINATION_DECISION_SRC = encodeURI("/sound/eliminationdecision.wav");
/** Applause: full level ~5s, then long fade to silence. */
const APPLAUSE_SRC = encodeURI("/sound/appluase2.wav");
const APPLAUSE_FULL_VOL_MS = 5000;
const APPLAUSE_FADE_MS = 4000;
/** Grid-phase duration — 3s window. The audio is seeked to play only the
 *  LAST 3 seconds of the wav (the dramatic climax), not the first 3. */
const GRID_PHASE_MS = 3000;
/** After crosses + copy are visible, hold before showing the stats / applause card. */
const POST_CROSS_HOLD_MS = 500;
/** "count" phase duration: grid sits left, the big "X eliminated this round" headline
 *  beats on the right, then we transition into the pot reveal. ~1.8s lets the
 *  number land, breathe, and pull the eye before the pot scene takes over. */
const COUNT_PHASE_MS = 1800;
/** Tail fade so the wav ending doesn't clip abruptly. */
const ELIM_AUDIO_TAIL_FADE_MS = 250;

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

// During stinger: CSS steps() siren (blue/red only). After .wav ends: gold / solid red + X / dim prior.
function PersonIcon({
  wasPrevious,
  isNew,
  crossStagger,
  iconIndex,
  gridSequenceActive,
  showCrossAfterAudio,
}: {
  wasPrevious: boolean;
  isNew: boolean;
  crossStagger: number;
  iconIndex: number;
  gridSequenceActive: boolean;
  showCrossAfterAudio: boolean;
}) {
  const sirenOn = gridSequenceActive && !showCrossAfterAudio;
  const flickerDuration = 0.38 + ((iconIndex * 47) % 11) * 0.035;
  const flickerDelay = ((iconIndex * 73 + 19) % 100) / 1000;

  const resolvedSvg = (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      fill="none"
      className={`relative transition-colors duration-300 ${
        wasPrevious
          ? "text-red-500/25"
          : isNew
            ? "text-red-500/85"
            : "text-[var(--gold)]/60"
      }`}
    >
      <circle cx="12" cy="7" r="4" fill="currentColor" />
      <path
        d="M12 13c-4.42 0-8 1.79-8 4v1h16v-1c0-2.21-3.58-4-8-4z"
        fill="currentColor"
      />
    </svg>
  );

  return (
    <motion.div className="relative flex items-center justify-center">
      {sirenOn ? (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 24 24"
          fill="none"
          className={`relative elimination-siren ${wasPrevious ? "elimination-siren--dim" : ""}`}
          style={
            {
              "--siren-duration": `${flickerDuration}s`,
              "--siren-delay": `${flickerDelay}s`,
            } as CSSProperties
          }
        >
          <circle cx="12" cy="7" r="4" fill="#2563eb" />
          <path
            d="M12 13c-4.42 0-8 1.79-8 4v1h16v-1c0-2.21-3.58-4-8-4z"
            fill="#2563eb"
          />
        </svg>
      ) : (
        resolvedSvg
      )}

      {isNew && showCrossAfterAudio && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0, rotate: -45 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ delay: crossStagger, duration: 0.22, ease: "easeOut" }}
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
      {wasPrevious && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
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
  gridSequenceActive,
  showCrossAfterAudio,
}: {
  totalPlayers: number;
  previouslyEliminated: number;
  newlyEliminated: number;
  gridSequenceActive: boolean;
  showCrossAfterAudio: boolean;
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

  /** Random order for cross stagger after audio (seeded, not sorted by cell index). */
  const crossOrderIndex = useMemo(() => {
    const arr = Array.from(eliminatedIndices.newSet.values());
    let seed = previouslyEliminated * 1009 + newlyEliminated * 503 + arr.length * 17;
    for (let k = arr.length - 1; k > 0; k--) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      const j = seed % (k + 1);
      [arr[k], arr[j]] = [arr[j], arr[k]];
    }
    const map = new Map<number, number>();
    arr.forEach((cellIdx, ord) => map.set(cellIdx, ord));
    return map;
  }, [eliminatedIndices.newSet, previouslyEliminated, newlyEliminated]);

  return (
    <div className="grid grid-cols-10 gap-[3px] max-w-[300px] mx-auto">
      {Array.from({ length: totalPlayers }).map((_, i) => {
        const wasPreviouslyEliminated = eliminatedIndices.previousSet.has(i);
        const isNewlyEliminated = eliminatedIndices.newSet.has(i);

        const ord = crossOrderIndex.get(i) ?? 0;
        const crossStagger = isNewlyEliminated ? Math.min(ord * 0.055, 0.72) : 0;

        return (
          <div key={i} className="aspect-square w-full">
            <PersonIcon
              wasPrevious={wasPreviouslyEliminated}
              isNew={isNewlyEliminated}
              crossStagger={crossStagger}
              iconIndex={i}
              gridSequenceActive={gridSequenceActive}
              showCrossAfterAudio={showCrossAfterAudio}
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
  const { muted: narrationMuted } = useNarration();

  // Sequential reveal for embedded mode:
  //   "grid"   = grid centered, players cross out under the eliminationdecision
  //              audio climax.
  //   "count"  = grid slides LEFT, a big "X eliminated this round" headline
  //              pops in on the RIGHT. Holds ~COUNT_PHASE_MS so the number
  //              lands before the pot scene takes over.
  //   "reveal" = grid + count are GONE; pot fill scene + stats + continue button.
  // The grid element is keyed identically across "grid" and "count" so framer
  // animates its slide from center to left rather than unmount/remount.
  const [phase, setPhase] = useState<"grid" | "count" | "reveal">(embedded ? "grid" : "reveal");
  /** Crosses on new eliminations only after eliminationdecision.wav fires `ended`. */
  const [eliminationAudioEnded, setEliminationAudioEnded] = useState(false);

  // Grid phase: play the LAST 3 seconds of the elimination wav (its dramatic
  // climax), not the calmer build at the start. Animation matches.
  useEffect(() => {
    if (!embedded || phase !== "grid") return;
    setEliminationAudioEnded(false);

    const a = new Audio(ELIMINATION_DECISION_SRC);
    a.loop = false;
    const peakVol = narrationMuted ? 0 : 0.7;
    a.volume = peakVol;
    a.preload = "auto";

    let closed = false;
    let fadeRaf = 0;
    const settle = () => {
      if (closed) return;
      closed = true;
      window.clearTimeout(fallbackId);
      cancelAnimationFrame(fadeRaf);
      setEliminationAudioEnded(true);
      a.pause();
    };

    // Hard cut at GRID_PHASE_MS — settle the visuals even if the seek
    // didn't land exactly on `duration - GRID_PHASE_MS / 1000`.
    const fallbackId = window.setTimeout(settle, GRID_PHASE_MS);
    a.addEventListener("ended", settle);

    // Schedule a tail fade so the wav doesn't end abruptly.
    const fadeStartMs = GRID_PHASE_MS - ELIM_AUDIO_TAIL_FADE_MS;
    const fadeStart = performance.now() + fadeStartMs;
    const fadeEnd = fadeStart + ELIM_AUDIO_TAIL_FADE_MS;
    const tickFade = () => {
      const now = performance.now();
      if (now < fadeStart) {
        fadeRaf = requestAnimationFrame(tickFade);
        return;
      }
      const u = Math.min(1, (now - fadeStart) / ELIM_AUDIO_TAIL_FADE_MS);
      a.volume = peakVol * (1 - u);
      if (now < fadeEnd) {
        fadeRaf = requestAnimationFrame(tickFade);
      }
    };
    fadeRaf = requestAnimationFrame(tickFade);

    // Seek to (duration - GRID_PHASE_MS) so we play only the climax tail.
    const tailSeconds = GRID_PHASE_MS / 1000;
    const startPlayback = () => {
      const dur = a.duration;
      if (isFinite(dur) && dur > tailSeconds) {
        try { a.currentTime = Math.max(0, dur - tailSeconds); } catch { /* */ }
      }
      void a.play().catch(() => {
        /* fall back to fallback timer for visual settle */
      });
    };
    if (a.readyState >= 1 && isFinite(a.duration)) {
      startPlayback();
    } else {
      const onMeta = () => {
        a.removeEventListener("loadedmetadata", onMeta);
        if (!closed) startPlayback();
      };
      a.addEventListener("loadedmetadata", onMeta);
      a.load();
    }

    return () => {
      closed = true;
      window.clearTimeout(fallbackId);
      cancelAnimationFrame(fadeRaf);
      a.removeEventListener("ended", settle);
      a.pause();
      try {
        a.currentTime = 0;
        a.src = "";
      } catch {
        /* ignore */
      }
    };
  }, [embedded, phase, narrationMuted]);

  // Reveal phase: applause at steady volume, then slow fade (clip may be longer than fade).
  useEffect(() => {
    if (!embedded || phase !== "reveal" || narrationMuted) return;
    const a = new Audio(APPLAUSE_SRC);
    a.loop = false;
    const peak = 0.78;
    a.volume = peak;
    let raf = 0;
    let cancelled = false;
    const t0 = performance.now();

    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = now - t0;
      if (elapsed <= APPLAUSE_FULL_VOL_MS) {
        a.volume = peak;
      } else if (elapsed <= APPLAUSE_FULL_VOL_MS + APPLAUSE_FADE_MS) {
        const u = (elapsed - APPLAUSE_FULL_VOL_MS) / APPLAUSE_FADE_MS;
        a.volume = Math.max(0, peak * (1 - u));
      } else {
        a.volume = 0;
        try {
          a.pause();
        } catch {
          /* ignore */
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    void a.play().catch(() => {});
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      a.pause();
      try {
        a.currentTime = 0;
        a.src = "";
      } catch {
        /* ignore */
      }
    };
  }, [embedded, phase, narrationMuted]);

  // grid → count: triggered once the crosses have all landed (which itself
  // is gated on eliminationAudioEnded, set when the wav finishes / fallback
  // fires). The grid then slides left and the headline fades in on the right.
  useEffect(() => {
    if (!embedded || phase !== "grid" || !eliminationAudioEnded) return;
    const maxStaggerSec = Math.min(Math.max(0, eliminated - 1) * 0.055, 0.72);
    const crossResolveMs = Math.round((maxStaggerSec + 0.22 + 0.45) * 1000);
    const t = window.setTimeout(
      () => setPhase("count"),
      Math.max(crossResolveMs, 500) + POST_CROSS_HOLD_MS,
    );
    return () => clearTimeout(t);
  }, [embedded, phase, eliminationAudioEnded, eliminated]);

  // count → reveal: hold long enough for the "X eliminated this round" beat
  // to land, then advance to the pot-fill reveal scene.
  useEffect(() => {
    if (!embedded || phase !== "count") return;
    const t = window.setTimeout(() => setPhase("reveal"), COUNT_PHASE_MS);
    return () => clearTimeout(t);
  }, [embedded, phase]);

  // Safety net: if either of the gated transitions never fires (audio
  // failure, callback drop, etc.), force the user through to "reveal" so
  // they never get stuck on the grid screen.
  useEffect(() => {
    if (!embedded || phase === "reveal") return;
    const safety = window.setTimeout(
      () => setPhase("reveal"),
      GRID_PHASE_MS + COUNT_PHASE_MS + 10_000,
    );
    return () => clearTimeout(safety);
  }, [embedded, phase]);

  const embeddedStatDelay = !embedded || phase === "reveal" ? (embedded ? 380 : 800) : 999000;
  const embeddedPotDelay = !embedded || phase === "reveal" ? (embedded ? 720 : 2200) : 999000;
  const embeddedRemainingDelay = !embedded || phase === "reveal" ? (embedded ? 720 : 2200) : 999000;
  const animatedEliminated = useAnimatedCounter(eliminated, 1200, embeddedStatDelay);
  const animatedPot = useAnimatedCounter(potPrize, 1500, embeddedPotDelay);
  const animatedRemaining = useAnimatedCounter(remainingPlayers, 1200, embeddedRemainingDelay);

  // ── 3D pot coin stack (cumulative across rounds) ───────────────
  // The pot now shows actual coins stacking inside (glass vessel). Map the
  // pot ratio to a visible coin count capped at MAX_VISIBLE_COINS so the
  // stack reads dramatic at full pot but doesn't tank perf.
  // Bumped 80 → 162 to match the new PotFill3D pool (9 coins/layer × 18
  // layers). With this scale a 51L pot ≈ 51% × 162 ≈ 83 coins ≈ 9 layers
  // of fill, which lands at roughly half the pot's inner height — the
  // user's stated "51L = pot half full" target.
  const MAX_VISIBLE_COINS = 162;
  const addedThisRound = eliminated * STAKE_PER_PLAYER;
  const previousPot = Math.max(0, potPrize - addedThisRound);
  const maxPot = totalPlayers * STAKE_PER_PLAYER;
  const previousCoinTotal = Math.round((previousPot / maxPot) * MAX_VISIBLE_COINS);
  const totalAfter = Math.round((potPrize / maxPot) * MAX_VISIBLE_COINS);
  const newCoinsThisRound = Math.max(0, totalAfter - previousCoinTotal);
  // DOM coins flying from the pot up to the navbar pot-prize card.
  const trailCoinCount = Math.min(20, Math.max(8, Math.floor(eliminated / 5) + 6));

  const potWrapperRef = useRef<HTMLDivElement | null>(null);
  // Source ref for the coin trail. Used to be the 3D pot card; now points
  // at the "+ ₹X this round" delta tile so the animation visually reads as
  // "the round's contribution flying up to the navbar pot total".
  const addedBlockRef = useRef<HTMLDivElement | null>(null);
  const [trailTriggerKey, setTrailTriggerKey] = useState<number | null>(null);

  // Fire the trail once the 3D fill is visually settled (after reveal-phase
  // mount + 400ms delay + 1500ms duration ≈ 2s).
  useEffect(() => {
    if (!embedded || phase !== "reveal") return;
    setTrailTriggerKey(null);
    const fireAt = window.setTimeout(() => {
      setTrailTriggerKey(questionNumber);
    }, 2200);
    return () => window.clearTimeout(fireAt);
  }, [embedded, phase, questionNumber]);

  const potFill3DBlock = (
    <motion.div
      ref={potWrapperRef}
      initial={{ opacity: 0, y: 12, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.15, duration: 0.55, ease: EASE_OUT }}
      className="relative rounded-2xl overflow-hidden border-2 border-brass/40 bg-black/55 shadow-[0_0_56px_-10px_rgba(228,207,106,0.5)] w-full min-h-[380px] md:min-h-[420px] flex"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_80%_100%_at_50%_0%,rgba(255,220,140,0.32),transparent_70%)] z-[1]" />

      {/* ─────────────────────────────────────────────────────────────
          3D PotFill3D animation — DISABLED per client request.
          Kept commented so we can re-enable in one step when needed.
          The `previousCoinTotal` / `newCoinsThisRound` derivations
          above are still computed; left in place so a re-enable is
          drop-in (no re-plumbing of props).
      <div className="absolute inset-0">
        <PotFill3D
          previousCoinTotal={previousCoinTotal}
          newCoinsThisRound={newCoinsThisRound}
          playKey={questionNumber}
          durationMs={1500}
          delayMs={400}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
          ───────────────────────────────────────────────────────────── */}

      {/* Replacement text card. Reads the round's contribution in the centre
          and the running pot total as a small chip in the bottom-right corner
          of the same brass-bordered "pot" panel. */}
      <div className="relative z-[2] flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.45, ease: EASE_OUT }}
          className="font-mono text-[10px] uppercase tracking-[0.4em] text-brass-dim mb-4"
        >
          Added this round
        </motion.p>
        <motion.p
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.55, ease: EASE_OUT }}
          className="font-display font-bold leading-none tabular-nums"
          style={{
            fontSize: "clamp(2.4rem, 6.5vw, 4.4rem)",
            backgroundImage:
              "linear-gradient(180deg, #fff1bf 0%, #f5d76e 38%, #c89e2b 70%, #ad841a 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            textShadow: "0 0 28px rgba(245,215,110,0.18)",
          }}
        >
          + {formatRupees(addedThisRound)}
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.45 }}
          className="mt-3 font-mono text-[10px] uppercase tracking-[0.32em] text-foreground/55"
        >
          {eliminated} eliminated × {formatRupees(STAKE_PER_PLAYER)}
        </motion.p>
      </div>

      {/* Small chip — running pot total, bottom-right corner of the panel. */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.45, ease: EASE_OUT }}
        className="absolute bottom-3 right-3 z-[3] rounded-full border border-brass/30 bg-black/55 px-3 py-1.5 backdrop-blur-sm"
      >
        <p className="font-mono text-[9px] uppercase tracking-[0.32em] text-brass-dim">
          Pot total{" "}
          <span className="text-brass-bright tabular-nums font-semibold">
            {formatRupees(potPrize)}
          </span>
        </p>
      </motion.div>
    </motion.div>
  );


  // ───────── Reusable pieces ─────────
  const statusChip = playerGotItRight ? (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", bounce: 0.4, delay: 0.3 }}
      className="flex items-center justify-center gap-0 px-3 py-1.5 rounded-full bg-[var(--success)]/10 border border-[var(--success)]/30"
    >
      <span className="text-[var(--success)] text-[10px] font-semibold uppercase tracking-wider">Survived</span>
    </motion.div>
  ) : (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", bounce: 0.4, delay: 0.3 }}
      className="flex items-center justify-center gap-0 px-3 py-1.5 rounded-full bg-[var(--danger)]/10 border border-[var(--danger)]/30"
    >
      <span className="text-[var(--danger)] text-[10px] font-semibold uppercase tracking-wider">Eliminated</span>
    </motion.div>
  );

  // Grid panel (large, centered) — used ONLY during embedded "grid" phase
  const gridPanelLarge = (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, filter: "blur(4px)" }}
      transition={{ duration: 0.55, ease: EASE_OUT }}
      className="p-5 md:p-6 rounded-2xl bg-black/45 border-2 border-white/[0.1] shadow-[inset_0_0_32px_rgba(0,0,0,0.55)]"
    >
      <div className="w-[min(360px,60vw)]">
        <PlayerGrid
          totalPlayers={totalPlayers}
          previouslyEliminated={previouslyEliminated}
          newlyEliminated={eliminated}
          gridSequenceActive={phase === "grid"}
          showCrossAfterAudio={phase === "grid" ? eliminationAudioEnded : false}
        />
      </div>
      {eliminationAudioEnded && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: EASE_OUT }}
          className="mt-4 text-center font-mono text-sm sm:text-base font-bold uppercase tracking-[0.22em] leading-snug"
        >
          <span className="text-[var(--danger)] tabular-nums font-semibold">{eliminated}</span>
          <span className="text-white"> eliminated this round</span>
        </motion.p>
      )}
    </motion.div>
  );

  const eliminatedCountBlock = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE_OUT }}
      className="relative p-4 rounded-xl overflow-hidden border-2 border-[var(--danger)]/30 bg-[var(--danger)]/[0.06] shadow-[0_0_24px_-4px_rgba(232,72,85,0.18)]"
    >
      <div className="relative z-[1] text-center">
        <motion.span
          className="font-display text-4xl md:text-5xl text-[var(--danger)] tracking-wider leading-none block"
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", bounce: 0.35 }}
        >
          {animatedEliminated}
        </motion.span>
        <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-white font-bold mt-2 opacity-90">
          Eliminated this round
        </p>
      </div>
    </motion.div>
  );

  // Single full-width tile. The pot total is shown inside the pot card so we
  // no longer need a redundant "In the pot" tile here.
  const statsBlock = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.5, ease: EASE_OUT }}
      className="relative p-4 rounded-xl overflow-hidden border-2 border-white/[0.2] bg-white/[0.04]"
    >
      <div className="panel-sheen-wrap">
        <div className="panel-sheen opacity-40" style={{ animationDuration: "3.6s" }} />
      </div>
      <div className="relative z-[1] flex items-center justify-center gap-4">
        <p className="font-mono text-3xl md:text-4xl font-bold text-foreground tabular-nums leading-none">
          {animatedRemaining}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-white/88 font-semibold">
          Still standing
        </p>
      </div>
    </motion.div>
  );

  const continueButton = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.45, ease: EASE_OUT }}
    >
      <motion.button
        onClick={onContinue}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="game-show-btn relative z-0 w-full cursor-pointer rounded-xl py-3.5 text-center text-[13px] font-semibold uppercase tracking-[0.22em]"
      >
        <span className="relative z-10">{isLastQuestion ? "See end screen" : "Next question"}</span>
      </motion.button>
    </motion.div>
  );

  const headerRow = (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE_OUT }}
      className="flex items-center justify-between"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-brass/15 border-2 border-brass/35 flex items-center justify-center shadow-[0_0_12px_rgba(196,160,53,0.2)]">
          <span className="font-display text-[11px] font-semibold text-brass-bright">Q{questionNumber}</span>
        </div>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-white/90 font-semibold">After round</p>
          <p className="text-xs text-foreground/90 font-mono font-semibold">{percentage}% question</p>
        </div>
      </div>
      {statusChip}
    </motion.div>
  );

  // Per-round delta tile — large, brass-rim, primary visual element on the
  // right column. The coin-trail animation fires from this block (not the
  // pot anymore) so the user sees "this round's contribution" physically
  // travel up to the navbar pot total.
  const addedThisRoundBlock = (
    <motion.div
      ref={addedBlockRef}
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.18, duration: 0.55, ease: EASE_OUT }}
      className="relative overflow-hidden rounded-xl border-2 border-brass/55 bg-gradient-to-b from-brass/[0.18] to-brass/[0.04] p-4 shadow-[0_0_28px_-6px_rgba(228,207,106,0.55)]"
    >
      {/* Slow brass shine sweep across the tile to keep it alive while the
          coin trail prepares. */}
      <div className="panel-sheen-wrap">
        <div className="panel-sheen opacity-60" style={{ animationDuration: "3.2s" }} />
      </div>
      <div className="relative z-[1] flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.28em] text-brass-bright/95">
          This round
        </p>
        <motion.p
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.42, type: "spring", bounce: 0.4, duration: 0.6 }}
          className="font-display text-2xl md:text-[28px] font-bold text-brass-bright tabular-nums leading-none"
          style={{
            textShadow:
              "0 0 18px rgba(228,207,106,0.55), 0 2px 0 rgba(0,0,0,0.55)",
          }}
        >
          + {formatRupees(addedThisRound)}
        </motion.p>
      </div>
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
                  <span className="font-display text-xs font-semibold text-brass-bright">Q{questionNumber}</span>
                </div>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-white/90 font-semibold">After round</p>
                  <p className="text-xs text-foreground/90 font-mono font-semibold">{percentage}% question</p>
                </div>
              </div>

              {playerGotItRight ? (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", bounce: 0.4, delay: 0.3 }}
                  className="flex items-center justify-center gap-0 px-3 py-1.5 rounded-full bg-[var(--success)]/8 border border-[var(--success)]/20"
                >
                  <span className="text-[var(--success)] text-[10px] font-semibold uppercase tracking-wider">Survived</span>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", bounce: 0.4, delay: 0.3 }}
                  className="flex items-center justify-center gap-0 px-3 py-1.5 rounded-full bg-[var(--danger)]/8 border border-[var(--danger)]/20"
                >
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
                gridSequenceActive={false}
                showCrossAfterAudio
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
                <span className="text-white font-bold text-[10px] uppercase tracking-[0.2em]">
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
                  <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-white/88 font-semibold mt-0.5">Still standing</p>
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
                  <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-white/80 font-semibold mt-0.5">In the pot</p>
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
                <span className="relative z-10">{isLastQuestion ? "See end screen" : "Next question"}</span>
              </motion.button>
            </motion.div>
          </div>
        </div>
    </div>
  );

  // Embedded mode — STRICT SEQUENTIAL reveal:
  //   Phase 1 "grid":   Only the grid is visible, centered. Players get crossed out.
  //                     NOTHING else is on screen during this phase.
  //   Phase 2 "reveal": Grid is GONE. Details (header + count + stats + next) appear CENTERED, solo.
  //   The user should feel the crosses land, the grid vanish, and THEN the results arrive.
  if (embedded) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full h-full flex items-center justify-center p-4 md:p-6"
      >
        <AnimatePresence mode="wait">
          {/* Phases "grid" and "count" share a single key so the grid
              panel doesn't unmount between them. Layout is a two-column
              row: grid on the LEFT, dramatic 3D shimmery "X eliminated
              this round" headline on the RIGHT during the count phase. */}
          {(phase === "grid" || phase === "count") ? (
            <motion.div
              key="grid-and-count-phase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
              className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 md:gap-12 items-center"
            >
              {/* Grid column — left. During grid phase it spans both
                  columns and centres itself; during count it snaps to
                  just the left column so the right column has room for
                  the big number. The `layout` prop on motion.div smooths
                  the transition into a slide instead of a hard reposition. */}
              <motion.div
                layout
                transition={{ duration: 0.6, ease: EASE_OUT }}
                className={`flex items-center ${
                  phase === "grid"
                    ? "md:col-span-2 justify-center"
                    : "justify-center md:justify-end"
                }`}
              >
                {gridPanelLarge}
              </motion.div>

              {/* Big eliminated headline — RIGHT column. Only mounts during
                  the count phase. Number is rendered with ZText3DDanger so
                  it gets the full 3D extrusion + moving shine sweep that
                  the brass 3D headings on Instructions use. */}
              <AnimatePresence>
                {phase === "count" && (
                  <motion.div
                    key="big-eliminated"
                    initial={{ opacity: 0, x: 36 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.55, ease: EASE_OUT }}
                    className="flex flex-col items-center md:items-start text-center md:text-left"
                  >
                    {/* Spring-bounce wrapper so the number lands like a
                        slam. ZText3DDanger inside provides the 3D depth +
                        side-wall ramp + moving specular highlight. */}
                    <motion.div
                      initial={{ scale: 0.45, opacity: 0, filter: "blur(14px)" }}
                      animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                      transition={{
                        type: "spring",
                        bounce: 0.42,
                        duration: 0.7,
                        delay: 0.1,
                      }}
                      className="font-display font-bold leading-[0.82] tabular-nums"
                      style={{
                        fontSize: "clamp(7rem, 18vw, 13rem)",
                      }}
                    >
                      <ZText3DDanger>{String(eliminated)}</ZText3DDanger>
                    </motion.div>
                    <motion.span
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.5, ease: EASE_OUT }}
                      className="mt-3 font-mono uppercase tracking-[0.32em] text-white/95 font-semibold"
                      style={{
                        fontSize: "clamp(0.78rem, 1.2vw, 1.05rem)",
                        textShadow:
                          "0 1px 0 rgba(0,0,0,0.7), 0 0 18px rgba(232,72,85,0.45), 0 0 36px rgba(232,72,85,0.25)",
                      }}
                    >
                      Eliminated this round
                    </motion.span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="reveal-phase"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-[1.05fr_1fr] gap-5 items-stretch"
            >
              {/* Left column: 3D pot — fills the full column height */}
              <div className="flex">
                {potFill3DBlock}
              </div>
              {/* Right column: header + per-round delta + stats + CTA. The
                  delta tile is the new primary right-column element and the
                  source point for the coin trail to the navbar. */}
              <div className="flex flex-col gap-3.5 justify-between">
                {headerRow}
                {addedThisRoundBlock}
                {statsBlock}
                {continueButton}
              </div>
              <CoinTrailToNavbar
                triggerKey={trailTriggerKey}
                // Coins now arc from the "+ ₹X this round" delta tile up to
                // the navbar pot, so the visual reads as the round's
                // contribution being deposited rather than coins generally
                // leaving the pot.
                sourceRef={addedBlockRef}
                coinCount={trailCoinCount}
              />
            </motion.div>
          )}
        </AnimatePresence>
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

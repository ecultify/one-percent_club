"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QuestionScreen from "./QuestionScreen";
import EliminationReveal from "./EliminationReveal";
import MuteButton from "./MuteButton";
import { useNarration } from "./NarrationProvider";
import ProductTour, { TourStep } from "./ProductTour";
import HostSilhouette from "./HostSilhouette";
import FadeWipe from "./FadeWipe";

const TOUR_STEPS: TourStep[] = [
  {
    targetId: "question-area",
    placement: "bottom",
    kicker: "The question",
    title: "Read the question carefully",
    description:
      "Every round shows one question. Read it slowly — the trick is usually hidden in the wording.",
    voiceText:
      "Yahan aapko sawaal dikhega. Dhyaan se padhiye, kyunki jawab aksar sawaal ke andar hi chupa hota hai.",
    voiceKey: "tour-step-question",
    padding: 14,
  },
  {
    targetId: "options-area",
    placement: "top",
    kicker: "Your answer",
    title: "Pick one of four diamonds",
    description:
      "The four options appear as diamonds. Tap the one you think is correct before time runs out.",
    voiceText:
      "Niche chaar options honge, heere ki shape mein. Sahi wala choose kijiye, time khatam hone se pehle.",
    voiceKey: "tour-step-options",
    padding: 10,
  },
  {
    targetId: "timer",
    placement: "bottom",
    kicker: "The clock",
    title: "Watch the timer",
    description:
      "Every question has a hard time limit. Hesitate too long and the clock will decide for you.",
    voiceText:
      "Yeh rahaa aapka timer. Jaldi sochiye. Waqt khatam, toh aap out.",
    voiceKey: "tour-step-timer",
    padding: 10,
  },
  {
    targetId: "pot-prize",
    placement: "bottom",
    kicker: "The pot",
    title: "Every wrong answer feeds the pot",
    description:
      "Stakes from eliminated players stack up here. Survive to the 1% and this prize could be yours.",
    voiceText:
      "Yeh hai pot prize. Har galat jawab ke saath badhta jaata hai. Jo last tak tikega, wohi jeetega.",
    voiceKey: "tour-step-pot",
    padding: 10,
  },
];

/**
 * Builds the question narration that plays ON the question screen
 * immediately after the intro video ends. Designed to feel like the
 * host is STILL talking — no "Sawaal number X" restarts, no formal
 * restart. Witty openers per question keep the game-show energy alive.
 */
function buildQuestionNarration(q: Question): string {
  const labels = ["A", "B", "C", "D"];
  const optionsText = q.options
    .map((opt, i) => `Option ${labels[i]}: ${opt}.`)
    .join(" ");

  // Per-question witty opener — picks up the thread of the intro video.
  const openers: Record<number, string> = {
    1: "Toh, dhyaan se suniye…",
    2: "Chaliye, calculator side mein rakhiye…",
    3: "Ab zara dimaag khujaiye…",
    4: "Calendar khol ke mat dekhiye, please…",
    5: "Pattern recognition ka waqt hai…",
    6: "Mumbai wale, yeh aapke liye ghar ka sawaal hai…",
    7: "Driving license waale, yeh sawaal aapke liye hai…",
    8: "Aur… lo, aa gaya woh aakhri sawaal…",
  };

  const closers: Record<number, string> = {
    1: "Aasaan lag raha hai? Jaldi kijiye.",
    2: "Paanch chai, aur ek jawaab. Samay shuru.",
    3: "Thoda ajeeb lagega, par jawaab sidha hai. Sochiye.",
    4: "Haan, maine gin liya. Aapne?",
    5: "Simple hai. Par galat bhi ho sakta hai. Clock chal raha hai.",
    6: "Mumbai ki map dimaag mein chala lijiye. Chaliye.",
    7: "Teen baar right… aur phir socha kahan? Samay shuru.",
    8: "Dhyaan se. Bahut dhyaan se. Clock chalu.",
  };

  const opener = openers[q.id] ?? "Toh…";
  const closer = closers[q.id] ?? "Aapka samay shuru hota hai, ab.";

  return `${opener} ${q.question} ${optionsText} ${closer}`;
}

// ── Types ──
export interface Question {
  id: number;
  percentage: number;
  question: string;
  options: string[];
  correctIndex: number;
  timeLimit: number;
}

export interface GameState {
  currentQuestion: number;
  totalPlayers: number;
  remainingPlayers: number;
  potPrize: number;
  stakePerPlayer: number;
  playerAnswers: (number | null)[];
  playerCorrect: boolean[];
  eliminatedThisRound: number[];
  phase: "question-intro" | "question" | "answered" | "elimination" | "final-result";
}

// ── Questions (client-provided, 1% Club India edit) ──
const QUESTIONS: Question[] = [
  {
    id: 1,
    percentage: 90,
    question:
      "A typical Indian traffic signal has three colors. If the red light is on, what should you do?",
    options: ["Go", "Slow down", "Stop", "Honk"],
    correctIndex: 2, // C. Stop
    timeLimit: 30,
  },
  {
    id: 2,
    percentage: 80,
    question: "A chaiwala sells tea at ₹10 per cup. If you buy 5 cups, how much do you pay?",
    options: ["₹40", "₹50", "₹60", "₹45"],
    correctIndex: 1, // B. ₹50
    timeLimit: 30,
  },
  {
    id: 3,
    percentage: 70,
    question: "Which word becomes shorter when you add two letters to it?",
    options: ["Tall", "Short", "Long", "Small"],
    correctIndex: 1, // B. Short
    timeLimit: 30,
  },
  {
    id: 4,
    percentage: 60,
    question: "In a typical Indian week, if today is Wednesday, what day will it be after 3 days?",
    options: ["Friday", "Saturday", "Sunday", "Monday"],
    correctIndex: 1, // B. Saturday
    timeLimit: 30,
  },
  {
    id: 5,
    percentage: 50,
    question: "Find the next number in the series: 2, 4, 8, 16, __",
    options: ["18", "24", "32", "30"],
    correctIndex: 2, // C. 32
    timeLimit: 30,
  },
  {
    id: 6,
    percentage: 30,
    question:
      "You are in Mumbai. You take a local train from Churchgate to Dadar. The train is going north. In which direction is the platform on your right side when you get down at Dadar?",
    options: ["East", "West", "North", "South"],
    correctIndex: 0, // A. East
    timeLimit: 30,
  },
  {
    id: 7,
    percentage: 10,
    question:
      "A man is driving a small car in India. He turns right three times in a row. In which direction is he now moving compared to where he started?",
    options: [
      "Same direction",
      "Opposite direction",
      "Left direction",
      "Cannot be determined",
    ],
    correctIndex: 1, // B. Opposite direction
    timeLimit: 30,
  },
  {
    id: 8,
    percentage: 1,
    question:
      "Following the pattern in these codes, what is the correct code for DELHI? 2N3 → LONDON, 4C5 → BARCELONA, 2O1 → ROME.",
    options: ["2L2", "3L1", "2H2", "1L3"],
    correctIndex: 0, // A. 2L2
    timeLimit: 30,
  },
];

/**
 * Proper 1% Club elimination logic:
 * The percentage represents how many people CAN answer correctly.
 * So (100 - percentage)% of remaining players get eliminated.
 *
 * Expected flow with 100 players:
 *   90% Q → ~10 eliminated  → ~90 remain
 *   80% Q → ~18 eliminated  → ~72 remain
 *   60% Q → ~29 eliminated  → ~43 remain
 *   50% Q → ~22 eliminated  → ~21 remain
 *   30% Q → ~15 eliminated  → ~6 remain
 *   10% Q → ~5 eliminated   → ~1 remain
 *    1% Q → ~1 eliminated   → ~0 remain (but we ensure min 1 for drama)
 *
 * Small variance added so it doesn't feel robotic.
 * Minimum 1 player always survives until the final question reveal.
 */
function simulateEliminations(
  percentage: number,
  remaining: number,
  isLastQuestion: boolean
): number {
  // What fraction gets it WRONG
  const failRate = (100 - percentage) / 100;
  // Small variance: ±10% of the fail rate
  const jitter = 0.9 + Math.random() * 0.2;
  let eliminated = Math.round(remaining * failRate * jitter);

  // Clamp: at least 1 eliminated (if there are players), but always keep at least 1 survivor
  // On the final question, allow eliminating down to 0 (for realism)
  const minSurvivors = isLastQuestion ? 0 : 1;
  eliminated = Math.min(eliminated, remaining - minSurvivors);
  eliminated = Math.max(eliminated, remaining > 1 ? 1 : 0);

  return eliminated;
}

/** Format ₹ amounts: ₹1,00,00,000 → ₹1Cr, ₹11,00,000 → ₹11L */
export function formatRupees(amount: number): string {
  if (amount >= 10000000) {
    const cr = amount / 10000000;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)}Cr`;
  }
  if (amount >= 100000) {
    const l = amount / 100000;
    return `₹${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)}L`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

interface QuizGameProps {
  playerName: string;
  onGameEnd?: (result: { correct: number; total: number; potPrize: number }) => void;
}

export default function QuizGame({ playerName, onGameEnd }: QuizGameProps) {
  const [gameState, setGameState] = useState<GameState>({
    currentQuestion: 0,
    totalPlayers: 100,
    remainingPlayers: 100,
    potPrize: 0,
    stakePerPlayer: 100000, // ₹1 lakh per player → 100 × 1L = ₹1Cr total
    playerAnswers: [],
    playerCorrect: [],
    eliminatedThisRound: [],
    // Start in "question" so QuestionScreen mounts immediately and the
    // ProductTour can find its target elements via data-tour-id selectors.
    // After the tour finishes, handleConfirmReady switches phase to
    // "question-intro" to play the first intro video.
    phase: "question",
  });

  // Right-to-left wipe state — flipped briefly between phase changes
  const [wipeActive, setWipeActive] = useState(false);

  // Tour state:
  //   "prompt"     = initial card, waiting for user to start the tour
  //   "playing"    = step-by-step SaaS tour running
  //   "ready-gate" = tour finished, asking "Ready to start the game?"
  //   "done"       = gameplay running
  const [tourState, setTourState] = useState<
    "prompt" | "playing" | "ready-gate" | "done"
  >("prompt");

  // Reaction video overlay state
  const [reactionVideo, setReactionVideo] = useState<"correct" | "wrong" | "winner" | null>(null);
  const pendingEliminationRef = useRef<{ eliminated: number; addedToPot: number } | null>(null);
  const { narrate, stop, muted } = useNarration();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Narrate each question as it comes up (only after tour is done).
  // Timer stays PAUSED until narration finishes so players actually hear
  // "aapka samay shuru hota hai ab" before the clock starts ticking.
  // Default to TRUE so the timer never has a frame where paused=false on mount.
  const [narratingQuestion, setNarratingQuestion] = useState(true);

  useEffect(() => {
    if (tourState !== "done") return;
    if (gameState.phase !== "question") return;
    const q = QUESTIONS[gameState.currentQuestion];
    if (!q) return;

    let cancelled = false;
    setNarratingQuestion(true);
    narrate(`q-${q.id}`, buildQuestionNarration(q)).then(() => {
      if (!cancelled) setNarratingQuestion(false);
    });

    return () => {
      cancelled = true;
      setNarratingQuestion(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.currentQuestion, gameState.phase, tourState]);

  const handleStartTour = useCallback(() => {
    setTourState("playing");
  }, []);

  const handleFinishTour = useCallback(() => {
    stop();
    setTourState("ready-gate");
  }, [stop]);

  const handleSkipTour = useCallback(() => {
    stop();
    // Skipping still goes through the ready-gate so the user explicitly starts Q1
    setTourState("ready-gate");
  }, [stop]);

  const handleConfirmReady = useCallback(() => {
    stop();
    setTourState("done");
    // Ensure we begin with the first question's intro video
    setGameState(prev => ({ ...prev, phase: "question-intro" }));
  }, [stop]);

  /**
   * Runs a right-to-left wipe, calls `change` to swap underlying content
   * while the screen is black, then clears the wipe. Total blackout ~420ms.
   */
  const runWipeThen = useCallback((change: () => void) => {
    setWipeActive(true);
    // Wipe covers the screen in 500ms. Swap content at 420ms (while black).
    setTimeout(() => { change(); }, 420);
    // Clear the wipe (it slides out left) at 560ms total.
    setTimeout(() => { setWipeActive(false); }, 560);
  }, []);

  // Question intro video handlers
  const handleQuestionIntroEnd = useCallback(() => {
    // Wipe then swap to question phase
    runWipeThen(() => {
      setGameState(prev => ({ ...prev, phase: "question" }));
    });
  }, [runWipeThen]);

  // Narrate the ready-gate prompt once when it opens
  useEffect(() => {
    if (tourState === "ready-gate") {
      narrate(
        "ready-gate",
        "Toh kya aap taiyaar hain The One Percent Club ka hissa banne ke liye? " +
          "Click karke pehla sawaal shuroo kijiye.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourState]);

  const currentQ = QUESTIONS[gameState.currentQuestion];
  const isLastQ = gameState.currentQuestion >= QUESTIONS.length - 1;

  const handleAnswer = useCallback((selectedIndex: number) => {
    const q = QUESTIONS[gameState.currentQuestion];
    const isCorrect = selectedIndex === q.correctIndex;
    const lastQ = gameState.currentQuestion >= QUESTIONS.length - 1;
    const eliminated = simulateEliminations(q.percentage, gameState.remainingPlayers, lastQ);
    const addedToPot = eliminated * gameState.stakePerPlayer;

    setGameState(prev => ({
      ...prev,
      phase: "answered",
      playerAnswers: [...prev.playerAnswers, selectedIndex],
      playerCorrect: [...prev.playerCorrect, isCorrect],
    }));

    // Stop any narration, queue elimination data, wait 2s, then wipe and play reaction
    stop();
    pendingEliminationRef.current = { eliminated, addedToPot };
    const reaction: "winner" | "correct" | "wrong" =
      isCorrect && lastQ ? "winner" : isCorrect ? "correct" : "wrong";
    setTimeout(() => {
      runWipeThen(() => setReactionVideo(reaction));
    }, 2000);
  }, [gameState.currentQuestion, gameState.remainingPlayers, gameState.stakePerPlayer, stop, runWipeThen]);

  const handleTimeUp = useCallback(() => {
    const q = QUESTIONS[gameState.currentQuestion];
    const lastQ = gameState.currentQuestion >= QUESTIONS.length - 1;
    const eliminated = simulateEliminations(q.percentage, gameState.remainingPlayers, lastQ);
    const addedToPot = eliminated * gameState.stakePerPlayer;

    setGameState(prev => ({
      ...prev,
      phase: "answered",
      playerAnswers: [...prev.playerAnswers, null],
      playerCorrect: [...prev.playerCorrect, false],
    }));

    // Time up is always "wrong" reaction, same 2s + wipe flow
    stop();
    pendingEliminationRef.current = { eliminated, addedToPot };
    setTimeout(() => {
      runWipeThen(() => setReactionVideo("wrong"));
    }, 2000);
  }, [gameState.currentQuestion, gameState.remainingPlayers, gameState.stakePerPlayer, stop, runWipeThen]);

  const handleReactionVideoEnd = useCallback(() => {
    const pending = pendingEliminationRef.current;
    pendingEliminationRef.current = null;
    // Wipe from reaction video back to the question screen with elimination overlay
    runWipeThen(() => {
      setReactionVideo(null);
      if (pending) {
        setGameState(prev => ({
          ...prev,
          phase: "elimination",
          remainingPlayers: prev.remainingPlayers - pending.eliminated,
          potPrize: prev.potPrize + pending.addedToPot,
          eliminatedThisRound: [...prev.eliminatedThisRound, pending.eliminated],
        }));
      }
    });
  }, [runWipeThen]);

  const handleSkipReactionVideo = useCallback(() => {
    handleReactionVideoEnd();
  }, [handleReactionVideoEnd]);

  const handleContinue = useCallback(() => {
    const nextQ = gameState.currentQuestion + 1;
    if (nextQ >= QUESTIONS.length) {
      runWipeThen(() => {
        setGameState(prev => ({ ...prev, phase: "final-result" }));
      });
      const correct = gameState.playerCorrect.filter(Boolean).length;
      onGameEnd?.({ correct, total: QUESTIONS.length, potPrize: gameState.potPrize });
    } else {
      // Wipe to next question's intro video
      runWipeThen(() => {
        setGameState(prev => ({
          ...prev,
          currentQuestion: nextQ,
          phase: "question-intro",
        }));
      });
    }
  }, [gameState.currentQuestion, gameState.playerCorrect, gameState.potPrize, onGameEnd, runWipeThen]);

  // Calculate cumulative previously eliminated (all rounds before the last entry)
  const previouslyEliminated = gameState.eliminatedThisRound
    .slice(0, -1)
    .reduce((sum, n) => sum + n, 0);

  // Final result screen
  if (gameState.phase === "final-result") {
    const correct = gameState.playerCorrect.filter(Boolean).length;
    const lastCorrectIndex = gameState.playerCorrect.lastIndexOf(true);
    const reachedPercentage = lastCorrectIndex >= 0 ? QUESTIONS[lastCorrectIndex].percentage : 0;

    return (
      <FinalResult
        playerName={playerName}
        correctCount={correct}
        totalQuestions={QUESTIONS.length}
        potPrize={gameState.potPrize}
        remainingPlayers={gameState.remainingPlayers}
        reachedPercentage={reachedPercentage}
      />
    );
  }

  const reactionVideoSrc =
    reactionVideo === "correct"
      ? "/reaction-correct.mp4"
      : reactionVideo === "wrong"
      ? "/reaction-wrong.mp4"
      : reactionVideo === "winner"
      ? "/reaction-winner.mp4"
      : null;

  const questionIntroVideoSrc = `/questionvideos/${[
    "1stquestion",
    "2ndquestion",
    "3rdquestion",
    "4thquestion",
    "5thquestion",
    "6thquestion",
    "7thquestion",
    "8thquestion",
  ][gameState.currentQuestion] ?? "1stquestion"}.mp4`;

  return (
    <div className="w-full h-full relative">
      <MuteButton />

      {/* ━━ Right-to-left wipe (between phases) ━━ */}
      <FadeWipe active={wipeActive} />

      {/* ━━ Question Intro Video (plays before the question screen) ━━ */}
      <AnimatePresence>
        {gameState.phase === "question-intro" && tourState === "done" && (
          <motion.div
            key={`intro-${gameState.currentQuestion}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[70] bg-black flex items-center justify-center"
          >
            <video
              key={questionIntroVideoSrc}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted={muted}
              onEnded={handleQuestionIntroEnd}
              onError={handleQuestionIntroEnd}
              src={questionIntroVideoSrc}
            />
            <button
              onClick={handleQuestionIntroEnd}
              className="absolute bottom-6 right-6 md:bottom-8 md:right-8 z-10 rounded-full bg-black/65 backdrop-blur-md border border-white/15 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.25em] text-foreground/85 hover:text-foreground hover:border-brass/35 hover:bg-black/80 transition-colors"
            >
              Skip ▸
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━ Reaction Video Overlay (plays on correct/wrong/winner) ━━ */}
      <AnimatePresence>
        {reactionVideoSrc && (
          <motion.div
            key={`reaction-${reactionVideo}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-0 z-[75] bg-black flex items-center justify-center"
          >
            <video
              key={reactionVideoSrc}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted={muted}
              onEnded={handleReactionVideoEnd}
              onError={handleReactionVideoEnd}
              src={reactionVideoSrc}
            />
            {/* Skip button */}
            <button
              onClick={handleSkipReactionVideo}
              className="absolute bottom-6 right-6 md:bottom-8 md:right-8 z-10 rounded-full bg-black/65 backdrop-blur-md border border-white/15 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.25em] text-foreground/85 hover:text-foreground hover:border-brass/35 hover:bg-black/80 transition-colors"
            >
              Skip ▸
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━ Guided Tour Prompt (shows before tour starts) ━━ */}
      <AnimatePresence>
        {tourState === "prompt" && (
          <motion.div
            key="guided-tour-prompt"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="relative w-full max-w-md rounded-2xl border-2 border-brass/25 bg-gradient-to-b from-surface-light/95 to-surface/95 p-8 md:p-10 shadow-[0_40px_100px_-24px_rgba(0,0,0,0.75)]"
            >
              <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-brass-bright/70 to-transparent" />
              <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-brass-dim mb-4">
                Guided tour
              </p>
              <h3 className="font-display text-2xl md:text-[1.75rem] font-semibold text-foreground mb-4 leading-tight">
                Pehle, ek quick tour
              </h3>
              <p className="text-sm text-foreground/70 leading-relaxed mb-8">
                Main aapko quickly dikha deta hoon ki yeh game kaise khelna hai. Click below to
                begin, or skip straight to the first question.
              </p>
              <div className="space-y-3">
                <button
                  onClick={handleStartTour}
                  className="w-full cursor-pointer rounded-xl bg-brass py-4 text-center text-[13px] font-semibold uppercase tracking-[0.2em] text-[#14110a] transition-colors hover:bg-brass-bright"
                >
                  Ready, start the tour
                </button>
                <button
                  onClick={handleSkipTour}
                  className="w-full cursor-pointer rounded-xl bg-white/[0.03] border border-white/[0.08] py-3 text-center text-[11px] font-mono uppercase tracking-[0.28em] text-muted hover:text-foreground/80 hover:border-white/15 transition-colors"
                >
                  Skip tour
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ━━ SaaS-style Product Tour (spotlight + tooltip per step) ━━ */}
      {tourState === "playing" && (
        <ProductTour
          steps={TOUR_STEPS}
          onFinish={handleFinishTour}
          onSkip={handleSkipTour}
        />
      )}

      {/* ━━ Ready Gate (tour complete, confirm before Q1 starts) ━━ */}
      <AnimatePresence>
        {tourState === "ready-gate" && (
          <motion.div
            key="ready-gate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[72] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            {/* Host silhouette ambient behind gate */}
            <HostSilhouette side="right" opacity={0.16} />

            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="relative w-full max-w-md rounded-2xl border-2 border-brass/30 bg-gradient-to-b from-surface-light/95 to-surface/95 p-8 md:p-10 shadow-[0_40px_100px_-24px_rgba(0,0,0,0.75),0_0_60px_-10px_rgba(196,160,53,0.25)] text-center"
            >
              <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-transparent via-brass-bright/80 to-transparent" />

              {/* Brass glow */}
              <div className="absolute -inset-8 rounded-[2rem] bg-brass/[0.07] blur-3xl pointer-events-none" />

              <div className="relative">
                <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-brass-dim mb-5">
                  Tour complete
                </p>
                <div className="mx-auto mb-6 h-px w-16 bg-gradient-to-r from-transparent via-brass/60 to-transparent" />

                <h3 className="font-display text-3xl md:text-[2rem] font-semibold text-foreground leading-tight mb-4">
                  Ready to play?
                </h3>
                <p className="text-sm text-foreground/70 leading-relaxed mb-8 max-w-sm mx-auto">
                  The clock starts the moment you click below. First question is 90% &mdash; most
                  of India gets it right. Don&rsquo;t be the outlier.
                </p>

                <div className="space-y-3">
                  <motion.button
                    onClick={handleConfirmReady}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full cursor-pointer rounded-xl bg-brass py-4 text-center text-[13px] font-semibold uppercase tracking-[0.25em] text-[#14110a] transition-colors hover:bg-brass-bright shadow-[0_20px_50px_-15px_rgba(196,160,53,0.5)]"
                  >
                    Start question 1
                  </motion.button>
                  <button
                    onClick={() => {
                      stop();
                      setTourState("playing");
                    }}
                    className="w-full cursor-pointer rounded-xl bg-white/[0.03] border border-white/[0.08] py-3 text-center text-[11px] font-mono uppercase tracking-[0.28em] text-muted hover:text-foreground/80 hover:border-white/15 transition-colors"
                  >
                    Replay tour
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {(gameState.phase === "question" || gameState.phase === "answered" || gameState.phase === "elimination") && (
          <QuestionScreen
            key={`q-${gameState.currentQuestion}`}
            question={currentQ}
            questionNumber={gameState.currentQuestion + 1}
            totalQuestions={QUESTIONS.length}
            potPrize={gameState.potPrize}
            remainingPlayers={gameState.remainingPlayers}
            totalPlayers={gameState.totalPlayers}
            playerName={playerName}
            onAnswer={handleAnswer}
            onTimeUp={handleTimeUp}
            answered={gameState.phase === "answered" || gameState.phase === "elimination"}
            selectedAnswer={gameState.playerAnswers[gameState.currentQuestion] ?? null}
            isCorrect={gameState.playerCorrect[gameState.currentQuestion] ?? false}
            paused={tourState !== "done" || narratingQuestion}
            afterRoundOverlay={
              gameState.phase === "elimination" ? (
                <EliminationReveal
                  embedded
                  questionNumber={gameState.currentQuestion + 1}
                  percentage={currentQ.percentage}
                  eliminated={gameState.eliminatedThisRound[gameState.eliminatedThisRound.length - 1] || 0}
                  remainingPlayers={gameState.remainingPlayers}
                  totalPlayers={gameState.totalPlayers}
                  potPrize={gameState.potPrize}
                  playerGotItRight={gameState.playerCorrect[gameState.currentQuestion] ?? false}
                  isLastQuestion={isLastQ}
                  onContinue={handleContinue}
                  previouslyEliminated={previouslyEliminated}
                />
              ) : undefined
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Final Result Component ──
function FinalResult({
  playerName,
  correctCount,
  totalQuestions,
  potPrize,
  remainingPlayers,
  reachedPercentage,
}: {
  playerName: string;
  correctCount: number;
  totalQuestions: number;
  potPrize: number;
  remainingPlayers: number;
  reachedPercentage: number;
}) {
  const isWinner = correctCount === totalQuestions;
  const shareOfPot = isWinner ? Math.round(potPrize / Math.max(remainingPlayers, 1)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="w-full h-full flex items-center justify-center relative overflow-hidden"
    >
      {/* ━━ Atmospheric Background ━━ */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Winner: golden radiance / Loser: muted red */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full"
          style={{
            background: isWinner
              ? "radial-gradient(circle, rgba(196,160,53,0.11) 0%, rgba(196,160,53,0.04) 42%, transparent 72%)"
              : "radial-gradient(circle, rgba(217,74,92,0.07) 0%, transparent 60%)",
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
        {/* Top spotlight */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px]"
          style={{
            background: "radial-gradient(ellipse at 50% 0%, rgba(196,160,53,0.05) 0%, transparent 72%)",
          }}
        />
        {/* Grain */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="relative max-w-md w-full mx-4">
        {/* Winner glow pulse */}
        {isWinner && (
          <motion.div
            className="absolute -inset-16 rounded-full blur-[80px]"
            style={{ background: "radial-gradient(circle, rgba(196,160,53,0.14), transparent)" }}
            animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        <div className="relative">
          <div className="relative rounded-2xl border border-white/[0.07] bg-gradient-to-b from-surface-light/95 to-surface/95 p-7 md:p-8 overflow-hidden text-center shadow-[0_40px_100px_-24px_rgba(0,0,0,0.75)] backdrop-blur-sm">
            <div className="absolute inset-0 opacity-[0.018] pointer-events-none mix-blend-overlay"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
              }}
            />
            <div className={`absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent ${isWinner ? "via-brass-bright/50" : "via-brass/35"} to-transparent`} />

            {/* ── Result Title ── */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
              className="relative"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.45em] text-brass-dim mb-4">Game over</p>

              {isWinner ? (
                <h2 className="font-display text-5xl md:text-6xl font-semibold tracking-[-0.03em] text-brass-bright">
                  Champion
                </h2>
              ) : (
                <h2 className="font-display text-5xl md:text-6xl font-semibold tracking-[-0.03em] text-foreground">
                  Top {reachedPercentage}%
                </h2>
              )}

              <p className="text-muted text-sm mt-2">{playerName}</p>
            </motion.div>

            {/* ── Stats Grid ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              className="relative mt-7 grid grid-cols-3 gap-2"
            >
              <div className="p-3 rounded-xl bg-black/20 border border-white/[0.06]">
                <p className="font-mono text-xl font-bold text-brass tabular-nums">{correctCount}/{totalQuestions}</p>
                <p className="font-mono text-[8px] text-muted uppercase tracking-[0.18em] mt-1">Correct</p>
              </div>
              <div className="p-3 rounded-xl bg-black/20 border border-white/[0.06]">
                <p className="font-mono text-xl font-bold text-brass tabular-nums">{remainingPlayers}</p>
                <p className="font-mono text-[8px] text-muted uppercase tracking-[0.18em] mt-1">Survived</p>
              </div>
              <div className="relative p-3 rounded-xl overflow-hidden border border-brass/15 bg-brass/[0.06]">
                <div className="relative">
                  <p className="font-mono text-xl font-bold text-brass-bright tabular-nums">{formatRupees(potPrize)}</p>
                  <p className="font-mono text-[8px] text-brass-dim uppercase tracking-[0.18em] mt-1">In the pot</p>
                </div>
              </div>
            </motion.div>

            {/* ── Winner: Share of Pot ── */}
            {isWinner && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                className="relative mt-5 p-4 rounded-xl border border-brass/20 bg-brass/[0.07]"
              >
                <p className="font-mono text-[10px] text-brass-dim uppercase tracking-[0.35em] mb-2">Your share</p>
                <p className="font-display text-4xl font-semibold text-brass-bright tracking-[-0.02em]">{formatRupees(shareOfPot)}</p>
              </motion.div>
            )}

            {/* ── Loser: Progress Message ── */}
            {!isWinner && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                className="mt-5 p-4 rounded-xl bg-black/20 border border-white/[0.06]"
              >
                <p className="text-foreground/70 text-sm leading-relaxed">
                  You reached the <span className="text-brass-bright font-semibold">{reachedPercentage}%</span> bracket.
                </p>
                <p className="text-muted text-xs mt-2">Seven rounds separate the crowd from the club.</p>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}


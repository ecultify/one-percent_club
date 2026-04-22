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
import { useVideoAutoplay } from "@/lib/useVideoAutoplay";

const Q1_RX = "/questionrxns/question1";

const QUESTION_INTRO_FILES = [
  "1stquestion",
  "2ndquestion",
  "3rdquestion",
  "4thquestion",
  "5thquestion",
  "6thquestion",
  "7thquestion",
  "8thquestion",
] as const;

const SFX_CORRECT = encodeURI("/sound/644963__craigscottuk__quiz-gameshow-correct-ping-14.mp3");
const SFX_WRONG = encodeURI("/sound/131657__bertrof__game-sound-wrong.wav");
/** Bed for the live countdown (clip is ~30s; looped so it covers the full 45s limit). */
const SFX_QUESTION_TIMER = encodeURI("/sound/ITV's _ The 1 club - 30 Second Timer.mp3");
/** ~2s VO: plays once when **13s** remain (3s before the last-10s tick SFX). */
const TIMER_VO_SRC = encodeURI("/sound/timerVO.mp3");

function playQuizSfx(kind: "correct" | "wrong", muted: boolean) {
  if (muted) return;
  const a = new Audio(kind === "correct" ? SFX_CORRECT : SFX_WRONG);
  a.volume = kind === "correct" ? 0.72 : 0.55;
  void a.play().catch(() => {});
}

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
/** Pre-recorded VO in `public/sound/q{N}VO.mp3` (sync with QUESTIONS ids). */
function questionVoSrc(id: number): string | null {
  if (id >= 1 && id <= 8) return `/sound/q${id}VO.mp3`;
  return null;
}

function buildQuestionNarration(q: Question): string {
  const labels = ["A", "B", "C", "D"];
  const optionsText = q.imagesAreOptions
    ? "Tap the photograph you mean."
    : q.options.map((opt, i) => `Option ${labels[i]}: ${opt}.`).join(" ");

  // Per-question witty Hinglish opener — picks up the thread of the intro video.
  const openers: Record<number, string> = {
    1: "Toh pehla sawaal — zara dhyaan se dekho. Chaar animals hain screen par — Bat, Cricket, Cock, Duck.",
    2: "Chaliye, ek picture puzzle. Ginna shuroo kijiye.",
    3: "Ab zara ghor se dekhiye. Teen photographs — Gandhiji ki. Lekin ek mein kuchh gadbad hai.",
    4: "Pattern recognition ka waqt. Shabdon ki line dhyaan se dekhiye — Hot, Hard, Small, Cold, Easy, aur phir ek question mark.",
    5: "Chaar words. Chaar mein se teen ek pattern follow karte hain, ek nahin. Sochiye kaunsa.",
    6: "Chaar vehicles screen par hain, alphabetical order mein. Unhe passenger capacity ke hisaab se kam-se-zyaada rearrange kijiye.",
    7: "Kyaal se sochiye. Calendar logic. Satmohan ki lucky shirt kab aati hai pehan mein?",
    8: "Aur… lo, aa gaya woh aakhri sawaal. Letters ko ulta padh ke dekhiye.",
  };

  const closers: Record<number, string> = {
    1: "Aasaan lag raha hai? Jaldi kijiye.",
    2: "Paanch second lagayenge ya das? Samay shuru.",
    3: "Thoda ajeeb lagega, par jawaab aapki aankhon ke saamne hai.",
    4: "Pattern dikha? Ab answer chuniye.",
    5: "Simple hai. Par galat bhi ho sakta hai. Clock chal raha hai.",
    6: "Dimaag ki map chalaaiye. Chaliye.",
    7: "Pehla Friday kaunsa hai? Ginna shuru.",
    8: "Dhyaan se. Bahut dhyaan se. Clock chalu.",
  };

  const opener = openers[q.id] ?? "Toh…";
  const closer = closers[q.id] ?? "Aapka samay shuru hota hai, ab.";

  return `${opener} ${q.question} ${optionsText} ${closer}`;
}

// ── Types ──
export interface LabelGlyph {
  /** Letter label rendered on the tile ("A", "B", "C", "D") */
  letter: string;
  /** Caption under the tile (e.g. "Bat", "Cricket") */
  caption: string;
}

export interface Question {
  id: number;
  percentage: number;
  question: string;
  options: string[];
  correctIndex: number;
  timeLimit: number;
  /** Single image shown above the question text (centered, golden rim). */
  image?: string;
  /** Row of images shown above the question text, each in a golden rim. */
  images?: string[];
  /** When true, images are the only answers (no diamond option row); tap image i → option i. */
  imagesAreOptions?: boolean;
  /** Smaller fixed row of images (e.g. Q6 — four vehicles) to save vertical space. */
  compactImageRow?: boolean;
  /** Optional caption per image in `images` (e.g. "1", "2", "3"). */
  imageCaptions?: string[];
  /** Row of glyph tiles (emoji placeholders) — used when picture options are
   *  referenced in the question (e.g. Q1: A-Bat, B-Cricket, C-Cock, D-Duck). */
  labelGlyphs?: LabelGlyph[];
  /** Row of chip-style word labels rendered between the question and the
   *  options. Used for Q4 — the "Hot · Hard · Small · Cold · Easy · ?" pattern
   *  sequence shown as distinct word chips. */
  wordSequence?: string[];
  /** Large letter puzzle block rendered between the question and the options.
   *  Used for Q8 — e.g. "TNECREPE _ _" shown in oversized monospace letters so
   *  the reversed-phrase puzzle reads clearly. */
  wordPuzzle?: string;
  /** If true, ANY selected option is treated as correct. Used for subjective /
   *  trick questions (e.g. Q3 — "which Gandhi photo can't be real"). */
  acceptAny?: boolean;
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
    // Q1 — four animal tiles above the question. User picks which tile(s)
    // share their name with a sport. Correct text-option is "B" (Cricket).
    question: "Which of these animals share their name with a sport?",
    labelGlyphs: [
      { letter: "A", caption: "Bat" },
      { letter: "B", caption: "Cricket" },
      { letter: "C", caption: "Cock" },
      { letter: "D", caption: "Duck" },
    ],
    options: ["AB", "BC", "DA", "B"],
    correctIndex: 3, // D — the lone "B", i.e. just Cricket
    timeLimit: 45,
  },
  {
    id: 2,
    percentage: 80,
    // Q2 — single group image (cards vs. glasses). User counts and picks.
    question: "Count carefully — which are there more of in the picture?",
    image: "/questionscreenimages/question2/question2group-ezremove.png",
    options: ["Cards", "Glasses", "Both are equal"],
    correctIndex: 0, // A — Cards
    timeLimit: 45,
  },
  {
    id: 3,
    percentage: 70,
    // Q3 — 3 Gandhi photos in a row, one is anachronistic (mobile phone).
    // Subjective — any answer is accepted so we don't penalise observers.
    question: "Which photograph of Gandhiji cannot be real?",
    images: [
      "/questionscreenimages/question3/gandhjiaccurate1-ezremove.png",
      "/questionscreenimages/question3/gandhijiinaccurate-ezremove.png",
      "/questionscreenimages/question3/gandhjiaccurate2-ezremove.png",
    ],
    imageCaptions: ["1", "2", "3"],
    imagesAreOptions: true,
    options: ["Photo 1", "Photo 2", "Photo 3"],
    correctIndex: 1,
    acceptAny: true,
    timeLimit: 45,
  },
  {
    id: 4,
    percentage: 60,
    // Q4 — word-pair pattern. The sequence "Hot, Hard, Small, Cold, Easy, ?"
    // renders as a dedicated chip row (wordSequence) between question and
    // options. Only 3 options per the screenshot. Correct = A. Big.
    question: "What replaces the question mark in this sequence?",
    wordSequence: ["Hot", "Hard", "Small", "Cold", "Easy", "?"],
    options: ["Big", "Fast", "Slow"],
    correctIndex: 0, // A — Big
    timeLimit: 45,
  },
  {
    id: 5,
    percentage: 50,
    // Q5 — word puzzle. Remove 1st letter → 4-letter word. Remove new 1st
    // letter → 3-letter word. STONE→TONE→ONE ✓, CHAIR→HAIR→AIR ✓,
    // GRATE→RATE→ATE ✓, PINCH→INCH→NCH ✗. Odd one out = PINCH.
    question:
      "Remove the first letter to get a 4-letter word, then remove the new first letter to get a 3-letter word. Which word does NOT follow the pattern?",
    options: ["STONE", "CHAIR", "GRATE", "PINCH"],
    correctIndex: 3, // D — PINCH
    timeLimit: 45,
  },
  {
    id: 6,
    percentage: 30,
    // Q6 — transport ordering (autorickshaw, bus, cycle, local train).
    // Four modes shown alphabetically; user rearranges by passenger count
    // (low → high) and reports how many stay in the same position.
    question:
      "Four modes of transport are arranged below alphabetically. If you rearrange them from lowest to highest by the number of passengers they typically carry, how many will stay in the same place?",
    images: [
      "/questionscreenimages/question6/auto-ezremove.png",
      "/questionscreenimages/question6/bus-ezremove.png",
      "/questionscreenimages/question6/cycle-ezremove.png",
      "/questionscreenimages/question6/localtrain-ezremove.png",
    ],
    imageCaptions: ["Autorickshaw", "Bus", "Cycle", "Local train"],
    compactImageRow: true,
    options: ["1", "2", "3"],
    correctIndex: 1, // B — exactly 2 stay in place
    timeLimit: 45,
  },
  {
    id: 7,
    percentage: 10,
    // Q7 — Satmohan shirt / calendar logic puzzle.
    question:
      "Satmohan wears his lucky shirt on the first Friday of every month. If the first day of May is a Thursday, when does he next wear it?",
    image: "/questionscreenimages/question7/shirt-ezremove.png",
    options: [
      "Thursday 1st May",
      "Saturday 3rd May",
      "Friday 2nd May",
      "Monday 5th May",
    ],
    correctIndex: 2, // C — Friday 2nd May
    timeLimit: 45,
  },
  {
    id: 8,
    percentage: 1,
    // Q8 — TNECREPE is "ONE PERCENT" reversed, truncated to first 8 letters.
    // Appending "NO" gives the full reversal: TNECREPENO → ONEPERCENT.
    // wordPuzzle renders the letters in a large dedicated block so the
    // reversed phrase reads at a glance.
    question:
      "TNECREPE is the beginning of a reversed phrase. Which two letters complete it?",
    wordPuzzle: "TNECREPE _ _",
    options: ["RC", "AR", "NO", "TE"],
    correctIndex: 2, // C — NO (completes ONE PERCENT reversed)
    timeLimit: 45,
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
  /** Fires true when a full-screen video overlay (question-intro, reaction) is
   *  active, false when none are. Lets the parent hide the 3D logo so it
   *  can't peek through the video's fade-in/out transitions. */
  onVideoOverlayChange?: (active: boolean) => void;
  /** Fires true when the question-screen countdown is actively ticking (tour
   *  done, narration finished, not yet answered). Lets the parent pause the
   *  theme music so the ITV 30-second timer jingle takes the sonic stage. */
  onQuestionTimerActiveChange?: (active: boolean) => void;
  /** True from answer submitted through elimination (until Next question); pauses BGM. */
  onEliminationSequenceActiveChange?: (active: boolean) => void;
}

export default function QuizGame({
  playerName,
  onGameEnd,
  onVideoOverlayChange,
  onQuestionTimerActiveChange,
  onEliminationSequenceActiveChange,
}: QuizGameProps) {
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
  const { narrate, narrateUrl, stop, muted } = useNarration();

  // Refs for the two full-screen video overlays. Used by useVideoAutoplay below
  // to retry play() across canplay / stalled / waiting / visibilitychange — the
  // bare `autoPlay` attribute fails silently on reload + bfcache cases, which
  // was the root cause of "the next video doesn't play sometimes after reload".
  const introVideoRef = useRef<HTMLVideoElement | null>(null);
  const reactionVideoRef = useRef<HTMLVideoElement | null>(null);

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
    const delayMs = 2000;
    const delayId = window.setTimeout(() => {
      if (cancelled) return;
      const vo = questionVoSrc(q.id);
      const done = vo
        ? narrateUrl(`q-${q.id}-vo`, vo)
        : narrate(`q-${q.id}`, buildQuestionNarration(q));
      void done.then(() => {
        if (!cancelled) setNarratingQuestion(false);
      });
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(delayId);
      stop();
      setNarratingQuestion(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.currentQuestion, gameState.phase, tourState, stop]);

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

  /** Prevents double transition (Q1 timer + onEnded, or skip + timer). */
  const questionIntroDoneRef = useRef(false);

  // Question intro video handlers
  const handleQuestionIntroEnd = useCallback(() => {
    if (questionIntroDoneRef.current) return;
    questionIntroDoneRef.current = true;
    runWipeThen(() => {
      setGameState(prev => ({ ...prev, phase: "question" }));
    });
  }, [runWipeThen]);

  useEffect(() => {
    if (gameState.phase === "question-intro" && tourState === "done") {
      questionIntroDoneRef.current = false;
    }
  }, [gameState.phase, gameState.currentQuestion, tourState]);

  /** Q1 intro is 10s; transition (fade/wipe) at 7s — do not wait for full clip. */
  useEffect(() => {
    if (gameState.phase !== "question-intro" || tourState !== "done") return;
    if (gameState.currentQuestion !== 0) return;
    const id = window.setTimeout(() => handleQuestionIntroEnd(), 7000);
    return () => clearTimeout(id);
  }, [gameState.phase, gameState.currentQuestion, tourState, handleQuestionIntroEnd]);

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
    // acceptAny = subjective / trick question → any chosen answer counts as correct.
    const isCorrect = q.acceptAny ? true : selectedIndex === q.correctIndex;
    const lastQ = gameState.currentQuestion >= QUESTIONS.length - 1;
    const eliminated = simulateEliminations(q.percentage, gameState.remainingPlayers, lastQ);
    const addedToPot = eliminated * gameState.stakePerPlayer;

    setGameState(prev => ({
      ...prev,
      phase: "answered",
      playerAnswers: [...prev.playerAnswers, selectedIndex],
      playerCorrect: [...prev.playerCorrect, isCorrect],
    }));

    playQuizSfx(isCorrect ? "correct" : "wrong", muted);

    // Stop any narration, queue elimination data, wait 2s, then wipe and play reaction
    stop();
    pendingEliminationRef.current = { eliminated, addedToPot };
    const reaction: "winner" | "correct" | "wrong" =
      isCorrect && lastQ ? "winner" : isCorrect ? "correct" : "wrong";
    setTimeout(() => {
      runWipeThen(() => setReactionVideo(reaction));
    }, 2000);
  }, [gameState.currentQuestion, gameState.remainingPlayers, gameState.stakePerPlayer, stop, runWipeThen, muted]);

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

    playQuizSfx("wrong", muted);

    // Time up is always "wrong" reaction, same 2s + wipe flow
    stop();
    pendingEliminationRef.current = { eliminated, addedToPot };
    setTimeout(() => {
      runWipeThen(() => setReactionVideo("wrong"));
    }, 2000);
  }, [gameState.currentQuestion, gameState.remainingPlayers, gameState.stakePerPlayer, stop, runWipeThen, muted]);

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

  const reactionVideoSrc =
    reactionVideo == null
      ? null
      : (() => {
          const qIdx = gameState.currentQuestion;
          if (qIdx === 0) {
            if (reactionVideo === "correct") return `${Q1_RX}/q1correctvid.mp4`;
            if (reactionVideo === "wrong") return `${Q1_RX}/q1wrongvid.mp4`;
          }
          if (reactionVideo === "correct") return "/reaction-correct.mp4";
          if (reactionVideo === "wrong") return "/reaction-wrong.mp4";
          return "/reaction-winner.mp4";
        })();

  const questionIntroVideoSrc =
    gameState.currentQuestion === 0
      ? `${Q1_RX}/q1introvid.mp4`
      : `/questionvideos/${QUESTION_INTRO_FILES[gameState.currentQuestion]}.mp4`;

  // Hide the floating mute button whenever a full-screen video overlay is on,
  // otherwise it stacks on top of the video's own "Skip ▸" button bottom-right.
  const videoOverlayActive =
    !!reactionVideoSrc ||
    (gameState.phase === "question-intro" && tourState === "done");

  // Robust autoplay for the two full-screen overlays. Without this, after a
  // hard reload the second video in the chain occasionally never starts —
  // browsers silently refuse to honor the `autoPlay` attribute when the
  // element is mounted into a freshly-painted overlay during a heavy
  // animation tick. The hook retries play() on every relevant media event
  // plus a short watchdog poll.
  useVideoAutoplay(
    introVideoRef,
    gameState.phase === "question-intro" && tourState === "done",
  );
  useVideoAutoplay(reactionVideoRef, !!reactionVideoSrc);

  // Mirror this to the parent so it can hide the 3D logo while a video plays.
  useEffect(() => {
    onVideoOverlayChange?.(videoOverlayActive);
  }, [videoOverlayActive, onVideoOverlayChange]);

  /** The question timer is "live" only when: tour is done, we're on a real
   *  question screen (not intro video / elimination / answered), the host has
   *  finished narrating the question, and no full-screen video overlay is up.
   *  This is the window in which the ITV timer bed plays (looped) and the
   *  background theme is paused. Question `timeLimit` is 45s. */
  const questionTimerActive =
    tourState === "done" &&
    gameState.phase === "question" &&
    !narratingQuestion &&
    !videoOverlayActive;

  // Surface this flag upward so GameFlow can suppress the theme music.
  useEffect(() => {
    onQuestionTimerActiveChange?.(questionTimerActive);
  }, [questionTimerActive, onQuestionTimerActiveChange]);

  /** Suppress game-show BGM from post-answer through elimination until "Next question". */
  const eliminationSequenceActive =
    gameState.phase === "answered" || gameState.phase === "elimination";
  useEffect(() => {
    onEliminationSequenceActiveChange?.(eliminationSequenceActive);
  }, [eliminationSequenceActive, onEliminationSequenceActiveChange]);

  const playTimerVoCue = useCallback(() => {
    if (muted) return;
    const a = new Audio(TIMER_VO_SRC);
    a.volume = 0.85;
    void a.play().catch(() => {});
  }, [muted]);

  // When the timer goes live, play the ITV timer bed (looped). `timerVO` is fired
  // from QuestionScreen when 13s remain (3s before the 10s tick strip).
  const timerAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!questionTimerActive) return;
    if (muted) return;
    const a = new Audio(SFX_QUESTION_TIMER);
    a.volume = 0.6;
    a.loop = true;
    timerAudioRef.current = a;
    void a.play().catch(() => {});
    return () => {
      a.pause();
      try {
        a.currentTime = 0;
        a.src = "";
      } catch {
        /* ignore */
      }
      if (timerAudioRef.current === a) timerAudioRef.current = null;
    };
  }, [questionTimerActive, muted]);

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

  return (
    <div className="w-full h-full relative">
      {!videoOverlayActive && <MuteButton />}

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
            className="fixed inset-0 z-[95] bg-black flex items-center justify-center"
          >
            <video
              ref={introVideoRef}
              key={questionIntroVideoSrc}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              preload="auto"
              muted={muted}
              onEnded={gameState.currentQuestion === 0 ? undefined : handleQuestionIntroEnd}
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
            className="fixed inset-0 z-[95] bg-black flex items-center justify-center"
          >
            <video
              ref={reactionVideoRef}
              key={reactionVideoSrc}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              preload="auto"
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
                <motion.button
                  onClick={handleStartTour}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="game-show-btn relative z-0 w-full cursor-pointer rounded-xl py-4 text-center text-[13px] font-semibold uppercase tracking-[0.2em]"
                >
                  <span className="relative z-10">Ready, start the tour</span>
                </motion.button>
                <button
                  onClick={handleSkipTour}
                  className="w-full cursor-pointer rounded-xl border border-brass/25 bg-black/40 py-3 text-center text-[11px] font-mono uppercase tracking-[0.28em] text-brass-dim hover:border-brass/50 hover:text-brass-bright hover:bg-black/60 transition-colors"
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
                    className="game-show-btn relative z-0 w-full cursor-pointer rounded-xl py-4 text-center text-[13px] font-semibold uppercase tracking-[0.25em]"
                  >
                    <span className="relative z-10">Start question 1</span>
                  </motion.button>
                  <button
                    onClick={() => {
                      stop();
                      setTourState("playing");
                    }}
                    className="w-full cursor-pointer rounded-xl border border-brass/25 bg-black/40 py-3 text-center text-[11px] font-mono uppercase tracking-[0.28em] text-brass-dim hover:border-brass/50 hover:text-brass-bright hover:bg-black/60 transition-colors"
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
            onTimerVoCue={playTimerVoCue}
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
      className="min-h-[100dvh] w-full h-full flex flex-col items-center justify-center relative overflow-x-hidden overflow-y-auto py-10"
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
                  You reached the{" "}
                  <span className="text-brass-bright font-semibold">
                    {Number.isFinite(reachedPercentage) ? reachedPercentage : 0}%
                  </span>{" "}
                  bracket.
                </p>
                <p className="text-muted text-xs mt-2">Seven rounds separate the crowd from the club.</p>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.15, duration: 0.5 }}
              className="mt-8 pt-6 border-t border-white/[0.08]"
            >
              <p className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.22em] text-muted leading-relaxed text-center">
                MAKE YOUR BRAND A PART OF THE 1% CLUB
                <br />
                <span className="text-foreground/55">COMING SOON | Aug 2026</span>
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}


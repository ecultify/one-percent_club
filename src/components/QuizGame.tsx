"use client";

import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QuestionScreen from "./QuestionScreen";
import EliminationReveal from "./EliminationReveal";
import MuteButton from "./MuteButton";
import { useNarration } from "./NarrationProvider";
import ProductTour, { TourStep } from "./ProductTour";
import HostSilhouette from "./HostSilhouette";
import FadeWipe from "./FadeWipe";
import { useVideoAutoplay } from "@/lib/useVideoAutoplay";

const SFX_CORRECT = encodeURI("/sound/644963__craigscottuk__quiz-gameshow-correct-ping-14.mp3");
const SFX_WRONG = encodeURI("/sound/131657__bertrof__game-sound-wrong.wav");
/** Bed for the live countdown (clip is ~30s; looped so it covers the full 30s limit). */
const SFX_QUESTION_TIMER = encodeURI("/sound/ITV's _ The 1 club - 30 Second Timer.mp3");
const SFX_APPLAUSE = encodeURI("/sound/appluase2.wav");
const ENDING_VO_ALL_CORRECT = encodeURI("/questionscreenimages/endingvoallcorrect.mp3");
const ENDING_VO_IF_EVEN_ONE_WRONG = encodeURI("/questionscreenimages/endingvoifevenonewrong.mp3");
/** ~2s VO: plays once when **13s** remain (3s before the last-10s tick SFX). */
const TIMER_VO_SRC = encodeURI("/sound/timerVO.mp3");

function VideoOutroWipe({ active }: { active: boolean }) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[5] bg-black"
      initial={{ opacity: 0, scaleX: 0 }}
      animate={active ? { opacity: 1, scaleX: 1 } : { opacity: 0, scaleX: 0 }}
      transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
      style={{ transformOrigin: "right" }}
    />
  );
}

function playQuizSfx(kind: "correct" | "wrong", muted: boolean) {
  if (muted) return;
  const a = new Audio(kind === "correct" ? SFX_CORRECT : SFX_WRONG);
  a.volume = kind === "correct" ? 0.72 : 0.55;
  void a.play().catch(() => {});
}

async function checkAnswerWithOpenAI(
  userAnswer: string,
  correctAnswer: string,
  question: string
): Promise<boolean> {
  try {
    const res = await fetch("/api/check-answer-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAnswer, correctAnswer, question }),
    });
    if (!res.ok) return true;
    const data = await res.json();
    return data.isCorrect === true;
  } catch {
    return true;
  }
}

function questionIntroVideoSrc(questionIndex: number): string {
  return `/questionscreenimages/question${questionIndex + 1}/q${questionIndex + 1}intro.mp4`;
}

function questionVoSrc(questionId: number): string {
  if (questionId === 2) return `/questionscreenimages/question2/q2VOrevised.mp3`;
  if (questionId === 4) return `/questionscreenimages/question4/q4VOrevised.mp3`;
  return `/questionscreenimages/question${questionId}/q${questionId}VO.mp3`;
}

function correctReactionSrc(questionIndex: number): string {
  return `/questionscreenimages/question${questionIndex + 1}/q${questionIndex + 1}correct.mp4`;
}

function pickWrongReactionUrl(questionIndex: number): string {
  if (questionIndex === 7) {
    return "/questionscreenimages/wrongrxns/1percentwrongmodified.mp4";
  }
  const templates = [
    "/questionscreenimages/wrongrxns/qwrong1.mp4",
    "/questionscreenimages/wrongrxns/qwrong2.mp4",
  ];
  return templates[Math.floor(Math.random() * templates.length)];
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
  /** If true, renders a text input instead of options. Answer validated via
   *  OpenAI semantic check. */
  textInput?: boolean;
  /** If true, renders a number-only input constrained to maxDigits. Answer
   *  validated as exact numeric match against correctNumber. */
  numberInput?: boolean;
  /** Maximum digits allowed in numberInput. */
  maxDigits?: number;
  /** Expected numeric answer when numberInput is true. */
  correctNumber?: number;
  /** Correct answer text sent to OpenAI for semantic matching when
   *  textInput is true. */
  correctAnswerText?: string;
}

export interface GameState {
  currentQuestion: number;
  totalPlayers: number;
  remainingPlayers: number;
  potPrize: number;
  stakePerPlayer: number;
  playerAnswers: (number | null)[];
  playerAnswerTexts: (string | null)[];
  playerCorrect: boolean[];
  eliminatedThisRound: number[];
  phase: "question-intro" | "question" | "answered" | "elimination" | "final-result";
}

/** Rewind to the start of the previous round: intro for Q_{n-1}, with economy + answers reverted. */
function rewindToPreviousRoundStart(prev: GameState): GameState {
  const c = prev.currentQuestion;
  if (c < 1) return prev;
  const elimUndo = prev.eliminatedThisRound[c - 1] ?? 0;
  return {
    ...prev,
    currentQuestion: c - 1,
    phase: "question-intro",
    playerAnswers: prev.playerAnswers.slice(0, c - 1),
    playerAnswerTexts: prev.playerAnswerTexts.slice(0, c - 1),
    playerCorrect: prev.playerCorrect.slice(0, c - 1),
    eliminatedThisRound: prev.eliminatedThisRound.slice(0, c - 1),
    remainingPlayers: prev.remainingPlayers + elimUndo,
    potPrize: Math.max(0, prev.potPrize - elimUndo * prev.stakePerPlayer),
  };
}

// ── Questions (client-provided, 1% Club India edit) ──
const QUESTIONS: Question[] = [
  {
    id: 1,
    percentage: 90,
    // Q1 — "Find the mistake" video question. The intro video IS the
    // question — it shows "Can you find the mistake? 1 2 3 4 5 6 7 8 9"
    // with the article 'the' written twice. User types what they spotted.
    // Correct answer: the word "the" is doubled.
    question: "What is the answer to this question?",
    image: "/questionscreenimages/question1/q1image.png",
    textInput: true,
    correctAnswerText: "The word 'the' appears twice / the article 'the' is doubled / 'the the' is written repeated",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 2,
    percentage: 80,
    // Q2 — Which photo cannot be real? Three photo options: fake giraffe
    // (answer), tiger, zebra. User clicks one image.
    question: "Which of these photographs cannot be real?",
    images: [
      "/questionscreenimages/question2/q2fakegiraffe.png",
      "/questionscreenimages/question2/q2tiger.png",
      "/questionscreenimages/question2/q2zebra.png",
    ],
    imageCaptions: ["Giraffe", "Tiger", "Zebra"],
    imagesAreOptions: true,
    options: ["Photo 1", "Photo 2", "Photo 3"],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 3,
    percentage: 70,
    // Q3 — Word play: Earth has Heart (anagram), Mars has ARMS (anagram).
    // Question image shown above the text input. User types answer.
    // OpenAI semantic check — accepts "ARMS", "arm", "arms", etc.
    question: "If planet 'Earth' has a 'Heart', which body part does planet 'Mars' have?",
    image: "/questionscreenimages/question3/q3.png",
    textInput: true,
    correctAnswerText: "ARMS (anagram of MARS — the letters of the word Mars rearranged spell Arms)",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 4,
    percentage: 60,
    // Q4 — Biggest SQUARE out of three shapes. User clicks one image.
    // Correct answer: index 0 (first image is the actual square).
    question: "Which SQUARE has the biggest total area?",
    images: [
      "/questionscreenimages/question4/q4image1.png",
      "/questionscreenimages/question4/q4image2.png",
      "/questionscreenimages/question4/q4image3.png",
    ],
    imageCaptions: ["A", "B", "C"],
    imagesAreOptions: true,
    options: ["A", "B", "C"],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 5,
    percentage: 50,
    // Q5 — Number grid puzzle. Image shows shapes with numbers 12, 30, 18, ?
    // User types missing number (2-digit max). Correct answer: 16.
    question: "Which number replaces the question mark?",
    image: "/questionscreenimages/question5/q5image.png",
    numberInput: true,
    maxDigits: 2,
    correctNumber: 16,
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 6,
    percentage: 30,
    // Q6 — Transport rearrangement (MOVED from previous Q7 slot).
    // Four transport modes shown alphabetically. User counts how many stay
    // in the same position when rearranged by passenger count low→high.
    // Correct answer: index 0 ("1") — only Local train stays in the same
    // position (low→high: Cycle, Autorickshaw, Bus, Local train = pos. 3,1,2,4).
    question: "Four modes of transport are arranged below alphabetically. If you rearrange them from lowest to highest by the number of passengers they typically carry, how many will stay in the same place?",
    images: [
      "/questionscreenimages/question6/auto-ezremove.png",
      "/questionscreenimages/question6/bus-ezremove.png",
      "/questionscreenimages/question6/cycle-ezremove.png",
      "/questionscreenimages/question6/localtrain-ezremove.png",
    ],
    imageCaptions: ["Autorickshaw", "Bus", "Cycle", "Local train"],
    compactImageRow: true,
    options: ["1", "2", "3"],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 7,
    percentage: 10,
    // Q7 — Larry the Llama (NEW question in this slot).
    // Larry always LIES. Claims: behind even door, door < 6, door is
    // multiple of 3. All three are lies, so real door is: ODD, >= 6,
    // NOT a multiple of 3. From 1-10, only door 7 fits all three constraints.
    // User types a single digit. Correct answer: 7.
    question: "Larry the llama ALWAYS lies. He's hiding behind one of 10 doors (1-10). Larry says: 'I'm behind an EVEN door, my door is SMALLER than 6, and my door is a MULTIPLE of 3.' Which door is Larry really behind?",
    image: "/questionscreenimages/question7/q7image.png",
    numberInput: true,
    maxDigits: 1,
    correctNumber: 7,
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    id: 8,
    percentage: 1,
    // Q8 — TNECREPE (unchanged content, only timer updated to 30s and
    // asset paths rewired in Part 3 below).
    question: "TNECREPE is the beginning of a reversed phrase. Which two letters complete it?",
    wordPuzzle: "TNECREPE _ _",
    options: ["RC", "AR", "NO", "TE"],
    correctIndex: 2,
    timeLimit: 30,
  },
];

/** Dev-only: initial `GameState` for the champion final screen (all questions correct). */
function createDevChampionInitialState(): GameState {
  const n = QUESTIONS.length;
  return {
    currentQuestion: n - 1,
    totalPlayers: 100,
    remainingPlayers: 1,
    potPrize: 100 * 100000,
    stakePerPlayer: 100000,
    playerAnswers: Array.from({ length: n }, () => 0),
    playerAnswerTexts: Array.from({ length: n }, () => null),
    playerCorrect: Array.from({ length: n }, () => true),
    eliminatedThisRound: [],
    phase: "final-result",
  };
}

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
  isLastQuestion: boolean,
  playerGotItRight: boolean
): number {
  // ── 1% (final) question only ────────────────────────────────────────────
  // On the last round `remaining` is tiny — often just the player themselves.
  // A blind crowd simulation (as used on earlier rounds) would always report
  // ≥1 eliminated because the fail rate is 99%, which then contradicts the
  // "Survived" chip when the player answered correctly.
  // Here we simulate the CROWD only (other players), and add the player's
  // personal fate separately so the displayed count always agrees with the
  // Survived / Eliminated chip.
  if (isLastQuestion) {
    const others = Math.max(0, remaining - 1);
    const failRate = (100 - percentage) / 100;
    const jitter = 0.9 + Math.random() * 0.2;
    let othersEliminated = Math.round(others * failRate * jitter);
    othersEliminated = Math.min(othersEliminated, others);
    return othersEliminated + (playerGotItRight ? 0 : 1);
  }

  // ── Q1 … Q7 (original crowd simulation, unchanged) ─────────────────────
  // What fraction gets it WRONG
  const failRate = (100 - percentage) / 100;
  // Small variance: ±10% of the fail rate
  const jitter = 0.9 + Math.random() * 0.2;
  let eliminated = Math.round(remaining * failRate * jitter);

  // Clamp: at least 1 eliminated (if there are players), but always keep
  // at least 1 survivor on non-final rounds.
  eliminated = Math.min(eliminated, remaining - 1);
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
  /** `next dev` only: `GameFlow` sets this to open directly on the perfect-score final result. */
  devChampionPreview?: boolean;
  /** Return to the instructions screen (used when the tour is dismissed or the first question is backed out of). */
  onBackToMenu?: () => void;
  /** Lets `GameFlow` wire the fixed Back control while `playing` is active. */
  onRegisterBack?: (handler: (() => void) | null) => void;
}

function getDefaultQuizGameState(): GameState {
  return {
    currentQuestion: 0,
    totalPlayers: 100,
    remainingPlayers: 100,
    potPrize: 0,
    stakePerPlayer: 100000, // ₹1 lakh per player → 100 × 1L = ₹1Cr total
    playerAnswers: [],
    playerAnswerTexts: [],
    playerCorrect: [],
    eliminatedThisRound: [],
    // Start in "question" so QuestionScreen mounts immediately and the
    // ProductTour can find its target elements via data-tour-id selectors.
    // After the tour finishes, handleConfirmReady switches phase to
    // "question-intro" to play the first intro video.
    phase: "question",
  };
}

export default function QuizGame({
  playerName,
  onGameEnd,
  onVideoOverlayChange,
  onQuestionTimerActiveChange,
  onEliminationSequenceActiveChange,
  devChampionPreview = false,
  onBackToMenu = () => {},
  onRegisterBack,
}: QuizGameProps) {
  const [gameState, setGameState] = useState<GameState>(() =>
    devChampionPreview ? createDevChampionInitialState() : getDefaultQuizGameState()
  );

  // Right-to-left wipe state — flipped briefly between phase changes
  const [wipeActive, setWipeActive] = useState(false);

  // Tour state:
  //   "prompt"     = initial card, waiting for user to start the tour
  //   "playing"    = step-by-step SaaS tour running
  //   "ready-gate" = tour finished, asking "Ready to start the game?"
  //   "done"       = gameplay running
  const [tourState, setTourState] = useState<
    "prompt" | "playing" | "ready-gate" | "done"
  >(() => (devChampionPreview ? "done" : "prompt"));

  // Reaction video overlay state
  const [reactionVideo, setReactionVideo] = useState<"correct" | "wrong" | "winner" | null>(null);
  /** Picked when showing a wrong reaction; stable URL for the clip (Q1–Q7 random, Q8 fixed). */
  const wrongReactionUrlRef = useRef<string | null>(null);
  const pendingEliminationRef = useRef<{ eliminated: number; addedToPot: number } | null>(null);
  /** Bumped from `handleQuizBack` to cancel the 2s answer→reaction / time-up chain. */
  const postAnswerChainRef = useRef(0);
  const { narrate, narrateUrl, stop, muted } = useNarration();

  // Refs for the two full-screen video overlays. Used by useVideoAutoplay below
  // to retry play() across canplay / stalled / waiting / visibilitychange — the
  // bare `autoPlay` attribute fails silently on reload + bfcache cases, which
  // was the root cause of "the next video doesn't play sometimes after reload".
  const introVideoRef = useRef<HTMLVideoElement | null>(null);
  const reactionVideoRef = useRef<HTMLVideoElement | null>(null);
  const [introOutroActive, setIntroOutroActive] = useState(false);
  const [reactionOutroActive, setReactionOutroActive] = useState(false);
  const introOutroArmedRef = useRef(false);
  const reactionOutroArmedRef = useRef(false);

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
  const [narratingQuestion, setNarratingQuestion] = useState(() => !devChampionPreview);
  /** True while a text-answer is being checked via API (prevents timer bed overlap). */
  const [answerValidationPending, setAnswerValidationPending] = useState(false);

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
      const done = narrateUrl(`q-${q.id}-vo`, vo);
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

  const handleAnswer = useCallback(async (selectedIndex: number, typedAnswer?: string) => {
    const q = QUESTIONS[gameState.currentQuestion];
    let isCorrect: boolean;

    if (q.textInput) {
      if (typedAnswer === undefined) isCorrect = false;
      else {
        const raw = typedAnswer.trim().toLowerCase();
        // Q1: accept even a bare "the" (user spotted the duplicated article).
        if (q.id === 1 && /\bthe\b/.test(raw)) {
          isCorrect = true;
        } else {
          isCorrect = await checkAnswerWithOpenAI(
            typedAnswer,
            q.correctAnswerText ?? "",
            q.question
          );
        }
      }
    } else if (q.numberInput) {
      if (typedAnswer === undefined) isCorrect = false;
      else {
        const typed = parseInt(typedAnswer.trim(), 10);
        isCorrect = !Number.isNaN(typed) && typed === q.correctNumber;
      }
    } else if (q.acceptAny) {
      isCorrect = true;
    } else {
      isCorrect = selectedIndex === q.correctIndex;
    }

    const lastQ = gameState.currentQuestion >= QUESTIONS.length - 1;
    const eliminated = simulateEliminations(q.percentage, gameState.remainingPlayers, lastQ, isCorrect);
    const addedToPot = eliminated * gameState.stakePerPlayer;

    setGameState(prev => ({
      ...prev,
      phase: "answered",
      playerAnswers: [...prev.playerAnswers, selectedIndex],
      playerAnswerTexts: [...prev.playerAnswerTexts, typedAnswer !== undefined ? typedAnswer : null],
      playerCorrect: [...prev.playerCorrect, isCorrect],
    }));

    playQuizSfx(isCorrect ? "correct" : "wrong", muted);

    // Stop any narration, queue elimination data, wait 2s, then wipe and play reaction
    stop();
    pendingEliminationRef.current = { eliminated, addedToPot };
    const reaction: "winner" | "correct" | "wrong" =
      isCorrect && lastQ ? "winner" : isCorrect ? "correct" : "wrong";
    const afterAnswerToken = postAnswerChainRef.current;
    setTimeout(() => {
      if (postAnswerChainRef.current !== afterAnswerToken) return;
      runWipeThen(() => {
        if (reaction === "wrong") {
          wrongReactionUrlRef.current = pickWrongReactionUrl(gameState.currentQuestion);
        } else {
          wrongReactionUrlRef.current = null;
        }
        setReactionVideo(reaction);
      });
    }, 2000);
  }, [gameState.currentQuestion, gameState.remainingPlayers, gameState.stakePerPlayer, stop, runWipeThen, muted]);

  const handleTimeUp = useCallback(() => {
    const q = QUESTIONS[gameState.currentQuestion];
    const lastQ = gameState.currentQuestion >= QUESTIONS.length - 1;
    // Time-up always counts as wrong → the player is eliminated this round.
    const eliminated = simulateEliminations(q.percentage, gameState.remainingPlayers, lastQ, false);
    const addedToPot = eliminated * gameState.stakePerPlayer;

    setGameState(prev => ({
      ...prev,
      phase: "answered",
      playerAnswers: [...prev.playerAnswers, null],
      playerAnswerTexts: [...prev.playerAnswerTexts, null],
      playerCorrect: [...prev.playerCorrect, false],
    }));

    playQuizSfx("wrong", muted);

    // Time up is always "wrong" reaction, same 2s + wipe flow
    stop();
    pendingEliminationRef.current = { eliminated, addedToPot };
    const timeUpToken = postAnswerChainRef.current;
    setTimeout(() => {
      if (postAnswerChainRef.current !== timeUpToken) return;
      runWipeThen(() => {
        wrongReactionUrlRef.current = pickWrongReactionUrl(gameState.currentQuestion);
        setReactionVideo("wrong");
      });
    }, 2000);
  }, [gameState.currentQuestion, gameState.remainingPlayers, gameState.stakePerPlayer, stop, runWipeThen, muted]);

  const handleReactionVideoEnd = useCallback(() => {
    wrongReactionUrlRef.current = null;
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
      : (reactionVideo === "correct" || reactionVideo === "winner")
        ? correctReactionSrc(gameState.currentQuestion)
        : wrongReactionUrlRef.current;

  const introVideoSrc = questionIntroVideoSrc(gameState.currentQuestion);

  // Reset the outro wipe whenever a new overlay mounts.
  useEffect(() => {
    setIntroOutroActive(false);
    introOutroArmedRef.current = false;
  }, [introVideoSrc, gameState.phase, tourState]);
  useEffect(() => {
    setReactionOutroActive(false);
    reactionOutroArmedRef.current = false;
  }, [reactionVideoSrc]);

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
   *  background theme is paused. Question `timeLimit` is 30s. */
  const questionTimerActive =
    tourState === "done" &&
    gameState.phase === "question" &&
    !narratingQuestion &&
    !videoOverlayActive &&
    !answerValidationPending;

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

  const handleQuizBack = useCallback(() => {
    stop();
    postAnswerChainRef.current += 1;
    setAnswerValidationPending(false);
    if (reactionVideo) {
      handleSkipReactionVideo();
      return;
    }
    if (devChampionPreview) {
      onBackToMenu();
      return;
    }
    if (tourState === "ready-gate") {
      setTourState("prompt");
      return;
    }
    if (tourState === "prompt" || tourState === "playing") {
      onBackToMenu();
      return;
    }
    if (gameState.phase === "final-result") {
      setGameState((prev) => ({ ...prev, phase: "elimination" }));
      return;
    }
    if (gameState.phase === "elimination") {
      setGameState((prev) => ({ ...prev, phase: "answered" }));
      return;
    }
    if (gameState.phase === "answered") {
      setGameState((prev) => {
        const c = prev.currentQuestion;
        return {
          ...prev,
          phase: "question",
          playerAnswers: prev.playerAnswers.slice(0, c),
          playerAnswerTexts: prev.playerAnswerTexts.slice(0, c),
          playerCorrect: prev.playerCorrect.slice(0, c),
        };
      });
      return;
    }
    if (gameState.phase === "question-intro" || gameState.phase === "question") {
      if (gameState.currentQuestion === 0) {
        onBackToMenu();
        return;
      }
      setGameState((prev) => rewindToPreviousRoundStart(prev));
      return;
    }
  }, [
    stop,
    reactionVideo,
    devChampionPreview,
    tourState,
    gameState.phase,
    gameState.currentQuestion,
    onBackToMenu,
    handleSkipReactionVideo,
  ]);

  useLayoutEffect(() => {
    onRegisterBack?.(handleQuizBack);
    return () => onRegisterBack?.(null);
  }, [onRegisterBack, handleQuizBack]);

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
        muted={muted}
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
              key={introVideoSrc}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              preload="auto"
              muted={muted}
              onTimeUpdate={(e) => {
                if (introOutroArmedRef.current) return;
                const el = e.currentTarget;
                if (!Number.isFinite(el.duration) || el.duration <= 0) return;
                if (el.duration - el.currentTime <= 1.05) {
                  introOutroArmedRef.current = true;
                  setIntroOutroActive(true);
                }
              }}
              onEnded={handleQuestionIntroEnd}
              onError={handleQuestionIntroEnd}
              src={introVideoSrc}
            />
            <VideoOutroWipe active={introOutroActive} />
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
              onTimeUpdate={(e) => {
                if (reactionOutroArmedRef.current) return;
                const el = e.currentTarget;
                if (!Number.isFinite(el.duration) || el.duration <= 0) return;
                if (el.duration - el.currentTime <= 1.05) {
                  reactionOutroArmedRef.current = true;
                  setReactionOutroActive(true);
                }
              }}
              onEnded={handleReactionVideoEnd}
              onError={handleReactionVideoEnd}
              src={reactionVideoSrc}
            />
            <VideoOutroWipe active={reactionOutroActive} />
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
            onAnswerValidationPendingChange={setAnswerValidationPending}
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

const METALLIC_GOLD: string[] = [
  "linear-gradient(135deg, #f5d76e 0%, #c4a535 32%, #8b6f2a 55%, #e8c547 78%, #a8892e 100%)",
  "linear-gradient(90deg, #d4af37 0%, #f9e4a0 40%, #b8860b 100%)",
  "linear-gradient(180deg, #ffeaa7 0%, #c9a227 45%, #6b5310 100%)",
  "linear-gradient(45deg, #e8c547, #5c4a1a, #f0d78c, #9a7b2a)",
];

function WinnerMetallicConfetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 56 }, (_, i) => {
        const s = (i * 17 + 3) % 1000;
        return {
          id: i,
          left: (s * 0.1) % 100,
          delay: (i * 0.11) % 2.2,
          duration: 2.4 + (i % 8) * 0.22,
          w: 2.5 + (i % 3) * 0.8,
          h: 7 + (i % 6) * 1.2,
          size: 3.5 + (i % 4) * 0.6,
          isStrip: i % 3 !== 0,
          rotate: 360 + (i % 5) * 140,
          grad: METALLIC_GOLD[i % METALLIC_GOLD.length]!,
          x0: ((i * 7) % 20) - 8,
        };
      }),
    []
  );

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
      aria-hidden
    >
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-[2px] top-[-4%]"
          style={{
            left: `${p.left}%`,
            width: p.isStrip ? p.w : p.size,
            height: p.isStrip ? p.h : p.size,
            background: p.grad,
            boxShadow:
              "0 0 8px rgba(245, 215, 110, 0.4), inset 0 1px 0 rgba(255,255,255,0.28)",
            willChange: "transform",
          }}
          initial={{ y: "-6vh", x: 0, rotate: 0, opacity: 0 }}
          animate={{
            y: "112vh",
            x: [0, p.x0, 0, -p.x0 * 0.6, 0],
            rotate: p.rotate,
            opacity: [0, 1, 1, 0.5, 0.15],
          }}
          transition={{
            y: { duration: p.duration, delay: p.delay, repeat: Infinity, ease: "linear" },
            x: { duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeInOut" },
            rotate: { duration: p.duration, delay: p.delay, repeat: Infinity, ease: "linear" },
            opacity: {
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: "linear",
              times: [0, 0.04, 0.65, 0.9, 1],
            },
          }}
        />
      ))}
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
  muted,
}: {
  playerName: string;
  correctCount: number;
  totalQuestions: number;
  potPrize: number;
  remainingPlayers: number;
  reachedPercentage: number;
  muted: boolean;
}) {
  const isWinner = correctCount === totalQuestions;
  const shareOfPot = isWinner ? Math.round(potPrize / Math.max(remainingPlayers, 1)) : 0;
  const endingVoPlayedRef = useRef<"all-correct" | "one-wrong" | null>(null);

  useEffect(() => {
    if (!isWinner || muted) return;
    const a = new Audio(SFX_APPLAUSE);
    a.volume = 0.5;
    void a.play().catch(() => {});
    return () => {
      a.pause();
      try {
        a.currentTime = 0;
        a.src = "";
      } catch {
        /* ignore */
      }
    };
  }, [isWinner, muted]);

  useEffect(() => {
    if (muted) return;
    const variant: "all-correct" | "one-wrong" = isWinner ? "all-correct" : "one-wrong";
    if (endingVoPlayedRef.current === variant) return;
    endingVoPlayedRef.current = variant;
    const a = new Audio(isWinner ? ENDING_VO_ALL_CORRECT : ENDING_VO_IF_EVEN_ONE_WRONG);
    a.volume = 0.85;
    void a.play().catch(() => {});
    return () => {
      a.pause();
      try {
        a.currentTime = 0;
        a.src = "";
      } catch {
        /* ignore */
      }
    };
  }, [muted, isWinner]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="h-[100dvh] max-h-[100dvh] w-full flex flex-col items-center justify-center relative overflow-hidden px-2 py-4 sm:py-5"
    >
      {isWinner && <WinnerMetallicConfetti />}
      {/* ━━ Atmospheric Background ━━ */}
      <div className="absolute inset-0 pointer-events-none z-0">
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

      <div className="relative z-10 max-w-md w-full mx-4">
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

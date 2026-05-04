"use client";

/* ════════════════════════════════════════════════════════════════════════════
 *  DEV-ONLY ?devq= QUICK-JUMP — REMOVAL GUIDE
 *  ─────────────────────────────────────────────────────────────────────────
 *  When the client gives the go-ahead to ship, delete every block in this
 *  repo bracketed by these markers (grep for them):
 *
 *      // ─── DEV-ONLY: ?devq= quick-jump (REMOVE BEFORE PROD) ───
 *      ...code to delete...
 *      // ─── END DEV-ONLY ───
 *
 *  Files touched:
 *      src/app/page.tsx
 *      src/components/GameFlow.tsx
 *      src/components/QuizGame.tsx
 *
 *  After deletion, run:  npx tsc --noEmit   to confirm no orphaned refs.
 *  No production code paths depend on `devStartFromQuestion` — it is an
 *  optional prop with a no-op default.
 * ════════════════════════════════════════════════════════════════════════ */

import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QuestionScreen from "./QuestionScreen";
import CorrectAnswerPanel from "./CorrectAnswerPanel";
import EliminationReveal from "./EliminationReveal";
import dynamic from "next/dynamic";
import MuteButton from "./MuteButton";
import { useNarration } from "./NarrationProvider";
import ProductTour, { TourStep } from "./ProductTour";
import HostSilhouette from "./HostSilhouette";
import FadeWipe from "./FadeWipe";
import { useVideoAutoplay } from "@/lib/useVideoAutoplay";
import { playWhoosh } from "@/lib/uiClickSound";

const SFX_CORRECT = encodeURI("/sound/644963__craigscottuk__quiz-gameshow-correct-ping-14.mp3");
const SFX_WRONG = encodeURI("/sound/131657__bertrof__game-sound-wrong.wav");
/** Bed for the live countdown (clip is ~30s; looped so it covers the full 30s limit). */
const SFX_QUESTION_TIMER = encodeURI("/sound/ITV's _ The 1 club - 30 Second Timer.mp3");
const SFX_APPLAUSE = encodeURI("/sound/appluase2.wav");
// NOTE: the ENDING_VO_*.mp3 files used to play on the FinalResult screen
// as standalone audio. Once the .mp4 ending videos were added (which carry
// the same VO baked into video), the MP3 playback became a duplicate that
// fired AFTER the video finished. Removed entirely below; MP3 files left
// on disk in case audio-only fallback is needed later.
/** Plays full-screen after the user clicks "See end screen" on the last
 *  question. Two variants depending on whether the player got every
 *  answer right:
 *    - All-correct → endingvoifallcorrect.mp4 (the "champion" tail)
 *    - Any-wrong  → endvoifevenonewrong.mp4 (the consolation tail)
 *  Resolved at render time by `pickFinalVideoSrc(playerCorrect)` below
 *  so the right clip mounts the moment the user clicks "See end screen". */
const FINAL_VIDEO_SRC_ALL_CORRECT = encodeURI("https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/endingvoifallcorrect.mp4");
const FINAL_VIDEO_SRC_IF_ANY_WRONG = encodeURI("https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/endvoifevenonewrong.mp4");
function pickFinalVideoSrc(playerCorrect: boolean[]): string {
  const allCorrect =
    playerCorrect.length === QUESTIONS.length &&
    playerCorrect.every((v) => v === true);
  return allCorrect ? FINAL_VIDEO_SRC_ALL_CORRECT : FINAL_VIDEO_SRC_IF_ANY_WRONG;
}
/** Same Unicorn Studio scene previously rendered on the FinalStage3D middle LED.
 *  We now render it as the centerpiece of the final summary screen. */
const FINAL_SCREEN_UNICORN_JSON_PATH = "/animations/end_tvscreen_animate.json";
const FINAL_SCREEN_UNICORN_SDK_URL =
  "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.1.9/dist/unicornStudio.umd.js";

// Lazy-load the Unicorn Studio scene only on the final screen — keeps the SDK
// bundle out of the main quiz flow and avoids running its WebGL setup until
// the user actually reaches the final summary.
const UnicornSceneFinal = dynamic(() => import("unicornstudio-react/next"), {
  ssr: false,
});
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

/** ─────────────────────────────────────────────────────────────────────────
 *  QUESTION_PATHS — single source of truth for all per-question asset paths.
 *  ─────────────────────────────────────────────────────────────────────────
 *  After the May 2026 reorganization the 8-question lineup expanded to 10
 *  and folder names were renamed from `questionN/` to
 *  `questionN(descriptor-tier)/`. Every video / VO file lives inside its
 *  matching folder; the resolvers below do a flat lookup against this map
 *  so adding / re-tiering / renaming a question only touches this table.
 *
 *  Folder names contain literal `(` and `)` characters. Modern Next.js
 *  serves these static asset paths transparently (the browser URL-encodes
 *  the parens to %28/%29 on its own). If a 404 ever appears for one of
 *  these, wrap the return value below in `encodeURI(...)`.
 *  ─────────────────────────────────────────────────────────────────────── */
const QUESTION_PATHS: Record<number, {
  folder: string;
  intro: string;
  vo: string;
  correct: string;
}> = {
  1: {
    folder: "question1(findthemistake-90)",
    intro: "q1intro.mp4",
    vo: "q1VO(canyoufindthemistake).mp3",
    correct: "q1correct.mp4",
  },
  2: {
    folder: "question2(gandhijirealornot-80)",
    intro: "q2intro.mp4",
    vo: "q2VO(gandhiji).mp3",
    correct: "q2_new_sequence_yes.mp4",
  },
  3: {
    folder: "question3(cardsnglasses-70)",
    intro: "q3intro.mp4",
    vo: "q3VO(cardsnglasses).mp3",
    correct: "q3_new_sequence_yes.mp4",
  },
  4: {
    folder: "question4(jessicanmandy-60)",
    intro: "q4intro.mp4",
    vo: "q4VO.mp3",
    correct: "q4_new_sequence_yes.mp4",
  },
  5: {
    folder: "question5(biggestsquare-50)",
    intro: "q5intro.mp4",
    vo: "q5VOrevised.mp3",
    correct: "q5correct.mp4",
  },
  6: {
    folder: "question6(4transports-40)",
    intro: "q6intro.mp4",
    vo: "q6VO.mp3",
    correct: "q6_new_sequence_yes.mp4",
  },
  7: {
    folder: "question7(earthnmars-30)",
    intro: "q7intro.mp4",
    vo: "q7VO.mp3",
    correct: "q7correct.mp4",
  },
  8: {
    folder: "question8(gymnast-20)",
    intro: "q8intro.mp4",
    vo: "q8VO.mp3",
    correct: "q8_new_sequence_yes.mp4",
  },
  9: {
    folder: "question9(number1to6-10)",
    intro: "q9intro.mp4",
    vo: "q9VO.mp3",
    correct: "q9_new_sequence_yes.mp4",
  },
  10: {
    folder: "question10(onepercent-1)",
    intro: "q10intro.mp4",
    vo: "q10VO.mp3",
    correct: "q10correct.mp4",
  },
};

function questionIntroVideoSrc(questionIndex: number): string {
  const p = QUESTION_PATHS[questionIndex + 1];
  // Hosted on Cloudflare R2 (bucket: tempstorage), flat layout — filename only.
  return `https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/${p.intro}`;
}

function questionVoSrc(questionId: number): string {
  const p = QUESTION_PATHS[questionId];
  return `/questionscreenimages/${p.folder}/${p.vo}`;
}

function correctReactionSrc(questionIndex: number): string {
  // The final question's "winner" correct-reaction is the dedicated
  // 1% Club celebratory video inside the question10 folder.
  // Confetti is dropped from the top for the first 10s in QuizGame.
  if (questionIndex === QUESTIONS.length - 1) {
    return "https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/q10correct.mp4";
  }
  const p = QUESTION_PATHS[questionIndex + 1];
  // Hosted on Cloudflare R2 (bucket: tempstorage), flat layout.
  return `https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/${p.correct}`;
}

function pickWrongReactionUrl(questionIndex: number): string {
  if (questionIndex === QUESTIONS.length - 1) {
    return "https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/1percentwrongmodified.mp4";
  }
  const templates = [
    "https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/qwrong1.mp4",
    "https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/qwrong2.mp4",
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
  phase: "question-intro" | "question" | "answered" | "elimination" | "final-video" | "final-result";
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

// ── Questions (client-provided, 1% Club India edit — May 2026 10-question lineup) ──
//
// Folder structure:
//   /public/questionscreenimages/questionN(descriptor-tier)/
//     ├ qNintro.mp4              — host setup video (plays before this screen)
//     ├ qNVO[(descriptor)].mp3   — host narration that runs while the user reads
//     ├ qN<topic>.png            — single backing image (when the question uses one)
//     ├ qNimageM.png             — multi-image option set (M=1..N) for image MCQ
//     ├ qNcorrect.mp4 OR qN_new_sequence_yes.mp4 — correct-answer reaction video
//
// Asset path resolvers live in QUESTION_PATHS above. The Q array below only
// declares the per-question CONTENT (text, options, scoring rules, inline
// media references). Folder-pathed reaction/intro/VO files are resolved at
// runtime by questionIntroVideoSrc / questionVoSrc / correctReactionSrc.
const QUESTIONS: Question[] = [
  {
    // Q1 (90%) — Find the Mistake.
    // The intro video poses the question ("Can you find the mistake?"
    // with 'the' written twice in the run-up text). User types what
    // they spotted; OpenAI semantically grades the answer. The Q1 path
    // in handleAnswer below also short-circuits to correct on a bare
    // "the" so a one-word answer still passes.
    id: 1,
    percentage: 90,
    question: "What is the answer to this question?",
    image: "/questionscreenimages/question1(findthemistake-90)/q1mistake.png",
    textInput: true,
    correctAnswerText: "The word 'the' appears twice / the article 'the' is doubled / 'the the' is written repeated",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    // Q2 (80%) — Gandhiji photo MCQ.
    // Three image tiles. Photo 1 is the doctored / impossible one
    // (correct answer); photos 2 and 3 are real. No "ALL ARE REAL"
    // option — pure 3-tile image pick.
    id: 2,
    percentage: 80,
    question: "Which photograph of Gandhiji cannot be real?",
    images: [
      "/questionscreenimages/question2(gandhijirealornot-80)/gandhijiinaccurate.png",
      "/questionscreenimages/question2(gandhijirealornot-80)/gandhjiaccurate1-ezremove.png",
      "/questionscreenimages/question2(gandhijirealornot-80)/gandhjiaccurate2-ezremove.png",
    ],
    // No imageCaptions: the photos ARE the answer — the A/B/C corner badge
    // already labels each tile, so a "Photo 1/2/3" caption underneath only
    // ate vertical space that the photos themselves needed to be readable.
    imagesAreOptions: true,
    options: ["Photo 1", "Photo 2", "Photo 3"],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    // Q3 (70%) — Cards & Glasses.
    // 2-option text MCQ with one backing image. Standard text-button
    // renderer (NOT imagesAreOptions); the image sits above the buttons.
    id: 3,
    percentage: 70,
    question: "What are there more of in this picture: cards or glasses?",
    image: "/questionscreenimages/question3(cardsnglasses-70)/q3cardsnglasses.png",
    options: ["Cards", "Glasses"],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    // Q4 (60%) — Jessica & Mandy.
    // Pure text puzzle, no image. Twist: Mandy IS the NAME of Jessica's
    // sister (since Jessica's only sister is Mandy herself). Accept any
    // spelling/casing of "name" or "naam"; reject "Mandy", "herself",
    // "sister", or any other relational answer. Semantic grading via OpenAI.
    id: 4,
    percentage: 60,
    question: "Jessica is Mandy's only sister. Mandy is the _____ of Jessica's sister.",
    textInput: true,
    correctAnswerText: "The literal word 'name' (or its Hindi equivalent 'naam'). The puzzle's twist is that Mandy IS the name of Jessica's sister, since Jessica's only sister is Mandy herself. Accept any spelling/casing of 'name' or 'naam'. REJECT 'Mandy', 'herself', 'sister', or any other relational answer.",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    // Q5 (50%) — Biggest SQUARE among three shapes.
    // Three image tiles, single correct (index 0). Same imagesAreOptions
    // 3-tile renderer used by Q2.
    id: 5,
    percentage: 50,
    question: "Which SQUARE has the biggest total area?",
    images: [
      "/questionscreenimages/question5(biggestsquare-50)/q5image1.png",
      "/questionscreenimages/question5(biggestsquare-50)/q5image2.png",
      "/questionscreenimages/question5(biggestsquare-50)/q5image3.png",
    ],
    imageCaptions: ["A", "B", "C"],
    imagesAreOptions: true,
    options: ["A", "B", "C"],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    // Q6 (40%) — Four transports rearranged by passenger capacity.
    // Images alphabetical: bike, bus, car, plane. After rearranging
    // low→high by passenger count: bike (1), car (5), bus (40), plane (200)
    // → only bike (pos 1) and plane (pos 4) stay put. Answer: 2.
    id: 6,
    percentage: 40,
    question: "Four modes of transport are arranged below alphabetically. If you rearrange them from lowest to highest by the number of passengers they typically carry, how many will stay in the same place?",
    images: [
      "/questionscreenimages/question6(4transports-40)/bike.png",
      "/questionscreenimages/question6(4transports-40)/bus.png",
      "/questionscreenimages/question6(4transports-40)/car.png",
      "/questionscreenimages/question6(4transports-40)/plane.png",
    ],
    imageCaptions: ["Bike", "Bus", "Car", "Plane"],
    compactImageRow: true,
    options: ["1", "2", "3"],
    correctIndex: 1,
    timeLimit: 30,
  },
  {
    // Q7 (30%) — Earth & Mars anagram.
    // Single backing image + text input. Earth contains the anagram
    // HEART; Mars contains the anagram ARMS. Semantic grading.
    id: 7,
    percentage: 30,
    question: "If planet 'Earth' has a 'Heart', which body part does planet 'Mars' have?",
    image: "/questionscreenimages/question7(earthnmars-30)/q7earthnmars.png",
    textInput: true,
    correctAnswerText: "ARMS (anagram of MARS — the letters of the word Mars rearranged spell Arms)",
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    // Q8 (20%) — Gymnast left foot.
    // Single backing image with the labels A and B baked into the image
    // itself; options below are simple text buttons. Do NOT set
    // imagesAreOptions — the image is informational, the answer is text.
    id: 8,
    percentage: 20,
    question: "Which one (A or B) is the gymnast's left foot?",
    image: "/questionscreenimages/question8(gymnast-20)/gymnast.png",
    options: ["A", "B"],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    // Q9 (10%) — Shapes-to-Numbers.
    // Single backing image (the shape diagram). Single-digit number input;
    // exact numeric match against correctNumber=3.
    id: 9,
    percentage: 10,
    question: "You need to put a number from 1 to 6 into each circle, but you can only use each number once. What number will replace the question mark?",
    image: "/questionscreenimages/question9(number1to6-10)/q9image.png",
    numberInput: true,
    maxDigits: 1,
    correctNumber: 3,
    options: [],
    correctIndex: 0,
    timeLimit: 30,
  },
  {
    // Q10 (1%) — TNECREPE reversed phrase.
    // wordPuzzle renders as oversized monospace ("T N E C R E P E _ _").
    // 4-option text MCQ. TNECREPENO reversed = "ONE PERCENT", so
    // correct answer is "NO" (index 2 → C). No backing image — wordPuzzle
    // is the visual. Distractor letters (OP, ER, RE) are all 2-letter
    // English-looking pairs so the puzzle stays a pure pattern test.
    id: 10,
    percentage: 1,
    question: "What are the next 2 letters in this sequence?",
    wordPuzzle: "T N E C R E P E _ _",
    options: ["OP", "ER", "NO", "RE"],
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

// ─── DEV-ONLY: ?devq= quick-jump (REMOVE BEFORE PROD) ───
/**
 * Dev-only: seeds GameState so QuizGame mounts directly at the intro video
 * for question `qIdx0` (zero-based). Previous questions are marked correct
 * with sensible mock pot/elimination accumulation so the journey ticker,
 * remaining-players counter, and pot total display believable values.
 */
function createDevQuestionStartState(qIdx0: number): GameState {
  const safeIdx = Math.max(0, Math.min(qIdx0, QUESTIONS.length - 1));
  const stakePerPlayer = 100000;
  const totalPlayers = 100;
  let remaining = totalPlayers;
  let pot = 0;
  const eliminatedHistory: number[] = [];
  for (let i = 0; i < safeIdx; i++) {
    const q = QUESTIONS[i];
    if (!q) continue;
    const failRate = (100 - q.percentage) / 100;
    const eliminated = Math.min(remaining - 1, Math.max(0, Math.round(remaining * failRate)));
    eliminatedHistory.push(eliminated);
    remaining -= eliminated;
    pot += eliminated * stakePerPlayer;
  }
  return {
    currentQuestion: safeIdx,
    totalPlayers,
    remainingPlayers: remaining,
    potPrize: pot,
    stakePerPlayer,
    playerAnswers: Array.from({ length: safeIdx }, () => 0),
    playerAnswerTexts: Array.from({ length: safeIdx }, () => null),
    playerCorrect: Array.from({ length: safeIdx }, () => true),
    eliminatedThisRound: eliminatedHistory,
    phase: "question-intro",
  };
}
// ─── END DEV-ONLY ───

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

  // ── All non-final rounds (original crowd simulation, unchanged) ───────
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
  /** Fires true ONLY while a reaction video (correct/wrong/winner) is playing,
   *  NOT during question-intro videos. Lets the parent decide whether to pause
   *  BGM: paused for reactions, kept on (lower) for AK question delivery. */
  onReactionVideoActiveChange?: (active: boolean) => void;
  /** Fires true when the question-screen countdown is actively ticking (tour
   *  done, narration finished, not yet answered). Lets the parent pause the
   *  theme music so the ITV 30-second timer jingle takes the sonic stage. */
  onQuestionTimerActiveChange?: (active: boolean) => void;
  /** True from answer submitted through elimination (until Next question); pauses BGM. */
  onEliminationSequenceActiveChange?: (active: boolean) => void;
  /** Fires true when the final ending-video overlay or the final-result summary
   *  screen is active. Lets the parent (`GameFlow`) hide the persistent top-left
   *  3D logo so the centerpiece animation can stand alone, per client request. */
  onFinalScreenActiveChange?: (active: boolean) => void;
  /** `next dev` only: `GameFlow` sets this to open directly on the perfect-score final result. */
  devChampionPreview?: boolean;
  // ─── DEV-ONLY: ?devq= quick-jump (REMOVE BEFORE PROD) ───
  /** Dev-only jump: when set to a 1-based question number, QuizGame mounts
   *  with gameState seeded at that question intro video, tour skipped,
   *  prior-question state filled with sensible mock values so the journey
   *  ticker / pot / remaining-players counts look believable. */
  devStartFromQuestion?: number;
  // ─── END DEV-ONLY ───
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
  onReactionVideoActiveChange,
  onQuestionTimerActiveChange,
  onEliminationSequenceActiveChange,
  onFinalScreenActiveChange,
  devChampionPreview = false,
  // ─── DEV-ONLY: ?devq= quick-jump (REMOVE BEFORE PROD) ───
  devStartFromQuestion,
  // ─── END DEV-ONLY ───
  onBackToMenu = () => {},
  onRegisterBack,
}: QuizGameProps) {
  const [gameState, setGameState] = useState<GameState>(() => {
    // ─── DEV-ONLY: ?devq= quick-jump (REMOVE BEFORE PROD) ───
    if (typeof devStartFromQuestion === "number" && devStartFromQuestion >= 1) {
      return createDevQuestionStartState(devStartFromQuestion - 1);
    }
    // ─── END DEV-ONLY ───
    return devChampionPreview ? createDevChampionInitialState() : getDefaultQuizGameState();
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
  >(() => {
    // ─── DEV-ONLY: ?devq= quick-jump (REMOVE BEFORE PROD) ───
    if (typeof devStartFromQuestion === "number" && devStartFromQuestion >= 1) {
      return "done";
    }
    // ─── END DEV-ONLY ───
    return devChampionPreview ? "done" : "prompt";
  });
  // True when the user clicked "Replay tour" from the ready-gate.
  // Triggers a fast, no-narration recap pass through ProductTour.
  // Reset back to false whenever the tour finishes/skips so a subsequent
  // first-time entry (defensive — shouldn't happen) gets full narration.
  const [tourReplayFast, setTourReplayFast] = useState(false);

  // Reaction video overlay state
  const [reactionVideo, setReactionVideo] = useState<"correct" | "wrong" | "winner" | null>(null);
  /** True for the first 10 seconds of the final-question (Q10) winner reaction
   *  video — drops metallic gold confetti from the top of the screen above the video. */
  const [lastQuestionConfettiActive, setLastQuestionConfettiActive] = useState(false);
  /** Drives the right-side `CorrectAnswerPanel` slide-in. Flips true ~1.2s
   *  after ANY reaction (correct, wrong, or winner) starts — the panel
   *  always teaches what the right answer was. Flips false the moment the
   *  reaction ends, the video begins its outro wipe, or the phase
   *  transitions out, so the panel slide-out runs concurrently with the
   *  video fade rather than lingering after it. */
  const [showCorrectPanel, setShowCorrectPanel] = useState(false);
  /** Picked when showing a wrong reaction; stable URL for the clip (Q1–Q9 random, Q10 fixed). */
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
  /** Plays after the user clicks "See end screen" on the last question. */
  const finalVideoRef = useRef<HTMLVideoElement | null>(null);
  const [introOutroActive, setIntroOutroActive] = useState(false);
  const [reactionOutroActive, setReactionOutroActive] = useState(false);
  const [finalVideoOutroActive, setFinalVideoOutroActive] = useState(false);
  const introOutroArmedRef = useRef(false);
  const reactionOutroArmedRef = useRef(false);
  const finalVideoOutroArmedRef = useRef(false);

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
    setTourReplayFast(false);
    setTourState("ready-gate");
  }, [stop]);

  const handleSkipTour = useCallback(() => {
    stop();
    setTourReplayFast(false);
    // Skipping still goes through the ready-gate so the user explicitly starts Q1
    setTourState("ready-gate");
  }, [stop]);

  const handleConfirmReady = useCallback(() => {
    stop();
    setTourState("done");
    // Note: `questionIntroDoneRef` starts as false (from useRef(false)) on
    // first entry, so no explicit reset is needed here. The useEffect below
    // also resets it when phase becomes "question-intro" as a safety net.
    // The real race only matters on subsequent transitions (Q1→Q2, Q2→Q3, …)
    // and is handled inside `handleContinue`.
    setGameState(prev => ({ ...prev, phase: "question-intro" }));
  }, [stop]);

  /**
   * Runs a right-to-left wipe, calls `change` to swap underlying content
   * while the screen is black, then clears the wipe. Total blackout ~420ms.
   */
  const runWipeThen = useCallback((change: () => void) => {
    setWipeActive(true);
    // Whoosh SFX for the wipe — synth-generated, no asset overhead.
    if (!muted) playWhoosh({ intensity: "normal" });
    // Wipe covers the screen in 500ms. Swap content at 420ms (while black).
    setTimeout(() => { change(); }, 420);
    // Clear the wipe (it slides out left) at 560ms total.
    setTimeout(() => { setWipeActive(false); }, 560);
  }, [muted]);

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

  /**
   * Watchdog for the question-intro video.
   *
   * If the <video> element silently fails to progress — autoplay rejected
   * during the heavy phase-transition tick, codec rejection that doesn't fire
   * `error`, CDN stall, etc. — neither `onEnded` nor `onError` will fire and
   * the screen sits on a black overlay forever. Production intro clips run
   * roughly 5–15s, so a 30s ceiling is generous for a healthy playback while
   * still bailing the user out of a stuck transition (the symptom Abhinav saw
   * on Q2 after the elimination screen).
   *
   * Cleanup runs whenever phase / question / tour-state changes, so a normal
   * onEnded → handleQuestionIntroEnd → phase="question" path tears the timer
   * down before it ever fires.
   */
  useEffect(() => {
    if (gameState.phase !== "question-intro" || tourState !== "done") return;
    const watchdogId = window.setTimeout(() => {
      if (questionIntroDoneRef.current) return;
      console.warn(
        `[intro-video] watchdog fired for Q${gameState.currentQuestion + 1} — ` +
          "no onEnded/onError within 30s; forcing transition to question.",
      );
      handleQuestionIntroEnd();
    }, 30_000);
    return () => window.clearTimeout(watchdogId);
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

  /** Called when the post-game ending video finishes (or the user skips it).
   *  Wipes from the video to the final-result summary screen. */
  const handleFinalVideoEnd = useCallback(() => {
    runWipeThen(() => {
      setGameState(prev => ({ ...prev, phase: "final-result" }));
    });
  }, [runWipeThen]);

  const handleContinue = useCallback(() => {
    const nextQ = gameState.currentQuestion + 1;
    if (nextQ >= QUESTIONS.length) {
      // Last question complete: wipe into the full-screen ending video. When
      // the video finishes (handleFinalVideoEnd below) we transition to the
      // `final-result` summary screen.
      runWipeThen(() => {
        setGameState(prev => ({ ...prev, phase: "final-video" }));
      });
      const correct = gameState.playerCorrect.filter(Boolean).length;
      onGameEnd?.({ correct, total: QUESTIONS.length, potPrize: gameState.potPrize });
    } else {
      // Reset the "intro already finished" guard SYNCHRONOUSLY before the wipe
      // commits the new phase. The useEffect-based reset (further below) runs
      // after commit, which races with synchronous error events on the new
      // <video> element (e.g. cached 404 / unsupported codec) — those events
      // would call handleQuestionIntroEnd, see the guard still set to `true`
      // from the previous question, early-return, and leave the screen stuck
      // on a black intro overlay. Resetting here means any post-mount event
      // can drive the next transition.
      questionIntroDoneRef.current = false;
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
  // Resolved at render time so the right ending clip is selected the moment
  // the player clicks "See end screen" on the elimination overlay. Recomputes
  // every render from the current playerCorrect snapshot — cheap, no memo.
  const finalVideoSrc = pickFinalVideoSrc(gameState.playerCorrect);

  // Reset the outro wipe whenever a new overlay mounts.
  useEffect(() => {
    setIntroOutroActive(false);
    introOutroArmedRef.current = false;
  }, [introVideoSrc, gameState.phase, tourState]);
  useEffect(() => {
    setReactionOutroActive(false);
    reactionOutroArmedRef.current = false;
  }, [reactionVideoSrc]);
  useEffect(() => {
    if (gameState.phase !== "final-video") {
      setFinalVideoOutroActive(false);
      finalVideoOutroArmedRef.current = false;
    }
  }, [gameState.phase]);

  // Confetti drop on the final-question winner reaction. Mounts the metallic
  // confetti layer above the reaction video for the first 10 seconds of playback,
  // then auto-stops. The layer is unmounted on cleanup so a back-out / quick
  // skip can't leave confetti hanging on screen.
  useEffect(() => {
    if (reactionVideo !== "winner") {
      setLastQuestionConfettiActive(false);
      return;
    }
    setLastQuestionConfettiActive(true);
    const t = window.setTimeout(() => {
      setLastQuestionConfettiActive(false);
    }, 10000);
    return () => {
      window.clearTimeout(t);
      setLastQuestionConfettiActive(false);
    };
  }, [reactionVideo]);

  // Right-side answer-explanation panel. Fires for ANY reaction (correct,
  // winner, OR wrong) and waits 1.2s so AK's opening beat plays first. On
  // wrong reactions the panel still teaches what the correct answer was —
  // that was missing originally and Abhinav flagged it on Q5 wrong.
  // Cleanup hides the panel immediately on any change in reactionVideo
  // (skip, end, phase change, unmount), driving the AnimatePresence exit
  // transition (slide-out to the right).
  useEffect(() => {
    if (reactionVideo == null) {
      setShowCorrectPanel(false);
      return;
    }
    // Don't carry over a stale "true" from a previous reaction.
    setShowCorrectPanel(false);
    const t = window.setTimeout(() => {
      setShowCorrectPanel(true);
    }, 1200);
    return () => {
      window.clearTimeout(t);
      setShowCorrectPanel(false);
    };
  }, [reactionVideo]);

  // Sync the panel's slide-out with the video's own outro wipe. The video
  // arms `reactionOutroActive` ~1.05s before its end — the moment that
  // fires we hide the panel so its 400ms slide-out and the video's fade
  // happen concurrently instead of the panel lingering past the video.
  useEffect(() => {
    if (reactionOutroActive) setShowCorrectPanel(false);
  }, [reactionOutroActive]);

  // Hide the floating mute button whenever a full-screen video overlay is on,
  // otherwise it stacks on top of the video's own "Skip ▸" button bottom-right.
  const videoOverlayActive =
    !!reactionVideoSrc ||
    (gameState.phase === "question-intro" && tourState === "done") ||
    gameState.phase === "final-video";

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
  useVideoAutoplay(finalVideoRef, gameState.phase === "final-video");

  // Mirror this to the parent so it can hide the 3D logo while a video plays.
  useEffect(() => {
    onVideoOverlayChange?.(videoOverlayActive);
  }, [videoOverlayActive, onVideoOverlayChange]);

  // Tell the parent when the ending video / final summary screen is active so
  // it can hide the persistent top-left 3D logo (the centerpiece animation
  // owns the brand mark on this page).
  const finalScreenActive =
    gameState.phase === "final-video" || gameState.phase === "final-result";
  useEffect(() => {
    onFinalScreenActiveChange?.(finalScreenActive);
  }, [finalScreenActive, onFinalScreenActiveChange]);

  // Reaction-video-only flag: BGM is paused for reactions, but kept playing
  // (at normal volume) underneath the AK question-intro video.
  const reactionVideoActive = !!reactionVideoSrc;
  useEffect(() => {
    onReactionVideoActiveChange?.(reactionVideoActive);
  }, [reactionVideoActive, onReactionVideoActiveChange]);

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

  /** Active during answered + elimination phases. GameShowAudio uses this
   *  signal to keep BGM playing at lower volume + slower tempo instead of
   *  fully muting (so the elimination scene still has a music bed). */
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
    if (gameState.phase === "final-result" || gameState.phase === "final-video") {
      // Rewind out of the ending video / summary back to the final-question elimination overlay.
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
              preload="metadata"
              muted={muted}
              onTimeUpdate={(e) => {
                if (introOutroArmedRef.current) return;
                const el = e.currentTarget;
                if (!Number.isFinite(el.duration) || el.duration <= 0) return;
                // Per-question outro lead time (seconds before video end at
                // which the black wipe arms). Default 1.05s.
                //   Q6 (40% transports): 2.5s — fade was felt too late.
                //   Q10 (1% TNECREPE):    0.2s — fade was felt too early
                //                                and ate the final beat of
                //                                the clip.
                // Easy to extend per-question by adding more entries here.
                const qid = gameState.currentQuestion + 1;
                const leadSec = qid === 6 ? 2.5 : qid === 10 ? 0.2 : 1.05;
                if (el.duration - el.currentTime <= leadSec) {
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
              preload="metadata"
              muted={muted}
              onTimeUpdate={(e) => {
                if (reactionOutroArmedRef.current) return;
                const el = e.currentTarget;
                if (!Number.isFinite(el.duration) || el.duration <= 0) return;
                // Per-question outro lead time (seconds before reaction-video
                // end at which the panel slide-out + black wipe arm). Default
                // 0.5s — panel stays visible longer so explanations get full
                // reading time. Q2 (Gandhi) gets an even tighter 0.25s lead
                // because its panel is image + caption (more to take in than
                // a one-line text reasoning).
                const qid = gameState.currentQuestion + 1;
                const reactionLeadSec = qid === 2 ? 0.25 : 0.5;
                if (el.duration - el.currentTime <= reactionLeadSec) {
                  reactionOutroArmedRef.current = true;
                  setReactionOutroActive(true);
                }
              }}
              onEnded={handleReactionVideoEnd}
              onError={handleReactionVideoEnd}
              src={reactionVideoSrc}
            />
            <VideoOutroWipe active={reactionOutroActive} />

            {/* ━━ Answer-explanation panel — slides in from the right edge
                    ~1.2s into ANY reaction (correct, winner, OR wrong). On
                    wrong reactions the panel still teaches what the right
                    answer was. Floats ABOVE the video at z-[5]; the video
                    element above is untouched (its CSS dimensions, parent,
                    and aspect ratio stay exactly as they were). The skip
                    pill below sits at z-10 so it remains clickable on top
                    of the panel. The panel auto-hides when the video arms
                    its outro wipe so both fades run together. ━━ */}
            <CorrectAnswerPanel
              questionId={gameState.currentQuestion + 1}
              visible={showCorrectPanel && reactionVideo != null}
              reactionKind={reactionVideo}
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

      {/* ━━ Final-question (Q10) winner confetti — drops from the top for the
              first 10s of the "1percentfinalcorrect" reaction video. Layer sits at z-[96], one
              level above the z-[95] reaction overlay so the gold strips are
              visible against the video. Pointer-events-none so the Skip pill
              underneath stays clickable. ━━ */}
      {lastQuestionConfettiActive && (
        <WinnerMetallicConfetti
          className="pointer-events-none fixed inset-0 z-[96] overflow-hidden"
        />
      )}

      {/* ━━ Ending Video Overlay (plays once after the user clicks "See end screen") ━━ */}
      <AnimatePresence>
        {gameState.phase === "final-video" && (
          <motion.div
            key="final-video"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-0 z-[95] bg-black flex items-center justify-center"
          >
            <video
              ref={finalVideoRef}
              key={finalVideoSrc}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              preload="metadata"
              muted={muted}
              onTimeUpdate={(e) => {
                if (finalVideoOutroArmedRef.current) return;
                const el = e.currentTarget;
                if (!Number.isFinite(el.duration) || el.duration <= 0) return;
                if (el.duration - el.currentTime <= 1.05) {
                  finalVideoOutroArmedRef.current = true;
                  setFinalVideoOutroActive(true);
                }
              }}
              onEnded={handleFinalVideoEnd}
              onError={handleFinalVideoEnd}
              src={finalVideoSrc}
            />
            <VideoOutroWipe active={finalVideoOutroActive} />
            {/* Skip → jump straight to the final-result summary screen */}
            <button
              onClick={handleFinalVideoEnd}
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
                Guided instructions
              </p>
              <h3 className="font-display text-2xl md:text-[1.75rem] font-semibold text-foreground mb-4 leading-tight">
                Pehle, kuch quick instructions
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
                  <span className="relative z-10">Read Instructions</span>
                </motion.button>
                <button
                  onClick={handleSkipTour}
                  className="w-full cursor-pointer rounded-xl border border-brass/25 bg-black/40 py-3 text-center text-[11px] font-mono uppercase tracking-[0.28em] text-brass-dim hover:border-brass/50 hover:text-brass-bright hover:bg-black/60 transition-colors"
                >
                  Skip instructions
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
          fast={tourReplayFast}
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
                  Instructions complete
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
                      setTourReplayFast(true);
                      setTourState("playing");
                    }}
                    className="w-full cursor-pointer rounded-xl border border-brass/25 bg-black/40 py-3 text-center text-[11px] font-mono uppercase tracking-[0.28em] text-brass-dim hover:border-brass/50 hover:text-brass-bright hover:bg-black/60 transition-colors"
                  >
                    Replay instructions
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

function WinnerMetallicConfetti({ className }: { className?: string } = {}) {
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
      className={
        className ??
        "pointer-events-none fixed inset-0 z-[1] overflow-hidden"
      }
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
//
// The 3D stage scene (FinalStage3D) was removed per client request. The new
// final summary is a flat, centered layout: the Unicorn Studio scene that
// used to live on the middle LED is now the brand mark on this page (which
// is why GameFlow hides the persistent top-left 3D logo while we're here),
// followed by the run stats and the "Coming Soon" tagline in bold gold.
function FinalResult({
  correctCount,
  totalQuestions,
  potPrize,
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

  // Removed: the ENDING_VO MP3 playback that previously fired here.
  // The .mp4 ending video that plays JUST BEFORE this screen mounts already
  // carries the same VO baked into video, so playing the MP3 here on top
  // duplicated the narration. Sound on this screen is now: applause (above,
  // winners only) + the BGM that resumes from GameFlow + the bgvideo loop.

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
      // z-[100] sits above the persistent top-left 3D logo (z-[85]) as a belt-
      // and-braces guarantee — GameFlow also hides the logo via the
      // onFinalScreenActiveChange callback, but stacking-context belt is cheap.
      className="fixed inset-0 z-[100] w-screen h-[100dvh] overflow-hidden bg-black flex flex-col items-center justify-center px-6"
    >
      {/* ━━ Layer 0: looping question-screen stage video (same one used during
              gameplay) so the final summary sits in the same world. ━━ */}
      <video
        src={encodeURI("https://pub-8c6819b7ba514c68a355fd5d6d7d43c6.r2.dev/bgvideo (1).mp4")}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none"
        aria-hidden
      />

      {/* ━━ Layer 1: black vignette overlay. Darker towards the edges, near-
              transparent in the centre so the centerpiece reads cleanly while
              the BG video stays present in the periphery. ━━ */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 75% at 50% 50%, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.78) 55%, rgba(0,0,0,0.94) 100%)",
        }}
      />

      {/* Soft brass radial glow behind the centerpiece (sits above vignette) */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(95vw,900px)] h-[min(95vw,900px)] rounded-full bg-brass/[0.08] blur-[120px]" />
      </div>

      {/* Centerpiece: Unicorn Studio scene (the JSON animation that previously
          played on the FinalStage3D middle LED — now the hero of this page).

          Visible "centerpiece" footprint = 78vmin square (unchanged), but the
          actual UnicornScene canvas is rendered at 165% of that, absolutely
          centered and overflowing on all sides. Reason: the scene's outward
          rays render onto the canvas's pixel buffer; whatever the canvas
          edge is, that's where rays get clipped. By giving the canvas more
          pixel space than the visible frame, the rays have room to taper
          off naturally and appear to flow OUTSIDE the box. The wrapper has
          no overflow set (defaults to visible) so nothing clips them back. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-[5] w-[min(78vmin,640px)] aspect-square flex items-center justify-center"
      >
        <div
          className="pointer-events-none absolute"
          style={{
            // 165% of the visible centerpiece — gives the scene's outward
            // rays ~32% of canvas-radius beyond the perceived "box" before
            // they hit the canvas edge.
            width: "165%",
            height: "165%",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            // The Unicorn scene JSON has a baked-in black background that
            // would otherwise occlude the bgvideo behind it. "screen" blend
            // mode treats black as transparent (max-of-channels math) so
            // the bgvideo shows through, while the gold rays + logo stay
            // visible (and read slightly more luminous against the stage).
            mixBlendMode: "screen",
            zIndex: 1,
          }}
        >
          <UnicornSceneFinal
            jsonFilePath={FINAL_SCREEN_UNICORN_JSON_PATH}
            sdkUrl={FINAL_SCREEN_UNICORN_SDK_URL}
            width="100%"
            height="100%"
            production
            lazyLoad={false}
            dpi={1.5}
            fps={60}
          />
        </div>

        {/* ━━ Metallic gold gradient border around the centerpiece ━━
              Sits ABOVE the (oversized, mix-blended) canvas. The dual-
              background + mask trick draws a real gold gradient on the
              border ring while leaving the inside fully transparent so
              the canvas + bgvideo behind still show through. The 165%
              canvas extends past this frame on all sides, so rays still
              bleed outside the bordered box (which reads as: a gold-
              framed window with light escaping past the frame). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[20px]"
          style={{
            padding: "2px",
            // Multi-stop gradient with a bright highlight pass at ~28%
            // and another at ~68% — that double-highlight is what makes
            // metals read as "polished" rather than just "yellow".
            background:
              "linear-gradient(135deg, #ad841a 0%, #fff1bf 14%, #f5d76e 32%, #c89e2b 50%, #fff1bf 68%, #f5d76e 82%, #8e6a14 100%)",
            // Subtractive mask: paint everything in `padding-box`, then
            // subtract the inner `content-box` rectangle so only the
            // 2px border ring remains. xor / exclude keep the centre
            // fully transparent (no fill at all).
            WebkitMask:
              "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            // Soft outer glow + a faint inner highlight to sell depth.
            boxShadow:
              "0 0 28px -6px rgba(245, 215, 110, 0.45), 0 0 60px -16px rgba(245, 215, 110, 0.25)",
            zIndex: 2,
          }}
        />
      </motion.div>

      {/* Stats row: questions correct + pot.
          Margins tightened (was mt-6 md:mt-10) so the tagline below — and
          especially the "Coming Soon | August 2026" second line — stays
          inside the viewport on shorter laptop screens (~720-900px tall),
          where it was previously getting cropped under the bottom edge. */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
        className="relative z-[6] mt-3 md:mt-5 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-12"
      >
        <div className="flex flex-col items-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-brass-dim mb-2">
            Questions correct
          </p>
          <p className="font-display text-4xl md:text-5xl font-semibold tabular-nums text-foreground">
            {correctCount}
            <span className="text-foreground/45">/{totalQuestions}</span>
          </p>
        </div>

        <div className="hidden md:block w-px h-10 bg-gradient-to-b from-transparent via-brass/40 to-transparent" />

        <div className="flex flex-col items-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-brass-dim mb-2">
            In the pot
          </p>
          <p className="font-display text-4xl md:text-5xl font-semibold tabular-nums text-foreground">
            {formatRupees(potPrize)}
          </p>
        </div>
      </motion.div>

      {/* Gold tagline (bold, gradient gold per client direction).
          Two-line block — the "Coming Soon | August 2026" line is rendered
          as its own <p> beneath the brand line so it never collapses on
          narrow viewports and so its size can be tuned independently. */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="relative z-[6] mt-4 md:mt-6 text-center px-4 flex flex-col gap-1.5 md:gap-2"
      >
        <p
          className="font-display font-bold text-xl md:text-2xl lg:text-[1.7rem] leading-tight tracking-tight"
          style={{
            backgroundImage:
              "linear-gradient(180deg, #fff1bf 0%, #f5d76e 38%, #c89e2b 70%, #ad841a 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            textShadow: "0 0 28px rgba(245,215,110,0.18)",
          }}
        >
          Make your brand a part of the 1% Club.
        </p>
        <p
          className="font-display font-bold text-base md:text-lg lg:text-xl leading-tight tracking-[0.18em] uppercase"
          style={{
            backgroundImage:
              "linear-gradient(180deg, #fff1bf 0%, #f5d76e 38%, #c89e2b 70%, #ad841a 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            textShadow: "0 0 22px rgba(245,215,110,0.22)",
            opacity: 0.95,
          }}
        >
          Coming Soon · August 2026
        </p>
      </motion.div>
    </motion.div>
  );
}

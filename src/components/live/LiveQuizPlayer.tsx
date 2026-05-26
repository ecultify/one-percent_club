"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QuestionScreen from "@/components/QuestionScreen";
import GameShowAudio from "@/components/GameShowAudio";
import MuteButton from "@/components/MuteButton";
import {
  QUESTIONS,
  playQuizSfx,
  checkAnswerWithOpenAI,
} from "@/components/QuizGame";
import { useNarration } from "@/components/NarrationProvider";
import type { ClientMessage, RoomState } from "@/lib/quizProtocol";

/**
 * Live-quiz player: wraps the existing rich QuestionScreen + game-show
 * sound bed + per-question voice-over, but drives the flow from a
 * PartyKit room phase instead of the solo QuizGame state machine.
 *
 * Per-question flow (each participant runs through this independently
 * at their own pace once the host hits "Start"):
 *   1. Question lands → fire the VO via useNarration; timer paused.
 *   2. VO finishes → timer starts ticking.
 *   3. Player picks an answer (or timer hits 0) → answered=true with
 *      the correct/wrong feedback baked into QuestionScreen.
 *   4. Hold the reveal for ~2.5s so the player can see whether they
 *      got it right, then locally advance to the next question and
 *      report the answer to the server (which tallies the score).
 *   5. After Q10 → the player sees a "you're done" placeholder until
 *      the host hits End or the room phase flips to "ended".
 *
 * No videos play during the live quiz — only the QuestionScreen UI +
 * audio (theme bed + VO + SFX). Q-intros, reactions and the final-
 * video phase from the solo flow are intentionally absent.
 */

const REVEAL_HOLD_MS = 2500;

interface LiveQuizPlayerProps {
  roomCode: string;
  /** Current room state from the PartyKit subscription. */
  state: RoomState;
  /** Sender for client → server messages. */
  send: (msg: ClientMessage) => void;
  /** Optional participant name for fallback identification. */
  name: string;
  /** This connection's id, used to find self in state.participants. */
  myId: string | null;
}

export default function LiveQuizPlayer({ state, send, name, myId }: LiveQuizPlayerProps) {
  const me = useMemo(() => {
    if (!myId) return null;
    return state.participants.find((p) => p.id === myId) ?? null;
  }, [state.participants, myId]);

  // The server's currentQuestionIdx for this participant is the source
  // of truth — it advances when we report-answer. Locally we mirror it
  // and key the QuestionScreen on it so a question swap remounts.
  const serverQIdx = me?.currentQuestionIdx ?? 0;

  // Local per-question UI state. Reset on every question advance via
  // useEffect below.
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [validating, setValidating] = useState(false);
  const [narratingQuestion, setNarratingQuestion] = useState(false);

  const { narrateUrl, stop: stopNarration, muted } = useNarration();

  // Reset per-question UI state whenever the question changes.
  useEffect(() => {
    setAnswered(false);
    setSelectedAnswer(null);
    setIsCorrect(false);
    setValidating(false);
  }, [serverQIdx]);

  // Play the question's VO when each new question lands. Pauses the
  // QuestionScreen timer + locks inputs while it plays.
  useEffect(() => {
    if (state.phase !== "running") return;
    if (serverQIdx >= QUESTIONS.length) return;
    const q = QUESTIONS[serverQIdx];
    if (!q) return;
    let cancelled = false;
    setNarratingQuestion(true);
    const voPath = questionVoSrc(q.id);
    const done = narrateUrl(`live-q-${q.id}-vo`, voPath);
    void done.then(() => {
      if (!cancelled) setNarratingQuestion(false);
    });
    return () => {
      cancelled = true;
      stopNarration();
      setNarratingQuestion(false);
    };
  }, [state.phase, serverQIdx, narrateUrl, stopNarration]);

  // The advance-after-reveal timer. Set when an answer lands and runs
  // for REVEAL_HOLD_MS before reporting to the server (which bumps
  // serverQIdx, which resets local state via the effect above).
  const advanceTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current != null) {
        window.clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, []);

  const submitToServer = useCallback(
    (qIdx: number, answerValue: number | string | null, correct: boolean) => {
      send({ type: "report-answer", questionIdx: qIdx, answer: answerValue, correct });
    },
    [send],
  );

  const handleAnswer = useCallback(
    async (selectedIndex: number, typedAnswer?: string) => {
      const q = QUESTIONS[serverQIdx];
      if (!q) return;
      let correct: boolean;

      if (q.textInput) {
        if (typedAnswer === undefined) {
          correct = false;
        } else {
          setValidating(true);
          const raw = typedAnswer.trim().toLowerCase();
          // Q1: bare "the" counts (user spotted the duplicated article).
          if (q.id === 1 && /\bthe\b/.test(raw)) {
            correct = true;
          } else {
            correct = await checkAnswerWithOpenAI(
              typedAnswer,
              q.correctAnswerText ?? "",
              q.question,
            );
          }
          setValidating(false);
        }
      } else if (q.numberInput) {
        if (typedAnswer === undefined) {
          correct = false;
        } else {
          const typed = parseInt(typedAnswer.trim(), 10);
          correct = !Number.isNaN(typed) && typed === q.correctNumber;
        }
      } else if (q.acceptAny) {
        correct = true;
      } else {
        correct = selectedIndex === q.correctIndex;
      }

      stopNarration();
      setNarratingQuestion(false);
      setSelectedAnswer(selectedIndex);
      setIsCorrect(correct);
      setAnswered(true);
      playQuizSfx(correct ? "correct" : "wrong", muted);

      // Hold the reveal for REVEAL_HOLD_MS so the player sees the
      // glow / outline state, then report to the server which advances
      // their currentQuestionIdx (and resets local state via effect).
      const answerValue: number | string | null = typedAnswer ?? selectedIndex;
      if (advanceTimerRef.current != null) {
        window.clearTimeout(advanceTimerRef.current);
      }
      advanceTimerRef.current = window.setTimeout(() => {
        submitToServer(serverQIdx, answerValue, correct);
      }, REVEAL_HOLD_MS);
    },
    [serverQIdx, muted, stopNarration, submitToServer],
  );

  const handleTimeUp = useCallback(() => {
    if (answered) return;
    stopNarration();
    setNarratingQuestion(false);
    setSelectedAnswer(null);
    setIsCorrect(false);
    setAnswered(true);
    playQuizSfx("wrong", muted);
    if (advanceTimerRef.current != null) {
      window.clearTimeout(advanceTimerRef.current);
    }
    advanceTimerRef.current = window.setTimeout(() => {
      submitToServer(serverQIdx, null, false);
    }, REVEAL_HOLD_MS);
  }, [answered, serverQIdx, muted, stopNarration, submitToServer]);

  const totalQuestions = state.totalQuestions;
  const finished = me?.finishedAt != null || serverQIdx >= QUESTIONS.length;

  // ─── Render ────────────────────────────────────────────────────────────

  if (state.phase === "ended") {
    return <FinalLeaderboard state={state} myId={myId} />;
  }

  if (finished) {
    return <FinishedPlaceholder myScore={me?.score ?? 0} totalQuestions={totalQuestions} />;
  }

  const currentQ = QUESTIONS[serverQIdx];
  if (!currentQ) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-foreground/70">
        Loading question…
      </main>
    );
  }

  return (
    <main className="relative w-full h-screen overflow-hidden bg-black">
      <GameShowAudio
        playBgm={state.phase === "running"}
        suppressForVideo={false}
        slowMode={false}
      />
      <MuteButton />
      <QuestionScreen
        // Keying on serverQIdx forces a full QuestionScreen remount
        // between questions so its internal timer + state reset cleanly,
        // mirroring how the solo QuizGame keys it on currentQuestion.
        key={`q-${serverQIdx}`}
        question={currentQ}
        questionNumber={serverQIdx + 1}
        totalQuestions={totalQuestions}
        potPrize={0}
        remainingPlayers={state.participants.filter((p) => p.finishedAt == null).length}
        totalPlayers={state.participants.length}
        playerName={name || "Player"}
        onAnswer={handleAnswer}
        onTimeUp={handleTimeUp}
        onAnswerValidationPendingChange={setValidating}
        answered={answered}
        selectedAnswer={selectedAnswer}
        isCorrect={isCorrect}
        paused={narratingQuestion || validating}
      />
    </main>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**  Mirrors QUIZ_GAME's per-question VO path resolver. We keep a copy
 *   here so the live player isn't coupled to QuizGame's private
 *   QUESTION_PATHS table — but the file names are stable, so a flat
 *   `q<id>VO.mp3` style lookup with a small override map is enough. */
const VO_OVERRIDES: Record<number, string> = {
  1: "q1VO(canyoufindthemistake).mp3",
  2: "q2VO(gandhiji).mp3",
  3: "q3VO(cardsnglasses).mp3",
  5: "q5VOrevised.mp3",
};
const FOLDER_BY_QID: Record<number, string> = {
  1: "question1(findthemistake-90)",
  2: "question2(gandhijirealornot-80)",
  3: "question3(cardsnglasses-70)",
  4: "question4(jessicanmandy-60)",
  5: "question5(biggestsquare-50)",
  6: "question6(4transports-40)",
  7: "question7(earthnmars-30)",
  8: "question8(gymnast-20)",
  9: "question9(number1to6-10)",
  10: "question10(onepercent-1)",
};

function questionVoSrc(id: number): string {
  const folder = FOLDER_BY_QID[id];
  const filename = VO_OVERRIDES[id] ?? `q${id}VO.mp3`;
  return encodeURI(`/questionscreenimages/${folder}/${filename}`);
}

// ─── Sub-screens ────────────────────────────────────────────────────────

function FinishedPlaceholder({
  myScore,
  totalQuestions,
}: {
  myScore: number;
  totalQuestions: number;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-black px-6 text-center">
      <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brass/70">All done</p>
      <h1 className="mt-2 text-3xl font-semibold text-foreground">You answered all 10 questions</h1>
      <p className="mt-3 text-foreground/70">
        Your score: <span className="font-mono text-brass text-xl">{myScore}</span> / {totalQuestions}
      </p>
      <p className="mt-6 text-sm text-foreground/55">
        Waiting for the host to end the room so we can lock the leaderboard.
      </p>
    </main>
  );
}

function FinalLeaderboard({
  state,
  myId,
}: {
  state: RoomState;
  myId: string | null;
}) {
  const sorted = [...state.participants].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tiebreak: earlier finishers ahead.
    const aF = a.finishedAt ?? Number.MAX_SAFE_INTEGER;
    const bF = b.finishedAt ?? Number.MAX_SAFE_INTEGER;
    return aF - bF;
  });
  const myRank = myId ? sorted.findIndex((p) => p.id === myId) + 1 : null;
  const me = myId ? sorted.find((p) => p.id === myId) : null;

  return (
    <main className="min-h-screen bg-black text-foreground">
      <div className="mx-auto max-w-xl px-6 py-12 text-center">
        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brass/70">Finished</p>
        <h1 className="mt-2 text-3xl font-semibold">Quiz over</h1>
        {me && (
          <p className="mt-3 text-foreground/70">
            You scored <span className="font-mono text-brass text-xl">{me.score}</span> /
            {" "}
            {state.totalQuestions}
            {myRank ? ` · rank #${myRank}` : ""}
          </p>
        )}
        <ol className="mt-8 space-y-1 text-left text-sm">
          {sorted.slice(0, 20).map((p, i) => (
            <li
              key={p.id}
              className={`flex justify-between border-b border-brass/10 py-1.5 ${
                p.id === myId ? "text-brass" : "text-foreground/80"
              }`}
            >
              <span>
                <span className="mr-2 font-mono text-foreground/40">{i + 1}.</span>
                {p.name}
              </span>
              <span className="font-mono">{p.score}</span>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}

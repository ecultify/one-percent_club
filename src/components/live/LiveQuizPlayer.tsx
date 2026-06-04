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
import SpectatorView from "@/components/live/SpectatorView";
import FinalStandings from "@/components/live/FinalStandings";
import { questionVoSrc } from "@/components/live/questionVo";
import type { ClientMessage, RoomState } from "@/lib/quizProtocol";

/**
 * Live-quiz player. The SERVER drives one shared question for everyone
 * (state.currentQuestionIdx) and a per-question sub-phase
 * (state.roundPhase). This component:
 *
 *   1. Renders the rich QuestionScreen for the current shared question.
 *   2. Lets the player answer once, while roundPhase === "asking".
 *      Correctness is computed locally (matching the solo flow) and
 *      reported to the server with how long they took.
 *   3. Does NOT advance on its own — when the server's clock runs out it
 *      flips roundPhase to "revealing" (we force the correct-answer
 *      reveal) and then bumps currentQuestionIdx; everyone moves together.
 *   4. A wrong answer / timeout eliminates the player on the server. Once
 *      the round they went out on has passed, they flip to the spectator
 *      view and watch the survivors for the rest of the quiz.
 */

interface LiveQuizPlayerProps {
  roomCode: string;
  state: RoomState;
  send: (msg: ClientMessage) => void;
  name: string;
  myId: string | null;
}

export default function LiveQuizPlayer({ state, send, name, myId }: LiveQuizPlayerProps) {
  const me = useMemo(() => {
    if (!myId) return null;
    return state.participants.find((p) => p.id === myId) ?? null;
  }, [state.participants, myId]);

  const globalIdx = state.currentQuestionIdx;
  const roundPhase = state.roundPhase;
  const eliminated = me?.eliminated ?? false;
  const eliminatedAt = me?.eliminatedAtQuestion ?? null;

  // Local per-question UI state, reset whenever the shared question changes.
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [validating, setValidating] = useState(false);
  /** High-res timestamp captured when this question mounted, used to
   *  measure the player's answer speed. */
  const questionStartRef = useRef(0);

  const { narrateUrl, stop: stopNarration, muted } = useNarration();

  useEffect(() => {
    setAnswered(false);
    setSelectedAnswer(null);
    setIsCorrect(false);
    setValidating(false);
  }, [globalIdx]);

  // The answer clock starts when the server flips to "asking" (after the
  // VO). Anchor the speed measurement there so we record how fast they
  // answered once the clock was live.
  useEffect(() => {
    if (roundPhase === "asking") {
      questionStartRef.current = typeof performance !== "undefined" ? performance.now() : 0;
    }
  }, [globalIdx, roundPhase]);

  // Per-question voice-over. The server holds everyone in the
  // "narrating" sub-phase while this plays, then flips to "asking" and
  // starts the clock — so the VO is synchronized across the whole room
  // and the timer only begins once it has finished.
  const spectating = eliminated && (eliminatedAt == null || globalIdx > eliminatedAt);
  useEffect(() => {
    if (state.phase !== "running" || spectating) return;
    if (roundPhase !== "narrating") return;
    const q = QUESTIONS[globalIdx];
    if (!q) return;
    const done = narrateUrl(`live-q-${q.id}-vo`, questionVoSrc(q.id));
    void done.catch(() => {});
    return () => {
      stopNarration();
    };
  }, [state.phase, spectating, roundPhase, globalIdx, narrateUrl, stopNarration]);

  const handleAnswer = useCallback(
    async (selectedIndex: number, typedAnswer?: string) => {
      if (eliminated || roundPhase !== "asking" || answered) return;
      const q = QUESTIONS[globalIdx];
      if (!q) return;
      let correct: boolean;

      if (q.textInput) {
        if (typedAnswer === undefined) {
          correct = false;
        } else {
          setValidating(true);
          const raw = typedAnswer.trim().toLowerCase();
          if (q.id === 1 && /\bthe\b/.test(raw)) {
            correct = true;
          } else {
            correct = await checkAnswerWithOpenAI(typedAnswer, q.correctAnswerText ?? "", q.question);
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

      const elapsedMs =
        typeof performance !== "undefined" ? performance.now() - questionStartRef.current : 0;

      stopNarration();
      setSelectedAnswer(selectedIndex);
      setIsCorrect(correct);
      setAnswered(true);
      playQuizSfx(correct ? "correct" : "wrong", muted);

      const answerValue: number | string | null = typedAnswer ?? selectedIndex;
      send({ type: "report-answer", questionIdx: globalIdx, answer: answerValue, correct, elapsedMs });
    },
    [eliminated, roundPhase, answered, globalIdx, muted, stopNarration, send],
  );

  const handleTimeUp = useCallback(() => {
    if (answered) return;
    stopNarration();
    setSelectedAnswer(null);
    setIsCorrect(false);
    setAnswered(true);
    playQuizSfx("wrong", muted);
    // No report — the server eliminates players who didn't answer when its
    // own clock runs out, and drives the reveal for everyone.
  }, [answered, muted, stopNarration]);

  // ─── Render ────────────────────────────────────────────────────────────

  if (state.phase === "ended") {
    return <FinalStandings state={state} myId={myId} />;
  }

  if (!me) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-foreground/70">Joining…</main>
    );
  }

  // Eliminated and the round they went out on has passed → spectate.
  if (spectating) {
    return <SpectatorView state={state} name={name || me.name} banner="You're out — spectating" />;
  }

  const currentQ = QUESTIONS[globalIdx];
  if (!currentQ) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-foreground/70">
        Loading question…
      </main>
    );
  }

  const survivors = state.participants.filter((p) => !p.eliminated).length;

  return (
    <main className="relative w-full h-screen overflow-hidden bg-black">
      <GameShowAudio playBgm={state.phase === "running"} suppressForVideo={false} slowMode={false} />
      <MuteButton />
      <QuestionScreen
        key={`q-${globalIdx}`}
        question={currentQ}
        questionNumber={globalIdx + 1}
        totalQuestions={state.totalQuestions}
        potPrize={0}
        remainingPlayers={survivors}
        totalPlayers={state.participants.length}
        playerName={name || me.name}
        onAnswer={handleAnswer}
        onTimeUp={handleTimeUp}
        onAnswerValidationPendingChange={setValidating}
        // Force the reveal once the server closes the round, so a player
        // who answered wrong (or timed out) still sees the correct answer
        // before flipping to the spectator view.
        answered={answered || roundPhase === "revealing"}
        selectedAnswer={selectedAnswer}
        isCorrect={isCorrect}
        // Freeze the clock while the VO narrates; it starts only once the
        // server flips to "asking".
        paused={roundPhase === "narrating" || validating}
      />
    </main>
  );
}

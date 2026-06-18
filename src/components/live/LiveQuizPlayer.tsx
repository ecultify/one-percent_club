"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QuestionScreen from "@/components/QuestionScreen";
import GameShowAudio from "@/components/GameShowAudio";
import MuteButton from "@/components/MuteButton";
import {
  playQuizSfx,
  checkAnswerWithOpenAI,
} from "@/components/QuizGame";
import { useNarration } from "@/components/NarrationProvider";
import SpectatorView from "@/components/live/SpectatorView";
import FinalStandings from "@/components/live/FinalStandings";
import { getQuestionSet, setQuestionVoSrc } from "@/components/live/questionSets";
import { isMutedFor, type ClientMessage, type RoomState } from "@/lib/quizProtocol";

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

  // The room's question set (A/B/C) — picked by the host at room creation
  // and broadcast in every state snapshot.
  const questions = getQuestionSet(state.questionSet);
  const globalIdx = state.currentQuestionIdx;
  const roundPhase = state.roundPhase;
  const eliminated = me?.eliminated ?? false;
  const eliminatedAt = me?.eliminatedAtQuestion ?? null;
  /** false → unscored play-along (eliminated-then-continued, or a /watch
   *  viewer who opted to play). Such players answer along but never score,
   *  eliminate or gate the round. */
  const scoring = me?.scoring ?? true;
  /** Host master mute applies to me (silences VO + game-show audio), unless
   *  I'm on the host's unmuted-exemption list. */
  const roomMuted = isMutedFor(state, myId);

  // Local per-question UI state, reset whenever the shared question changes.
  const [answered, setAnswered] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [validating, setValidating] = useState(false);
  /** True when THIS round was passed via the skip lifeline (drives the
   *  "question skipped" overlay/banner instead of right/wrong). */
  const [skippedThisRound, setSkippedThisRound] = useState(false);
  /** Eliminated player's explicit choice: keep playing unscored ("play"),
   *  or just watch ("watch"). null until they've been asked. Lives for the
   *  whole game (the component unmounts when the room returns to lobby). */
  const [viewerChoice, setViewerChoice] = useState<null | "play" | "watch">(null);
  /** High-res timestamp captured when this question mounted, used to
   *  measure the player's answer speed. */
  const questionStartRef = useRef(0);

  const { narrateUrl, stop: stopNarration, muted } = useNarration();

  /** Guards the reveal SFX so it fires exactly once per question. */
  const sfxPlayedRef = useRef(false);

  useEffect(() => {
    setAnswered(false);
    setSelectedAnswer(null);
    setIsCorrect(false);
    setValidating(false);
    setSkippedThisRound(false);
    sfxPlayedRef.current = false;
  }, [globalIdx]);

  // Play the correct/wrong sting only on the shared reveal, so a fast
  // answerer doesn't hear the outcome before the rest of the room. A player
  // who locked the right answer hears "correct"; everyone else (wrong answer
  // or timed out) hears "wrong".
  useEffect(() => {
    if (roundPhase !== "revealing" || sfxPlayedRef.current) return;
    sfxPlayedRef.current = true;
    // A lifeline skip counts as surviving the round → "correct" sting.
    const wonRound = answered && (skippedThisRound || (selectedAnswer !== null && isCorrect));
    playQuizSfx(wonRound ? "correct" : "wrong", muted);
  }, [roundPhase, answered, selectedAnswer, isCorrect, skippedThisRound, muted]);

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
  // Show the passive elimination screen only for a SCORED player who is out
  // and hasn't opted to play along. Unscored players (scoring === false) keep
  // an interactive screen so they can play for fun.
  // Once the player has chosen "play", treat them as interactive locally even
  // while the server's scoring flag is still in flight — the opt-in effect
  // below re-sends until the server confirms, so a dropped message can't
  // strand them in the read-only spectator view.
  const spectating =
    scoring && eliminated && viewerChoice !== "play" && (eliminatedAt == null || globalIdx > eliminatedAt);

  // Deliver the play-along opt-in reliably: keep nudging the server while it
  // still has us as a scored (eliminated) player. Idempotent server-side.
  useEffect(() => {
    if (viewerChoice !== "play" || !scoring) return;
    send({ type: "continue-as-viewer" });
    const t = setInterval(() => send({ type: "continue-as-viewer" }), 1500);
    return () => clearInterval(t);
  }, [viewerChoice, scoring, send]);
  useEffect(() => {
    if (state.phase !== "running" || spectating) return;
    if (roundPhase !== "narrating") return;
    // In "Read out" mode the HOST reads the question aloud during this
    // hold; with "Mute VO" the server never enters narrating. Either way,
    // no recorded VO plays. (Both are lobby-locked room settings.)
    // The host master mute also silences VO for this player.
    if (state.hostNarration || state.muteVo || roomMuted) return;
    const voSrc = setQuestionVoSrc(state.questionSet, globalIdx);
    if (!voSrc) return; // no VO recorded — the server skips narrating anyway
    const done = narrateUrl(`live-${state.questionSet}-q${globalIdx}-vo`, voSrc);
    void done.catch(() => {});
    return () => {
      stopNarration();
    };
  }, [state.phase, state.questionSet, state.hostNarration, state.muteVo, roomMuted, spectating, roundPhase, globalIdx, narrateUrl, stopNarration]);

  const handleAnswer = useCallback(
    async (selectedIndex: number, typedAnswer?: string) => {
      // Unscored play-along players (scoring === false) may answer even
      // though they're flagged eliminated; only a scored-and-out player is
      // blocked here.
      if ((eliminated && scoring) || roundPhase !== "asking" || answered) return;
      const q = questions[globalIdx];
      if (!q) return;
      let correct: boolean;

      if (q.textInput) {
        if (typedAnswer === undefined) {
          correct = false;
        } else {
          setValidating(true);
          const raw = typedAnswer.trim().toLowerCase();
          // Deterministic fast-path (no AI round-trip) when the question
          // declares a passRegex; misses still fall through to the
          // semantic OpenAI check so phrasings/typos aren't punished.
          let fastPass = false;
          if (q.passRegex) {
            try {
              fastPass = new RegExp(q.passRegex, "i").test(raw);
            } catch {
              fastPass = false;
            }
          }
          if (fastPass) {
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
      // SFX is deferred to the shared reveal (see the roundPhase effect below)
      // so a fast answerer doesn't get an audio spoiler before everyone else.

      const answerValue: number | string | null = typedAnswer ?? selectedIndex;
      send({ type: "report-answer", questionIdx: globalIdx, answer: answerValue, correct, elapsedMs });
    },
    [eliminated, scoring, roundPhase, answered, questions, globalIdx, stopNarration, send],
  );

  const handleTimeUp = useCallback(() => {
    if (answered) return;
    stopNarration();
    setSelectedAnswer(null);
    setIsCorrect(false);
    setAnswered(true);
    // SFX deferred to the shared reveal. No report — the server eliminates
    // players who didn't answer when its own clock runs out, and drives the
    // reveal for everyone.
  }, [answered, stopNarration]);

  /** Spend the one skip-a-question lifeline: the server marks the round as
   *  passed (no score, no elimination) and flags it as used. Locally the
   *  round locks immediately with the "question skipped" treatment. */
  const handleUseLifeline = useCallback(() => {
    if ((eliminated && scoring) || !scoring || roundPhase !== "asking" || answered) return;
    if (me?.lifelineUsed) return;
    stopNarration();
    setSkippedThisRound(true);
    setSelectedAnswer(null);
    setIsCorrect(true); // survived the round (no score awarded server-side)
    setAnswered(true);
    send({ type: "use-lifeline", questionIdx: globalIdx });
  }, [eliminated, scoring, roundPhase, answered, me?.lifelineUsed, stopNarration, send, globalIdx]);

  // ─── Render ────────────────────────────────────────────────────────────

  if (state.phase === "ended") {
    return <FinalStandings state={state} myId={myId} />;
  }

  if (!me) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-foreground/70">Joining…</main>
    );
  }

  // Scored player who is out: FIRST a full, unmissable choice screen — keep
  // playing as an unscored viewer, or just watch. (Previously this dropped
  // them straight into the spectator view with only a small pill button,
  // which players often never saw.)
  if (spectating && viewerChoice === null) {
    return (
      <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-black px-6 text-center">
        <GameShowAudio playBgm suppressForVideo={false} slowMode={false} forceMuted={roomMuted} />
        <div className="relative z-[1] max-w-md">
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-red-300/80">Eliminated</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#fff4dc]">You&apos;re out of the running</h1>
          <p className="mt-3 text-sm leading-relaxed text-foreground/70">
            That answer knocked you out — but the game isn&apos;t over for you. Keep playing along as a
            viewer (your answers won&apos;t count), or sit back and watch the survivors.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setViewerChoice("play")}
              className="game-show-btn relative z-0 w-full max-w-xs cursor-pointer rounded-xl px-8 py-4 text-[13px] font-semibold uppercase tracking-[0.2em]"
            >
              <span className="relative z-10">Continue playing as viewer</span>
            </button>
            <button
              type="button"
              onClick={() => setViewerChoice("watch")}
              className="w-full max-w-xs cursor-pointer rounded-xl border border-brass/35 bg-black/55 px-8 py-3.5 text-[12px] font-semibold uppercase tracking-[0.2em] text-brass-bright/90 backdrop-blur transition-colors hover:border-brass/60"
            >
              Just watch
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (spectating) {
    return (
      <SpectatorView
        state={state}
        name={name || me.name}
        banner="You're out — spectating"
        onPlayAlong={() => setViewerChoice("play")}
        forceMuted={roomMuted}
      />
    );
  }

  const currentQ = questions[globalIdx];
  if (!currentQ) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-foreground/70">
        Loading question…
      </main>
    );
  }

  const survivors = state.participants.filter((p) => p.scoring && !p.eliminated).length;

  return (
    <main className="relative w-full h-screen overflow-hidden bg-black">
      <GameShowAudio playBgm={state.phase === "running"} suppressForVideo={false} slowMode={false} forceMuted={roomMuted} />
      <MuteButton />
      {/* The "host is reading the question" top chip was removed — the
          question block already shows a "Host is speaking" chip while the VO
          plays. The "playing along · unscored" note is now rendered by
          QuestionScreen directly above the question block (see `unscored`). */}
      <QuestionScreen
        key={`q-${state.questionSet}-${globalIdx}`}
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
        // `answered` locks the inputs the moment the player picks (gold
        // "locked — waiting" state). `revealed` holds the green/red reveal
        // until the server flips the whole room to "revealing", so everyone
        // sees correctness simultaneously.
        answered={answered || roundPhase === "revealing"}
        revealed={roundPhase === "revealing"}
        selectedAnswer={selectedAnswer}
        isCorrect={isCorrect}
        // Freeze the clock while the VO narrates; it starts only once the
        // server flips to "asking".
        paused={roundPhase === "narrating" || validating}
        // Live-only: transient heads-up chip + the locked-answer overlay.
        answerHintChip
        // Unscored play-along note ("eliminated, still playing for fun"),
        // rendered right above the question block instead of a floating chip.
        unscored={!scoring}
        // Skip-a-question lifeline: one per game, scored live players only,
        // unlocked from the 50% question onward.
        lifelineAvailable={
          scoring && !eliminated && !(me?.lifelineUsed ?? false) && currentQ.percentage <= 50
        }
        onUseLifeline={handleUseLifeline}
        skipped={skippedThisRound}
      />
    </main>
  );
}

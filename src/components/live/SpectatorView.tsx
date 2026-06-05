"use client";

import { useEffect, useState } from "react";
import QuestionScreen from "@/components/QuestionScreen";
import GameShowAudio from "@/components/GameShowAudio";
import MuteButton from "@/components/MuteButton";
import { QUESTIONS } from "@/components/QuizGame";
import { useNarration } from "@/components/NarrationProvider";
import { questionVoSrc } from "@/components/live/questionVo";
import { rankParticipants, scoredParticipants, unscoredParticipants } from "@/lib/quizProtocol";
import type { RoomState } from "@/lib/quizProtocol";

/**
 * Read-only live broadcast of a running quiz. Used by the /watch
 * spectator page and by players who have been eliminated (they flip to
 * this view for the rest of the game).
 *
 * It streams the same rich QuestionScreen everyone is on — synced to the
 * server's currentQuestionIdx and roundPhase — wrapped so it can't be
 * interacted with (no answering). A toggleable right column shows every
 * participant as a player chip and, after each question is revealed, how
 * many passed vs. were eliminated that round.
 */
const noop = () => {};

interface SpectatorViewProps {
  state: RoomState;
  /** Optional label for the viewer (their own name when they were a
   *  player who got eliminated). */
  name?: string;
  /** Banner shown top-left, e.g. "You're out — spectating". */
  banner?: string;
  /** When provided, shows a "Play as viewer" CTA — an eliminated player can
   *  opt to keep playing the rest of the quiz unscored. */
  onPlayAlong?: () => void;
}

export default function SpectatorView({ state, name, banner, onPlayAlong }: SpectatorViewProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const idx = state.currentQuestionIdx;
  const currentQ = QUESTIONS[idx];
  const narrating = state.roundPhase === "narrating";
  const revealing = state.roundPhase === "revealing";
  const survivors = state.participants.filter((p) => p.scoring && !p.eliminated).length;

  // Play the question VO in sync with the room while the server holds the
  // "narrating" sub-phase, so spectators hear the question read aloud too.
  const { narrateUrl, stop: stopNarration } = useNarration();
  useEffect(() => {
    if (state.phase !== "running" || !narrating || !currentQ) return;
    const done = narrateUrl(`live-q-${currentQ.id}-vo`, questionVoSrc(currentQ.id));
    void done.catch(() => {});
    return () => {
      stopNarration();
    };
  }, [state.phase, narrating, currentQ, narrateUrl, stopNarration]);

  return (
    <main className="relative flex h-screen w-full overflow-hidden bg-black">
      <GameShowAudio playBgm={state.phase === "running"} suppressForVideo={false} slowMode={false} />
      <MuteButton />

      {banner && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-40 -translate-x-1/2 rounded-full border border-red-500/40 bg-red-950/50 px-4 py-1.5 text-[10px] font-mono uppercase tracking-[0.3em] text-red-200 backdrop-blur">
          {banner}
        </div>
      )}

      {onPlayAlong && (
        <button
          onClick={onPlayAlong}
          className="absolute left-1/2 top-14 z-40 -translate-x-1/2 rounded-full border border-brass/50 bg-brass px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#14110a] shadow-[0_8px_22px_-8px_rgba(0,0,0,0.7)] transition-colors hover:bg-brass-bright"
        >
          Play as viewer ›
        </button>
      )}

      {/* Streaming question (read-only). pointer-events-none stops the
          spectator from clicking answers / pausing; the timer still ticks
          and the reveal is driven by the server's roundPhase. */}
      <div className="relative flex-1 overflow-hidden">
        {currentQ ? (
          <div className="pointer-events-none h-full w-full">
            <QuestionScreen
              key={`spectate-q-${idx}`}
              question={currentQ}
              questionNumber={idx + 1}
              totalQuestions={state.totalQuestions}
              potPrize={0}
              remainingPlayers={survivors}
              totalPlayers={state.participants.length}
              playerName={name || "Spectator"}
              onAnswer={noop}
              onTimeUp={noop}
              answered={revealing}
              revealed={revealing}
              selectedAnswer={null}
              isCorrect={false}
              // Clock frozen during the VO; ticks once the room is asking.
              paused={narrating}
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-foreground/60">Waiting for the next question…</div>
        )}
      </div>

      {/* Sidebar toggle (always reachable). */}
      <button
        onClick={() => setSidebarOpen((v) => !v)}
        className="absolute right-4 top-4 z-40 rounded-md border border-brass/40 bg-black/60 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-brass backdrop-blur hover:border-brass/70"
      >
        {sidebarOpen ? "Hide players ›" : "‹ Players"}
      </button>

      {sidebarOpen && <ParticipantsSidebar state={state} />}
    </main>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────

function ParticipantsSidebar({ state }: { state: RoomState }) {
  const idx = state.currentQuestionIdx;
  const revealing = state.roundPhase === "revealing";
  // Standings + round tallies are about the scored game only; unscored
  // play-along viewers are surfaced separately in the footer.
  const scored = scoredParticipants(state.participants);
  const playingAlong = unscoredParticipants(state.participants).length;
  const ranked = rankParticipants(scored);

  const total = scored.length;
  const survivors = scored.filter((p) => !p.eliminated).length;
  const passedThisRound = scored.filter((p) => p.correctness[idx] === true).length;
  const eliminatedThisRound = scored.filter((p) => p.eliminatedAtQuestion === idx).length;
  const answeredThisRound = scored.filter(
    (p) => p.correctness.length > idx && p.correctness[idx] != null,
  ).length;

  return (
    <aside className="z-30 flex h-full w-72 shrink-0 flex-col border-l border-brass/20 bg-neutral-950/90 backdrop-blur md:w-80">
      <div className="border-b border-brass/15 px-5 pb-4 pt-16">
        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brass/70">Participants</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">
          {survivors}
          <span className="text-base font-normal text-foreground/45"> / {total} still in</span>
        </p>
      </div>

      {/* Per-round tally */}
      <div className="border-b border-brass/15 px-5 py-4">
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-foreground/50">
          Round {idx + 1} of {state.totalQuestions}
        </p>
        {revealing ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/30 px-3 py-2">
              <p className="font-mono text-xl text-emerald-300">{passedThisRound}</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/70">passed</p>
            </div>
            <div className="rounded-lg border border-red-500/25 bg-red-950/30 px-3 py-2">
              <p className="font-mono text-xl text-red-300">{eliminatedThisRound}</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-red-200/70">eliminated</p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-foreground/55">
            <span className="font-mono text-brass">{answeredThisRound}</span> answered so far…
          </p>
        )}
      </div>

      {/* Player chips */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {ranked.length === 0 ? (
          <p className="px-1 text-sm text-foreground/50">No players yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-1.5">
            {ranked.map((p) => {
              const out = p.eliminated;
              const justOut = p.eliminatedAtQuestion === idx;
              return (
                <li
                  key={p.id}
                  title={
                    p.lateJoin
                      ? `${p.name} — joined late, spectating`
                      : out
                        ? `${p.name} — out at Q${(p.eliminatedAtQuestion ?? idx) + 1}`
                        : `${p.name} — still in`
                  }
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                    out
                      ? "border-foreground/10 bg-black/30 opacity-55"
                      : "border-brass/25 bg-brass/5"
                  } ${justOut ? "border-red-500/40" : ""}`}
                >
                  <PlayerIcon name={p.name} eliminated={out} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm ${out ? "text-foreground/55 line-through" : "text-foreground/90"}`}
                    >
                      {p.name}
                    </span>
                    <span className="block text-[10px] font-mono uppercase tracking-[0.15em] text-foreground/40">
                      {p.lateJoin ? "spectating" : out ? `out · Q${(p.eliminatedAtQuestion ?? idx) + 1}` : `score ${p.score}`}
                    </span>
                  </span>
                  {out ? (
                    <span className="text-red-400/80">✕</span>
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.5)]" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-brass/15 px-5 py-3 text-[10px] font-mono uppercase tracking-[0.2em] text-foreground/40">
        {state.viewers.length} watching
        {playingAlong > 0 && <span className="text-brass/70"> · {playingAlong} playing along</span>}
      </div>
    </aside>
  );
}

/** Circular avatar chip: first initial, brass when alive, grey when out. */
function PlayerIcon({ name, eliminated }: { name: string; eliminated: boolean }) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
        eliminated
          ? "bg-neutral-800 text-foreground/40"
          : "bg-gradient-to-b from-[#f9e89a] to-[#b28622] text-[#1b140a]"
      }`}
    >
      {initial}
    </span>
  );
}

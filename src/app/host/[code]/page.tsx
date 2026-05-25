"use client";

import { useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { usePartyRoom } from "@/lib/usePartyRoom";
import { QUESTIONS } from "@/components/QuizGame";

/**
 * Host control panel for a single quiz room. The host claims the room
 * via a shared NEXT_PUBLIC_HOST_KEY passed in the URL (or the default
 * "DEV" in development), then drives phase transitions:
 *
 *   lobby → [Start] → question → [Reveal] → reveal → [Next] → question …
 *
 * Multiple rooms in parallel are first-class: each room lives at
 * /host/<CODE> in its own browser tab. A host can open several tabs
 * and run several rooms concurrently — the server keeps them isolated
 * because the room id (= the join code) is part of the WebSocket URL.
 *
 * The host's screen shows the same question content participants see
 * but with extra controls + per-participant scores.
 */
export default function HostRoomPage() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const roomCode = (params?.code ?? "").toUpperCase();
  const hostKey = search?.get("hostKey") ?? "";

  const { state, send, error, connected } = usePartyRoom(roomCode);

  // Claim the host slot as soon as the socket connects. The server
  // rejects the claim with reason "bad-host-key" if NEXT_PUBLIC_HOST_KEY
  // doesn't match.
  useEffect(() => {
    if (!connected) return;
    if (!state) return;
    if (state.hostId) return;
    send({ type: "host-claim", hostKey });
  }, [connected, state, hostKey, send]);

  const currentQ = useMemo(() => {
    if (!state) return null;
    return QUESTIONS[state.currentQuestionIdx] ?? null;
  }, [state]);

  if (!connected || !state) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-foreground/70">
        Connecting to room <span className="ml-2 font-mono">{roomCode}</span>…
      </main>
    );
  }

  const shareUrl = (path: "play" | "watch") =>
    typeof window !== "undefined" ? `${window.location.origin}/${path}/${roomCode}` : "";

  const phaseLabel: Record<typeof state.phase, string> = {
    lobby: "Lobby",
    question: "Question live",
    reveal: "Answer revealed",
    ended: "Finished",
  };

  const primaryAction = (() => {
    if (state.phase === "lobby") return { label: "Start quiz", onClick: () => send({ type: "start" }) };
    if (state.phase === "question")
      return {
        label: "Reveal answer",
        onClick: () => {
          if (!currentQ) return;
          send({
            type: "reveal",
            correctIndex: currentQ.correctIndex,
            correctText: currentQ.correctAnswerText,
            acceptAny: currentQ.acceptAny ?? false,
          });
        },
      };
    if (state.phase === "reveal") {
      const isLast = state.currentQuestionIdx >= state.totalQuestions - 1;
      return { label: isLast ? "End quiz" : "Next question", onClick: () => send({ type: "next-question" }) };
    }
    return { label: "Reset room", onClick: () => send({ type: "reset" }) };
  })();

  return (
    <main className="min-h-screen bg-black text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-brass/20 pb-6">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brass/70">Host control</p>
            <h1 className="mt-1 text-3xl font-semibold">Room <span className="font-mono tracking-widest text-brass">{roomCode}</span></h1>
          </div>
          <div className="flex flex-wrap gap-3 text-xs font-mono">
            <button
              onClick={() => navigator.clipboard?.writeText(shareUrl("play"))}
              className="rounded-md border border-brass/30 bg-black/40 px-3 py-2 hover:border-brass/60"
              title={shareUrl("play")}
            >
              Copy /play link
            </button>
            <button
              onClick={() => navigator.clipboard?.writeText(shareUrl("watch"))}
              className="rounded-md border border-brass/30 bg-black/40 px-3 py-2 hover:border-brass/60"
              title={shareUrl("watch")}
            >
              Copy /watch link
            </button>
          </div>
        </header>

        {error === "bad-host-key" && (
          <div className="rounded-md border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            Host key rejected. Set <code className="font-mono">NEXT_PUBLIC_HOST_KEY</code> in .env.local and reload, or
            pass it in the URL: <code className="font-mono">/host/{roomCode}?hostKey=&lt;YOUR_KEY&gt;</code>.
          </div>
        )}
        {error === "host-already-claimed" && (
          <div className="rounded-md border border-yellow-500/40 bg-yellow-950/40 px-4 py-3 text-sm text-yellow-200">
            Another host already has this room. Close their tab or use a different room code.
          </div>
        )}

        {/* Phase + controls */}
        <section className="rounded-xl border border-brass/20 bg-neutral-950/80 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-foreground/55">{phaseLabel[state.phase]}</p>
              <p className="mt-1 text-xl">
                Question {state.currentQuestionIdx + 1} / {state.totalQuestions}
              </p>
            </div>
            <button
              onClick={primaryAction.onClick}
              className="rounded-lg bg-brass px-6 py-3 text-sm font-medium uppercase tracking-[0.2em] text-black hover:bg-brass/85"
            >
              {primaryAction.label}
            </button>
          </div>

          {currentQ && state.phase !== "lobby" && (
            <div className="mt-6 space-y-3 border-t border-brass/15 pt-4">
              <p className="text-lg font-medium">{currentQ.question}</p>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {currentQ.options.map((opt, i) => {
                  const isCorrect = i === currentQ.correctIndex;
                  const showCorrect = state.phase === "reveal" && isCorrect;
                  return (
                    <li
                      key={i}
                      className={`rounded-md border px-3 py-2 text-sm ${
                        showCorrect ? "border-emerald-500/60 bg-emerald-900/30" : "border-brass/20 bg-black/40"
                      }`}
                    >
                      <span className="mr-2 font-mono text-foreground/50">{"ABCD"[i]}.</span>
                      {opt}
                      {showCorrect && <span className="ml-2 text-emerald-300">✓ correct</span>}
                    </li>
                  );
                })}
              </ul>
              {state.phase === "reveal" && currentQ.acceptAny && (
                <p className="text-xs text-foreground/55">Any selected answer is treated as correct for this question.</p>
              )}
            </div>
          )}

          {state.phase !== "ended" && (
            <button
              onClick={() => {
                if (confirm("Reset the room? All scores will be cleared and everyone returns to the lobby.")) {
                  send({ type: "reset" });
                }
              }}
              className="mt-6 rounded-md border border-foreground/15 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.25em] text-foreground/55 hover:border-red-500/40 hover:text-red-200"
            >
              Reset room
            </button>
          )}
        </section>

        {/* Participants */}
        <section className="rounded-xl border border-brass/20 bg-neutral-950/80 p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Participants</h2>
            <p className="text-xs font-mono text-foreground/55">{state.participants.length} joined · {state.viewers.length} viewer{state.viewers.length === 1 ? "" : "s"}</p>
          </div>
          {state.participants.length === 0 ? (
            <p className="mt-3 text-sm text-foreground/55">
              No one yet. Share the /play link to invite players.
            </p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-mono uppercase tracking-[0.25em] text-foreground/45">
                  <th className="py-1">Name</th>
                  <th className="py-1">Score</th>
                  <th className="py-1">Status</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {state.participants.map((p) => (
                  <tr key={p.id} className="border-t border-brass/10">
                    <td className="py-2 font-medium">{p.name}</td>
                    <td className="py-2 font-mono">{p.score}</td>
                    <td className="py-2 text-foreground/65">
                      {p.eliminated
                        ? "Eliminated"
                        : state.phase === "question"
                          ? p.hasAnsweredThisRound
                            ? "✓ Answered"
                            : "…thinking"
                          : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${p.name}?`)) send({ type: "kick", participantId: p.id });
                        }}
                        className="text-[10px] font-mono uppercase tracking-[0.2em] text-foreground/40 hover:text-red-300"
                      >
                        Kick
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { usePartyRoom } from "@/lib/usePartyRoom";
import { QUESTIONS } from "@/components/QuizGame";

/**
 * Viewer (spectator) view. Connects to the room as a viewer, sees the
 * current question + live leaderboard, but never submits answers. The
 * server treats viewers as cheap connections with no per-question
 * scoring state.
 */
export default function WatchRoomPage() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const roomCode = (params?.code ?? "").toUpperCase();
  const name = search?.get("name") ?? undefined;

  const { state, send, connected } = usePartyRoom(roomCode);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!connected || joined) return;
    send({ type: "join-viewer", name });
    setJoined(true);
  }, [connected, joined, name, send]);

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

  const sortedParticipants = [...state.participants].sort((a, b) => b.score - a.score);

  return (
    <main className="min-h-screen bg-black text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <section className="space-y-6">
          <header className="border-b border-brass/15 pb-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brass/70">Spectating</p>
            <h1 className="mt-1 text-2xl font-semibold">
              Room <span className="font-mono text-brass">{roomCode}</span>
            </h1>
          </header>

          {state.phase === "lobby" && (
            <div className="rounded-xl border border-brass/20 bg-neutral-950/80 p-6 text-center">
              <p className="text-sm text-foreground/60">Waiting for the host to start…</p>
              <p className="mt-2 text-xs font-mono text-foreground/40">
                {state.participants.length} player{state.participants.length === 1 ? "" : "s"} in the lobby
              </p>
            </div>
          )}

          {state.phase === "ended" && (
            <div className="rounded-xl border border-brass/20 bg-neutral-950/80 p-6 text-center">
              <h2 className="text-xl font-semibold">Quiz over</h2>
              <p className="mt-2 text-sm text-foreground/60">Final standings on the right.</p>
            </div>
          )}

          {currentQ && (state.phase === "question" || state.phase === "reveal") && (
            <div className="rounded-xl border border-brass/20 bg-neutral-950/80 p-6">
              <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-foreground/55">
                Q{state.currentQuestionIdx + 1} / {state.totalQuestions} · {state.phase === "reveal" ? "Answer revealed" : "Live"}
              </p>
              <h2 className="mt-2 text-xl font-medium">{currentQ.question}</h2>
              {currentQ.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentQ.image} alt="" className="mt-4 mx-auto max-h-72 rounded-md border border-brass/20" />
              )}
              <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {currentQ.options.map((opt, i) => {
                  const isCorrect = state.phase === "reveal" && i === currentQ.correctIndex;
                  return (
                    <li
                      key={i}
                      className={`rounded-md border px-3 py-2 text-sm ${
                        isCorrect ? "border-emerald-500/60 bg-emerald-900/30" : "border-brass/20 bg-black/40"
                      }`}
                    >
                      <span className="mr-2 font-mono text-foreground/50">{"ABCD"[i]}.</span>
                      {opt}
                      {isCorrect && <span className="ml-2 text-emerald-300">✓</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        {/* Leaderboard sidebar */}
        <aside className="rounded-xl border border-brass/20 bg-neutral-950/80 p-5 lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-semibold">Leaderboard</h3>
            <span className="text-xs font-mono text-foreground/55">
              {state.viewers.length} watching
            </span>
          </div>
          {sortedParticipants.length === 0 ? (
            <p className="mt-3 text-sm text-foreground/55">No players yet.</p>
          ) : (
            <ol className="mt-3 space-y-1.5 text-sm">
              {sortedParticipants.map((p, i) => (
                <li key={p.id} className="flex justify-between border-b border-brass/10 py-1 last:border-b-0">
                  <span className={p.eliminated ? "text-foreground/40 line-through" : ""}>
                    <span className="mr-2 font-mono text-foreground/40">{i + 1}.</span>
                    {p.name}
                  </span>
                  <span className="font-mono text-brass">{p.score}</span>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { usePartyRoom } from "@/lib/usePartyRoom";

/**
 * Viewer (spectator) view. Read-only live leaderboard for a single
 * room. Shows each participant's current question + score + finished
 * state so an audience screen can watch the race progress.
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

  if (!connected || !state) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-foreground/70">
        Connecting to room <span className="ml-2 font-mono">{roomCode}</span>…
      </main>
    );
  }

  const sortedParticipants = [...state.participants].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aF = a.finishedAt ?? Number.MAX_SAFE_INTEGER;
    const bF = b.finishedAt ?? Number.MAX_SAFE_INTEGER;
    return aF - bF;
  });

  const phaseLabel: Record<typeof state.phase, string> = {
    lobby: "Lobby — waiting for host",
    running: "Quiz live",
    ended: "Quiz finished",
  };

  return (
    <main className="min-h-screen bg-black text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="border-b border-brass/15 pb-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brass/70">Spectating</p>
          <h1 className="mt-1 text-2xl font-semibold">
            Room <span className="font-mono text-brass">{roomCode}</span>
          </h1>
          <p className="mt-2 text-sm text-foreground/55">{phaseLabel[state.phase]}</p>
        </header>

        <section className="mt-6 rounded-xl border border-brass/20 bg-neutral-950/80 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Leaderboard</h2>
            <span className="text-xs font-mono text-foreground/55">
              {state.participants.length} player{state.participants.length === 1 ? "" : "s"} · {state.viewers.length} watching
            </span>
          </div>
          {sortedParticipants.length === 0 ? (
            <p className="mt-3 text-sm text-foreground/55">No players yet.</p>
          ) : (
            <ol className="mt-4 space-y-1.5 text-sm">
              {sortedParticipants.map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between border-b border-brass/10 py-1.5 last:border-b-0"
                >
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono text-foreground/40 w-6 text-right">{i + 1}.</span>
                    <span>{p.name}</span>
                    {p.finishedAt && (
                      <span className="ml-1 rounded-full bg-emerald-900/40 px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.2em] text-emerald-300">
                        done
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-4 font-mono">
                    {state.phase === "running" && !p.finishedAt && (
                      <span className="text-[10px] text-foreground/45">
                        Q{Math.min(p.currentQuestionIdx + 1, state.totalQuestions)}/{state.totalQuestions}
                      </span>
                    )}
                    <span className="text-brass">{p.score}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}

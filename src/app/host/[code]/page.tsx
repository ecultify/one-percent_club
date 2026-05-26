"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { usePartyRoom } from "@/lib/usePartyRoom";

/**
 * Focused single-room host view. Reachable from the dashboard via the
 * "Focus" button on each room card. Same start / end / reset controls
 * as the card, just with more screen real estate for the participants
 * table — useful when one room has 50+ players and you want to keep
 * an eye on it without the rest of the dashboard.
 */
export default function HostRoomPage() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const roomCode = (params?.code ?? "").toUpperCase();
  const hostKey = search?.get("hostKey") ?? process.env.NEXT_PUBLIC_HOST_KEY ?? "";

  const { state, send, error, connected } = usePartyRoom(roomCode);

  useEffect(() => {
    if (!connected) return;
    if (!state) return;
    if (state.hostId) return;
    send({ type: "host-claim", hostKey });
  }, [connected, state, hostKey, send]);

  if (!connected || !state) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-foreground/70">
        Connecting to room <span className="ml-2 font-mono">{roomCode}</span>…
      </main>
    );
  }

  const shareUrl = (path: "play" | "watch") =>
    typeof window !== "undefined" ? `${window.location.origin}/${path}/${roomCode}` : "";

  const sortedParticipants = [...state.participants].sort((a, b) => b.score - a.score);
  const activeCount = state.participants.filter((p) => p.finishedAt == null).length;
  const phaseLabel: Record<typeof state.phase, string> = {
    lobby: "Lobby",
    running: "Live",
    ended: "Ended",
  };

  return (
    <main className="min-h-screen bg-black text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-brass/20 pb-6">
          <div>
            <Link href="/host" className="text-[10px] font-mono uppercase tracking-[0.3em] text-foreground/40 hover:text-foreground/70">
              ← back to dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">
              Room <span className="font-mono tracking-widest text-brass">{roomCode}</span>
            </h1>
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
            Host key rejected. Set <code className="font-mono">NEXT_PUBLIC_HOST_KEY</code> on Vercel and reload.
          </div>
        )}
        {error === "host-already-claimed" && (
          <div className="rounded-md border border-yellow-500/40 bg-yellow-950/40 px-4 py-3 text-sm text-yellow-200">
            Another host is already controlling this room from a different tab.
          </div>
        )}

        <section className="rounded-xl border border-brass/20 bg-neutral-950/80 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-foreground/55">
                {phaseLabel[state.phase]}
              </p>
              <p className="mt-1 text-xl">
                {state.participants.length} player{state.participants.length === 1 ? "" : "s"} ·{" "}
                {activeCount} still playing · {state.viewers.length} viewer
                {state.viewers.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {state.phase === "lobby" && (
                <button
                  onClick={() => send({ type: "start" })}
                  disabled={state.participants.length === 0}
                  className="rounded-lg bg-brass px-6 py-3 text-sm font-medium uppercase tracking-[0.2em] text-black hover:bg-brass/85 disabled:cursor-not-allowed disabled:bg-brass/25 disabled:text-foreground/40"
                >
                  Start quiz
                </button>
              )}
              {state.phase === "running" && (
                <button
                  onClick={() => {
                    if (confirm("End the quiz? All players freeze on their current question.")) {
                      send({ type: "end" });
                    }
                  }}
                  className="rounded-lg border border-red-500/40 bg-red-950/30 px-6 py-3 text-sm font-medium uppercase tracking-[0.2em] text-red-200 hover:bg-red-950/60"
                >
                  End quiz
                </button>
              )}
              {state.phase === "ended" && (
                <button
                  onClick={() => send({ type: "reset" })}
                  className="rounded-lg border border-brass/30 bg-black/40 px-6 py-3 text-sm font-medium uppercase tracking-[0.2em] text-foreground/80 hover:border-brass/60"
                >
                  Reset to lobby
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-brass/20 bg-neutral-950/80 p-6">
          <h2 className="text-lg font-semibold">Participants</h2>
          {sortedParticipants.length === 0 ? (
            <p className="mt-3 text-sm text-foreground/55">No one yet. Share the /play link.</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-mono uppercase tracking-[0.25em] text-foreground/45">
                  <th className="py-1">Name</th>
                  <th className="py-1">Question</th>
                  <th className="py-1">Score</th>
                  <th className="py-1">Status</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {sortedParticipants.map((p) => (
                  <tr key={p.id} className="border-t border-brass/10">
                    <td className="py-2 font-medium">{p.name}</td>
                    <td className="py-2 font-mono">
                      {p.finishedAt ? "✓ done" : `${Math.min(p.currentQuestionIdx + 1, state.totalQuestions)} / ${state.totalQuestions}`}
                    </td>
                    <td className="py-2 font-mono text-brass">{p.score}</td>
                    <td className="py-2 text-foreground/65">
                      {p.finishedAt ? "Finished" : state.phase === "running" ? "Playing" : "—"}
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

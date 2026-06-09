"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { usePartyRoom } from "@/lib/usePartyRoom";
import { rankParticipants, scoredParticipants, unscoredParticipants, totalResponseMs } from "@/lib/quizProtocol";
import AnalyticsModal from "@/components/live/AnalyticsModal";
import { useConfirm } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";

/**
 * Focused single-room host view. Reachable from the dashboard via the
 * "Focus" button on each room card. Start / End / Reset / Kick controls
 * plus a participants table — useful when one room has 50+ players.
 *
 * The quiz is server-synchronized: once started, the server drives the
 * shared question and clock; the host just starts and ends. Players who
 * answer wrong / time out are eliminated and shown as "out".
 */
export default function HostRoomPage() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const roomCode = (params?.code ?? "").toUpperCase();
  const hostKey = search?.get("hostKey") ?? process.env.NEXT_PUBLIC_HOST_KEY ?? "";

  const { state, send, error, connected } = usePartyRoom(roomCode);
  const confirm = useConfirm();
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    if (!connected) return;
    if (!state) return;
    if (state.hostId) return;
    send({ type: "host-claim", hostKey });
  }, [connected, state, hostKey, send]);

  if (!connected || !state) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white/70">
        Connecting to room <span className="ml-2 font-mono">{roomCode}</span>…
      </main>
    );
  }

  const shareUrl = (path: "play" | "watch") =>
    typeof window !== "undefined" ? `${window.location.origin}/${path}/${roomCode}` : "";

  const scored = scoredParticipants(state.participants);
  const ranked = rankParticipants(scored);
  const survivors = scored.filter((p) => !p.eliminated).length;
  const playingAlong = unscoredParticipants(state.participants).length;
  const phaseLabel: Record<typeof state.phase, string> = {
    lobby: "Lobby",
    running: "Live",
    ended: "Ended",
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <Link href="/host" className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/40 hover:text-white/70">
              ← back to dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              Room <span className="font-mono tracking-widest text-white">{roomCode}</span>
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(shareUrl("play"))} title={shareUrl("play")}>
              Copy /play link
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(shareUrl("watch"))} title={shareUrl("watch")}>
              Copy /watch link
            </Button>
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

        <section className="rounded-xl border border-white/10 bg-neutral-950 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/55">
                {phaseLabel[state.phase]}
                {state.phase === "running" && ` · Q${state.currentQuestionIdx + 1}/${state.totalQuestions}`}
              </p>
              <p className="mt-1 text-xl text-white">
                {scored.length} player{scored.length === 1 ? "" : "s"} ·{" "}
                {state.phase === "running" ? `${survivors} still in` : `${scored.length} ready`} ·{" "}
                {state.viewers.length} viewer{state.viewers.length === 1 ? "" : "s"}
                {playingAlong > 0 && <span className="text-white/70"> · {playingAlong} playing along</span>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={() => setShowStats(true)}>
                Show stats
              </Button>
              {state.phase === "lobby" && (
                <Button variant="gold" disabled={state.participants.length === 0} onClick={() => send({ type: "start" })}>
                  Start quiz
                </Button>
              )}
              {state.phase === "running" && (
                <Button
                  variant="destructive"
                  onClick={async () => {
                    if (
                      await confirm({
                        title: "End the quiz now?",
                        message: "The current standings are frozen.",
                        confirmLabel: "End quiz",
                        danger: true,
                      })
                    )
                      send({ type: "end" });
                  }}
                >
                  End quiz
                </Button>
              )}
              {state.phase === "ended" && (
                <Button variant="gold" onClick={() => send({ type: "reset" })}>
                  Reset to lobby
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-neutral-950 p-6">
          <h2 className="text-lg font-semibold text-white">Participants</h2>
          {ranked.length === 0 ? (
            <p className="mt-3 text-sm text-white/55">No one yet. Share the /play link.</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-mono uppercase tracking-[0.25em] text-white/45">
                  <th className="py-1">Name</th>
                  <th className="py-1">Status</th>
                  <th className="py-1">Score</th>
                  <th className="py-1">Time</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((p) => (
                  <tr key={p.id} className="border-t border-white/10">
                    <td className="py-2 font-medium text-white">{p.name}</td>
                    <td className="py-2">
                      {p.lateJoin ? (
                        <span className="text-white/45">Spectator</span>
                      ) : p.eliminated ? (
                        <span className="text-red-300/90">Out · Q{(p.eliminatedAtQuestion ?? 0) + 1}</span>
                      ) : state.phase === "running" ? (
                        <span className="text-emerald-300">In</span>
                      ) : state.phase === "ended" ? (
                        <span className="text-emerald-300">Survived</span>
                      ) : (
                        <span className="text-white/55">Ready</span>
                      )}
                    </td>
                    <td className="py-2 font-mono text-white">{p.score}</td>
                    <td className="py-2 font-mono text-white/55">{(totalResponseMs(p) / 1000).toFixed(1)}s</td>
                    <td className="py-2 text-right">
                      <button
                        onClick={async () => {
                          if (await confirm({ title: `Remove ${p.name}?`, confirmLabel: "Remove", danger: true }))
                            send({ type: "kick", participantId: p.id });
                        }}
                        className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 hover:text-red-300"
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

      {showStats && <AnalyticsModal state={state} onClose={() => setShowStats(false)} />}
    </main>
  );
}

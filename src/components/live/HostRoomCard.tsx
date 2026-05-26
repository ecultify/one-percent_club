"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePartyRoom } from "@/lib/usePartyRoom";

interface HostRoomCardProps {
  code: string;
  hostKey: string;
  onRemove: () => void;
}

/**
 * One PartyKit room as a card on the host dashboard. Opens its own
 * WebSocket on mount, claims host with the shared hostKey, and exposes
 * Start / End / Reset / Kick controls. Multiple of these can be alive
 * simultaneously — each maintains its own socket so the host can run
 * 10+ concurrent rooms from a single browser tab.
 */
export default function HostRoomCard({ code, hostKey, onRemove }: HostRoomCardProps) {
  const { state, send, error, connected } = usePartyRoom(code);
  const [claimed, setClaimed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!connected || claimed) return;
    if (!state) return;
    if (state.hostId) {
      setClaimed(true);
      return;
    }
    send({ type: "host-claim", hostKey });
    setClaimed(true);
  }, [connected, claimed, state, hostKey, send]);

  const phaseLabel = state?.phase ?? "—";
  const phaseColor =
    state?.phase === "running"
      ? "text-emerald-300"
      : state?.phase === "ended"
        ? "text-foreground/50"
        : "text-brass";

  const playLink = typeof window !== "undefined" ? `${window.location.origin}/play/${code}` : `/play/${code}`;
  const watchLink = typeof window !== "undefined" ? `${window.location.origin}/watch/${code}` : `/watch/${code}`;

  const participantsActive = state?.participants.filter((p) => p.finishedAt == null).length ?? 0;
  const participantsTotal = state?.participants.length ?? 0;

  const sortedParticipants = state ? [...state.participants].sort((a, b) => b.score - a.score) : [];

  return (
    <div className="rounded-xl border border-brass/25 bg-neutral-950/80 p-5 shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[10px] font-mono uppercase tracking-[0.4em] ${phaseColor}`}>
            {phaseLabel}
          </p>
          <h2 className="mt-1 font-mono text-2xl tracking-widest text-brass">{code}</h2>
        </div>
        <div className="flex flex-col items-end gap-1 text-[10px] font-mono uppercase tracking-[0.2em] text-foreground/55">
          <span>{participantsTotal} joined</span>
          <span>{participantsActive} active</span>
          <span>{state?.viewers.length ?? 0} viewers</span>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded border border-red-500/30 bg-red-950/30 px-2 py-1 text-[10px] text-red-200">
          {error}
        </p>
      )}

      {/* Quick links */}
      <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-mono">
        <button
          onClick={() => navigator.clipboard?.writeText(playLink)}
          className="rounded-md border border-brass/25 bg-black/40 px-2 py-1 text-foreground/70 hover:border-brass/60"
          title={playLink}
        >
          Copy /play link
        </button>
        <button
          onClick={() => navigator.clipboard?.writeText(watchLink)}
          className="rounded-md border border-brass/25 bg-black/40 px-2 py-1 text-foreground/70 hover:border-brass/60"
          title={watchLink}
        >
          Copy /watch link
        </button>
      </div>

      {/* Primary action */}
      <div className="mt-4 flex flex-wrap gap-2">
        {state?.phase === "lobby" && (
          <button
            onClick={() => send({ type: "start" })}
            disabled={participantsTotal === 0}
            className="flex-1 rounded-lg bg-brass px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-black hover:bg-brass/85 disabled:cursor-not-allowed disabled:bg-brass/25 disabled:text-foreground/40"
          >
            Start quiz
          </button>
        )}
        {state?.phase === "running" && (
          <button
            onClick={() => {
              if (confirm(`End room ${code}? All players freeze on their current question.`)) {
                send({ type: "end" });
              }
            }}
            className="flex-1 rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-red-200 hover:bg-red-950/60"
          >
            End quiz
          </button>
        )}
        {state?.phase === "ended" && (
          <button
            onClick={() => send({ type: "reset" })}
            className="flex-1 rounded-lg border border-brass/30 bg-black/40 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-foreground/80 hover:border-brass/60"
          >
            Reset to lobby
          </button>
        )}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="rounded-lg border border-brass/20 bg-black/40 px-3 py-2 text-xs font-mono uppercase tracking-[0.2em] text-foreground/60 hover:border-brass/40"
        >
          {expanded ? "Hide" : "Show"} players
        </button>
        <Link
          href={`/host/${code}?hostKey=${encodeURIComponent(hostKey)}`}
          className="rounded-lg border border-brass/20 bg-black/40 px-3 py-2 text-xs font-mono uppercase tracking-[0.2em] text-foreground/60 hover:border-brass/40"
        >
          Focus
        </Link>
        <button
          onClick={() => {
            if (confirm(`Remove ${code} from your dashboard? The server room stays alive until everyone disconnects.`)) {
              onRemove();
            }
          }}
          className="rounded-lg border border-foreground/15 bg-black/40 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.2em] text-foreground/40 hover:border-red-500/40 hover:text-red-200"
        >
          Remove
        </button>
      </div>

      {/* Participant list */}
      {expanded && state && (
        <div className="mt-5 border-t border-brass/10 pt-4">
          {sortedParticipants.length === 0 ? (
            <p className="text-sm text-foreground/50">No players yet — share the /play link.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left font-mono uppercase tracking-[0.25em] text-foreground/40">
                  <th className="py-1">Name</th>
                  <th className="py-1">Q</th>
                  <th className="py-1">Score</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {sortedParticipants.map((p) => (
                  <tr key={p.id} className="border-t border-brass/5">
                    <td className="py-1.5 font-medium text-foreground/85">{p.name}</td>
                    <td className="py-1.5 font-mono text-foreground/70">
                      {p.finishedAt
                        ? "✓"
                        : `${Math.min(p.currentQuestionIdx + 1, state.totalQuestions)}/${state.totalQuestions}`}
                    </td>
                    <td className="py-1.5 font-mono text-brass">{p.score}</td>
                    <td className="py-1.5 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${p.name}?`)) send({ type: "kick", participantId: p.id });
                        }}
                        className="text-[10px] font-mono uppercase tracking-[0.2em] text-foreground/35 hover:text-red-300"
                      >
                        Kick
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

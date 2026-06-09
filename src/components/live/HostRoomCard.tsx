"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePartyRoom } from "@/lib/usePartyRoom";
import { rankParticipants, scoredParticipants, unscoredParticipants } from "@/lib/quizProtocol";
import type { RoomPhase } from "@/lib/quizProtocol";
import { useConfirm } from "@/components/ConfirmDialog";

interface HostRoomCardProps {
  code: string;
  hostKey: string;
  onRemove: () => void;
  /** Lifts this room's phase to the dashboard so it can filter cards by
   *  open / running / finished. */
  onPhaseChange?: (code: string, phase: RoomPhase) => void;
}

/**
 * One PartyKit room as a card on the host dashboard. Opens its own
 * WebSocket on mount, claims host with the shared hostKey, and exposes
 * Start / End / Reset / Kick controls. Multiple of these can be alive
 * simultaneously — each maintains its own socket so the host can run
 * 10+ concurrent rooms from a single browser tab.
 */
export default function HostRoomCard({ code, hostKey, onRemove, onPhaseChange }: HostRoomCardProps) {
  const { state, send, error, connected } = usePartyRoom(code);
  const confirm = useConfirm();
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

  // Report phase up to the dashboard for filtering.
  const phase = state?.phase;
  useEffect(() => {
    if (phase) onPhaseChange?.(code, phase);
  }, [phase, code, onPhaseChange]);

  const phaseLabel = state?.phase ?? "—";
  const phaseColor =
    state?.phase === "running"
      ? "text-emerald-300"
      : state?.phase === "ended"
        ? "text-foreground/50"
        : "text-brass";

  const playLink = typeof window !== "undefined" ? `${window.location.origin}/play/${code}` : `/play/${code}`;
  const watchLink = typeof window !== "undefined" ? `${window.location.origin}/watch/${code}` : `/watch/${code}`;

  const scored = state ? scoredParticipants(state.participants) : [];
  const playingAlong = state ? unscoredParticipants(state.participants).length : 0;
  const participantsActive = scored.filter((p) => !p.eliminated).length;
  const participantsTotal = scored.length;
  const activeLabel = state?.phase === "running" ? "still in" : "active";

  // Standings table shows the scored game; play-along viewers are summarised
  // in the header count and the full analytics modal (Focus room → stats).
  const sortedParticipants = rankParticipants(scored);

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
          <span>{participantsActive} {activeLabel}</span>
          <span>{state?.viewers.length ?? 0} viewers</span>
          {playingAlong > 0 && <span className="text-brass/70">{playingAlong} playing along</span>}
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded border border-red-500/30 bg-red-950/30 px-2 py-1 text-[10px] text-red-200">
          {error}
        </p>
      )}

      {/* Quick links */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={() => navigator.clipboard?.writeText(playLink)} className="lq-btn lq-btn--sm lq-btn--subtle" title={playLink}>
          Copy /play
        </button>
        <button onClick={() => navigator.clipboard?.writeText(watchLink)} className="lq-btn lq-btn--sm lq-btn--subtle" title={watchLink}>
          Copy /watch
        </button>
      </div>

      {/* Primary action — full width on its own row so the label never wraps. */}
      <div className="mt-3">
        {state?.phase === "lobby" && (
          <button
            onClick={() => send({ type: "start" })}
            disabled={participantsTotal === 0}
            className="lq-btn game-show-btn relative z-0 w-full"
          >
            Start quiz
          </button>
        )}
        {state?.phase === "running" && (
          <button
            onClick={async () => {
              if (
                await confirm({
                  title: `End room ${code}?`,
                  message: "All players freeze on their current question.",
                  confirmLabel: "End quiz",
                  danger: true,
                })
              ) {
                send({ type: "end" });
              }
            }}
            className="lq-btn lq-btn--danger w-full"
          >
            End quiz
          </button>
        )}
        {state?.phase === "ended" && (
          <button onClick={() => send({ type: "reset" })} className="lq-btn game-show-btn relative z-0 w-full">
            Reset to lobby
          </button>
        )}
      </div>

      {/* Secondary actions */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button onClick={() => setExpanded((v) => !v)} className="lq-btn lq-btn--ghost w-full">
          {expanded ? "Hide players" : "Show players"}
        </button>
        <Link href={`/host/${code}?hostKey=${encodeURIComponent(hostKey)}`} className="lq-btn lq-btn--ghost w-full">
          Focus room
        </Link>
      </div>

      <button
        onClick={async () => {
          if (
            await confirm({
              title: `Remove ${code} from your dashboard?`,
              message: "The server room stays alive until everyone disconnects.",
              confirmLabel: "Remove",
              danger: true,
            })
          ) {
            onRemove();
          }
        }}
        className="lq-btn lq-btn--sm lq-btn--danger-quiet mt-2 w-full"
      >
        Remove from dashboard
      </button>

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
                  <th className="py-1">Status</th>
                  <th className="py-1">Score</th>
                  <th className="py-1"></th>
                </tr>
              </thead>
              <tbody>
                {sortedParticipants.map((p) => (
                  <tr key={p.id} className="border-t border-brass/5">
                    <td className="py-1.5 font-medium text-foreground/85">{p.name}</td>
                    <td className="py-1.5 font-mono text-foreground/70">
                      {p.lateJoin ? (
                        <span className="text-foreground/40">spectator</span>
                      ) : p.eliminated ? (
                        <span className="text-red-300/80">out Q{(p.eliminatedAtQuestion ?? 0) + 1}</span>
                      ) : state.phase === "lobby" ? (
                        "ready"
                      ) : (
                        <span className="text-emerald-300/90">in</span>
                      )}
                    </td>
                    <td className="py-1.5 font-mono text-brass">{p.score}</td>
                    <td className="py-1.5 text-right">
                      <button
                        onClick={async () => {
                          if (await confirm({ title: `Remove ${p.name}?`, confirmLabel: "Remove", danger: true }))
                            send({ type: "kick", participantId: p.id });
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

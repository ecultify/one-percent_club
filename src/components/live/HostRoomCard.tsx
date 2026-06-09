"use client";

import { useEffect, useState } from "react";
import { usePartyRoom } from "@/lib/usePartyRoom";
import { scoredParticipants, unscoredParticipants } from "@/lib/quizProtocol";
import type { RoomPhase } from "@/lib/quizProtocol";
import { useConfirm } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";

interface HostRoomCardProps {
  code: string;
  hostKey: string;
  onRemove: () => void;
  /** Lifts this room's phase to the dashboard so it can filter cards. */
  onPhaseChange?: (code: string, phase: RoomPhase) => void;
}

/**
 * One PartyKit room as a card on the host dashboard. Opens its own socket,
 * claims host, and exposes the high-level controls (start / end / reset,
 * share links, open the full lobby view, remove). Per-player management
 * (the full table + kick) lives in the focused "Open lobby" view — that
 * scales to 100+ players instead of cramming a table into the card.
 */
export default function HostRoomCard({ code, hostKey, onRemove, onPhaseChange }: HostRoomCardProps) {
  const { state, send, error, connected } = usePartyRoom(code);
  const confirm = useConfirm();
  const [claimed, setClaimed] = useState(false);

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

  const phase = state?.phase;
  useEffect(() => {
    if (phase) onPhaseChange?.(code, phase);
  }, [phase, code, onPhaseChange]);

  const scored = state ? scoredParticipants(state.participants) : [];
  const playingAlong = state ? unscoredParticipants(state.participants).length : 0;
  const active = scored.filter((p) => !p.eliminated).length;
  const total = scored.length;
  const activeLabel = state?.phase === "running" ? "still in" : "ready";

  const playLink = typeof window !== "undefined" ? `${window.location.origin}/play/${code}` : `/play/${code}`;
  const watchLink = typeof window !== "undefined" ? `${window.location.origin}/watch/${code}` : `/watch/${code}`;
  const focusUrl = `/host/${code}?hostKey=${encodeURIComponent(hostKey)}`;

  const phaseTone =
    state?.phase === "running" ? "text-emerald-400" : state?.phase === "ended" ? "text-white/40" : "text-white/70";

  return (
    <div className="rounded-xl border border-white/10 bg-neutral-950 p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[10px] font-mono uppercase tracking-[0.4em] ${phaseTone}`}>{state?.phase ?? "—"}</p>
          <h2 className="mt-1 font-mono text-2xl tracking-widest text-white">{code}</h2>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-[10px] font-mono uppercase tracking-[0.2em] text-white/55">
          <span>{total} joined</span>
          <span>{active} {activeLabel}</span>
          <span>{state?.viewers.length ?? 0} viewers</span>
          {playingAlong > 0 && <span className="text-white/70">{playingAlong} playing along</span>}
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded border border-red-500/30 bg-red-950/30 px-2 py-1 text-[10px] text-red-200">{error}</p>
      )}

      {/* Share links */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(playLink)} title={playLink}>
          Copy /play
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(watchLink)} title={watchLink}>
          Copy /watch
        </Button>
      </div>

      {/* Primary action */}
      <div className="mt-3">
        {state?.phase === "lobby" && (
          <Button variant="gold" size="full" disabled={total === 0} onClick={() => send({ type: "start" })}>
            Start quiz
          </Button>
        )}
        {state?.phase === "running" && (
          <Button
            variant="destructive"
            size="full"
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
          >
            End quiz
          </Button>
        )}
        {state?.phase === "ended" && (
          <Button variant="gold" size="full" onClick={() => send({ type: "reset" })}>
            Reset to lobby
          </Button>
        )}
      </div>

      {/* Open the full lobby view in a new tab — player management lives there. */}
      <Button asChild variant="outline" size="full" className="mt-2">
        <a href={focusUrl} target="_blank" rel="noopener noreferrer">
          Open lobby ↗
        </a>
      </Button>

      <Button
        variant="ghost"
        size="full"
        className="mt-2 text-white/40 hover:text-red-300"
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
      >
        Remove from dashboard
      </Button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Square, RotateCcw, ArrowRight, Trash2, FastForward, Volume2, VolumeX } from "lucide-react";
import { usePartyRoom } from "@/lib/usePartyRoom";
import { scoredParticipants, unscoredParticipants } from "@/lib/quizProtocol";
import type { RoomPhase } from "@/lib/quizProtocol";
import { SET_LABELS, type QuestionSetId } from "@/lib/questionSetMeta";
import { useConfirm } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/live/CopyButton";

interface HostRoomCardProps {
  code: string;
  hostKey: string;
  /** Which question set this lobby plays (from the registry row). Carried on
   *  host-claim so the PartyKit room adopts it while still in the lobby. */
  questionSet?: QuestionSetId;
  onRemove: () => void | Promise<void>;
  /** Whether to show "Remove from dashboard" (owners only). */
  canRemove?: boolean;
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
export default function HostRoomCard({ code, hostKey, questionSet, onRemove, canRemove = true, onPhaseChange }: HostRoomCardProps) {
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
    send({ type: "host-claim", hostKey, questionSet });
    setClaimed(true);
  }, [connected, claimed, state, hostKey, questionSet, send]);

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
  const focusUrl = `/host/${code}?hostKey=${encodeURIComponent(hostKey)}${questionSet ? `&set=${questionSet}` : ""}`;

  const phaseVariant =
    state?.phase === "running" ? "running" : state?.phase === "ended" ? "ended" : "default";

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Badge variant={phaseVariant}>{state?.phase ?? "—"}</Badge>
            <Badge variant="set">{SET_LABELS[state?.questionSet ?? questionSet ?? "A"]}</Badge>
          </div>
          <h2 className="mt-2 font-mono text-xl font-semibold tracking-wider text-white">{code}</h2>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground">
          <span>{total} joined</span>
          <span>{active} {activeLabel}</span>
          <span>{state?.viewers.length ?? 0} viewers</span>
          {playingAlong > 0 && <span className="text-foreground/70">{playingAlong} playing along</span>}
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <p className="mb-3 rounded border border-red-500/30 bg-red-950/30 px-2 py-1 text-[10px] text-red-200">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <CopyButton variant="outline" size="sm" value={playLink} label="Play link" />
          <CopyButton variant="outline" size="sm" value={watchLink} label="Watch link" />
        </div>

        <div className="mt-3">
          {state?.phase === "lobby" && (
            <Button variant="gold" size="full" disabled={total === 0} onClick={() => send({ type: "start" })}>
              <Play className="size-4" /> Start quiz
            </Button>
          )}
          {state?.phase === "running" && (
            <div className="space-y-2">
              {(state.hostNarration || state.manualControl) && state.roundPhase === "narrating" && (
                <Button variant="gold" size="full" onClick={() => send({ type: "open-clock" })}>
                  <Play className="size-4" /> Start Q{state.currentQuestionIdx + 1}
                </Button>
              )}
              {state.manualControl && state.roundPhase === "asking" && (
                <Button variant="outline" size="full" onClick={() => send({ type: "end-question" })}>
                  <FastForward className="size-4" /> End question
                </Button>
              )}
              <Button
                variant="outline"
                size="full"
                onClick={() => send({ type: "set-room-control", mutedAll: !state.mutedAll })}
              >
                {state.mutedAll ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                {state.mutedAll ? "Unmute everyone" : "Mute everyone"}
              </Button>
              <Button
                variant="destructive"
                size="full"
                onClick={() =>
                  confirm({
                    title: `End room ${code}?`,
                    message: "All players freeze on their current question.",
                    confirmLabel: "End quiz",
                    danger: true,
                    action: () => send({ type: "end" }),
                  })
                }
              >
                <Square className="size-4" /> End quiz
              </Button>
            </div>
          )}
          {state?.phase === "ended" && (
            <Button variant="gold" size="full" onClick={() => send({ type: "reset" })}>
              <RotateCcw className="size-4" /> Reset to lobby
            </Button>
          )}
        </div>

        <Button asChild variant="secondary" size="full" className="mt-2">
          <Link href={focusUrl}>
            Open lobby <ArrowRight className="size-4" />
          </Link>
        </Button>

        {canRemove && (
          <Button
            variant="ghost"
            size="full"
            className="mt-2 text-white/40 hover:text-red-300"
            onClick={() =>
              confirm({
                title: `Remove ${code}?`,
                message:
                  "Deletes this lobby from your dashboard. The live room stays alive until everyone disconnects.",
                confirmLabel: "Remove",
                danger: true,
                action: () => onRemove(),
              })
            }
          >
            <Trash2 className="size-3.5" /> Remove from dashboard
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

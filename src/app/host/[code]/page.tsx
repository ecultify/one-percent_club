"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { usePartyRoom } from "@/lib/usePartyRoom";
import { rankParticipants, scoredParticipants, unscoredParticipants, totalResponseMs } from "@/lib/quizProtocol";
import { ArrowLeft, Play, Square, RotateCcw, UserPlus } from "lucide-react";
import AnalyticsPanel from "@/components/live/AnalyticsPanel";
import { CopyButton } from "@/components/live/CopyButton";
import { useConfirm } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
  const [cohostEmail, setCohostEmail] = useState("");
  const [cohostMsg, setCohostMsg] = useState<string | null>(null);
  const [cohostBusy, setCohostBusy] = useState(false);

  const inviteCohost = async () => {
    const email = cohostEmail.trim();
    if (!email || cohostBusy) return;
    setCohostBusy(true);
    setCohostMsg(null);
    try {
      const res = await fetch("/api/host/cohost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: roomCode, email }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        setCohostMsg(`Added ${email} as a co-host.`);
        setCohostEmail("");
      } else {
        const map: Record<string, string> = {
          "no-such-user": "No host account with that email. Ask them to sign up at /host first.",
          "not-owner": "Only the room owner can add co-hosts.",
          "no-such-room": "This room isn't in the registry yet — start it once, then invite.",
          "already-owner": "That's you — you already own this room.",
          unauthorized: "Please sign in again.",
        };
        setCohostMsg(map[data.error ?? ""] ?? "Couldn't add co-host.");
      }
    } catch {
      setCohostMsg("Network error — try again.");
    } finally {
      setCohostBusy(false);
    }
  };

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
            <Link
              href="/host"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Back to dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Room <span className="font-mono tracking-wider text-white">{roomCode}</span>
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton variant="outline" size="sm" value={shareUrl("play")} label="Play link" />
            <CopyButton variant="outline" size="sm" value={shareUrl("watch")} label="Watch link" />
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

        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant={state.phase === "running" ? "running" : state.phase === "ended" ? "ended" : "default"}>
                  {phaseLabel[state.phase]}
                </Badge>
                {state.phase === "running" && (
                  <span className="font-mono text-[11px] text-white/55">
                    Q{state.currentQuestionIdx + 1}/{state.totalQuestions}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xl text-white">
                {scored.length} player{scored.length === 1 ? "" : "s"} ·{" "}
                {state.phase === "running" ? `${survivors} still in` : `${scored.length} ready`} ·{" "}
                {state.viewers.length} viewer{state.viewers.length === 1 ? "" : "s"}
                {playingAlong > 0 && <span className="text-white/70"> · {playingAlong} playing along</span>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {state.phase === "lobby" && (
                <Button variant="gold" disabled={state.participants.length === 0} onClick={() => send({ type: "start" })}>
                  <Play className="size-4" /> Start quiz
                </Button>
              )}
              {state.phase === "running" && (
                <Button
                  variant="destructive"
                  onClick={() =>
                    confirm({
                      title: "End the quiz now?",
                      message: "The current standings are frozen.",
                      confirmLabel: "End quiz",
                      danger: true,
                      action: () => send({ type: "end" }),
                    })
                  }
                >
                  <Square className="size-4" /> End quiz
                </Button>
              )}
              {state.phase === "ended" && (
                <Button variant="gold" onClick={() => send({ type: "reset" })}>
                  <RotateCcw className="size-4" /> Reset to lobby
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Co-hosts — kept near the top so it's reachable without scrolling. */}
        <Card>
          <CardHeader>
            <CardTitle>Co-hosts</CardTitle>
            <CardDescription>
              Add another host by email — they&apos;ll see this lobby on their own dashboard. They must have a host
              account (sign up at <span className="font-mono text-white/70">/host</span>) first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Input
                value={cohostEmail}
                onChange={(e) => setCohostEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void inviteCohost();
                }}
                type="email"
                placeholder="cohost@email.com"
                className="min-w-0 flex-1"
              />
              <Button variant="outline" disabled={cohostBusy} onClick={inviteCohost}>
                <UserPlus className="size-4" /> {cohostBusy ? "Adding…" : "Add co-host"}
              </Button>
            </div>
            {cohostMsg && <p className="mt-3 text-sm text-white/70">{cohostMsg}</p>}
          </CardContent>
        </Card>

        {/* Live analytics — shown inline (no modal). */}
        <AnalyticsPanel state={state} />

        <Card>
          <CardHeader>
            <CardTitle>Participants</CardTitle>
          </CardHeader>
          <CardContent>
            {ranked.length === 0 ? (
              <p className="text-sm text-white/55">No one yet. Share the /play link.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranked.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-white">{p.name}</TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell className="font-mono text-white">{p.score}</TableCell>
                      <TableCell className="font-mono text-white/55">{(totalResponseMs(p) / 1000).toFixed(1)}s</TableCell>
                      <TableCell className="text-right">
                        <button
                          onClick={() =>
                            confirm({
                              title: `Remove ${p.name}?`,
                              confirmLabel: "Remove",
                              danger: true,
                              action: () => send({ type: "kick", participantId: p.id }),
                            })
                          }
                          className="text-xs text-muted-foreground hover:text-red-300"
                        >
                          Kick
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

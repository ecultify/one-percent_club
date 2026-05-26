"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { usePartyRoom } from "@/lib/usePartyRoom";
import LiveQuizPlayer from "@/components/live/LiveQuizPlayer";

/**
 * Participant view of a live quiz room. Connects to the PartyKit room,
 * joins via "join-participant", then defers to LiveQuizPlayer which
 * drives the full QuestionScreen UI + per-question VO + auto reveal +
 * auto advance once the host hits "Start".
 */
export default function PlayRoomPage() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const roomCode = (params?.code ?? "").toUpperCase();
  const name = search?.get("name") ?? "";

  const { state, send, error, kicked, connected, myId } = usePartyRoom(roomCode);

  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!connected || joined) return;
    send({ type: "join-participant", name: name || "Player" });
    setJoined(true);
  }, [connected, joined, name, send]);

  if (kicked) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-black text-foreground/80 px-6 text-center">
        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-red-300/70">Removed</p>
        <h1 className="mt-2 text-2xl font-semibold">You were removed from this room</h1>
        <p className="mt-2 text-sm text-foreground/55">The host removed you from this quiz.</p>
      </main>
    );
  }

  if (!connected || !state) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-foreground/70">
        Connecting to room <span className="ml-2 font-mono">{roomCode}</span>…
      </main>
    );
  }

  if (state.phase === "lobby") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-black px-6 text-center">
        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brass/70">Waiting for host</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">You&apos;re in. Sit tight.</h1>
        <p className="mt-2 text-sm text-foreground/55">
          Room <span className="font-mono text-brass">{roomCode}</span> ·{" "}
          {state.participants.length} player{state.participants.length === 1 ? "" : "s"} joined
        </p>
        {error === "host-already-claimed" && (
          <p className="mt-4 text-xs text-yellow-200/80">
            Host is connected from another tab.
          </p>
        )}
      </main>
    );
  }

  // Running or ended → LiveQuizPlayer handles both.
  return <LiveQuizPlayer roomCode={roomCode} state={state} send={send} name={name} myId={myId} />;
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { usePartyRoom } from "@/lib/usePartyRoom";
import LiveQuizPlayer from "@/components/live/LiveQuizPlayer";
import LiveAudioGate from "@/components/live/LiveAudioGate";
import GameShowAudio from "@/components/GameShowAudio";
import { useNarration } from "@/components/NarrationProvider";

/** Shared muted home-video backdrop for the pre-game (gate + waiting lobby). */
function LobbyBackdrop() {
  return (
    <>
      <video
        src="/homepagevideo.mp4"
        poster="/homepagevideo.mp4.poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0" style={{ background: "rgba(3,2,8,0.55)" }} aria-hidden />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 42% at 50% 55%, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0.2) 78%, transparent 100%)",
        }}
        aria-hidden
      />
    </>
  );
}

/**
 * Participant view of a live quiz room. Connects to the PartyKit room,
 * joins via "join-participant" with the player's name (collected in the
 * audio gate when arriving via a shared link), then defers to
 * LiveQuizPlayer once the host hits "Start".
 */
export default function PlayRoomPage() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const roomCode = (params?.code ?? "").toUpperCase();
  const queryName = search?.get("name") ?? "";

  const { state, send, error, kicked, connected, myId } = usePartyRoom(roomCode);
  const { audioUnlocked } = useNarration();

  const [name, setName] = useState(queryName);
  const [joined, setJoined] = useState(false);
  const [soundReady, setSoundReady] = useState(false);

  // Join only once we actually have a name (entered in the gate for shared
  // links, or carried from ?name= via the in-app flow). The name then shows
  // up in the host dashboard.
  useEffect(() => {
    if (!connected || joined) return;
    const n = name.trim();
    if (!n) return;
    send({ type: "join-participant", name: n });
    setJoined(true);
  }, [connected, joined, name, send]);

  // Show the gate until audio is primed AND we have a name. Skipped for the
  // in-app flow (audio already unlocked + name carried in the query).
  const needGate = !soundReady && (!audioUnlocked || !name.trim());
  if (needGate) {
    return (
      <LiveAudioGate
        collectName
        requireName
        initialName={queryName}
        onReady={(enteredName) => {
          setName(enteredName || queryName || "Player");
          setSoundReady(true);
        }}
      />
    );
  }

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
      <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black text-foreground/80">
        {/* Theme starts the moment the player clears the gate (name + ready
            tap = the audio gesture), not when the host presses start. */}
        <GameShowAudio playBgm suppressForVideo={false} slowMode={false} />
        <LobbyBackdrop />
        <span className="relative z-[1]">
          Connecting to room <span className="ml-1 font-mono text-brass">{roomCode}</span>…
        </span>
      </main>
    );
  }

  if (state.phase === "lobby") {
    return (
      <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-black px-6 text-center">
        {/* Keep the theme running through the waiting lobby; LiveQuizPlayer
            takes over the same audio singleton once the quiz starts. */}
        <GameShowAudio playBgm suppressForVideo={false} slowMode={false} />
        <LobbyBackdrop />
        <div className="relative z-[1]">
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brass/80">Waiting for host</p>
          <h1
            className="mt-2 text-3xl font-semibold text-[#fff4dc]"
            style={{ textShadow: "0 2px 14px rgba(0,0,0,0.92)" }}
          >
            You&apos;re in{name.trim() ? `, ${name.trim()}` : ""}. Sit tight.
          </h1>
          <p className="mt-2 text-sm text-[#f4ecdc]/85" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.9)" }}>
            Room <span className="font-mono text-brass">{roomCode}</span> ·{" "}
            {state.participants.length} player{state.participants.length === 1 ? "" : "s"} joined
          </p>
          {error === "host-already-claimed" && (
            <p className="mt-4 text-xs text-yellow-200/80">Host is connected from another tab.</p>
          )}
        </div>
      </main>
    );
  }

  // Running or ended → LiveQuizPlayer handles both.
  return <LiveQuizPlayer roomCode={roomCode} state={state} send={send} name={name} myId={myId} />;
}

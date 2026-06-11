"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { usePartyRoom } from "@/lib/usePartyRoom";
import SpectatorView from "@/components/live/SpectatorView";
import FinalStandings from "@/components/live/FinalStandings";
import LiveQuizPlayer from "@/components/live/LiveQuizPlayer";
import LiveAudioGate from "@/components/live/LiveAudioGate";
import GameShowAudio from "@/components/GameShowAudio";
import { useNarration } from "@/components/NarrationProvider";

/**
 * Viewer (spectator) view for a single room.
 *   • Lobby   → waiting screen with who's joined.
 *   • Running → SpectatorView: the live question streamed in real time
 *               plus a toggleable participants sidebar that shows who's
 *               still in and, after each question, how many passed vs.
 *               were eliminated.
 *   • Ended   → final standings.
 */
export default function WatchRoomPage() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const roomCode = (params?.code ?? "").toUpperCase();
  const name = search?.get("name") ?? undefined;

  const { state, send, connected, myId } = usePartyRoom(roomCode);
  const { audioUnlocked } = useNarration();
  const [joined, setJoined] = useState(false);
  const [soundReady, setSoundReady] = useState(false);
  /** Viewer opted to play along (unscored). Once set we join as a
   *  scoring:false participant and defer to LiveQuizPlayer. */
  const [playAlong, setPlayAlong] = useState(false);

  useEffect(() => {
    if (!connected || joined) return;
    send({ type: "join-viewer", name });
    setJoined(true);
  }, [connected, joined, name, send]);

  // After a host reset the server clears all participant/viewer rows. If we
  // vanished from the room, fall back to a plain viewer (same connection id,
  // so nothing duplicates) and clear any play-along promotion.
  useEffect(() => {
    if (!connected || !joined || !state || state.phase !== "lobby" || !myId) return;
    const present =
      state.viewers.some((v) => v.id === myId) || state.participants.some((p) => p.id === myId);
    if (present) return;
    setPlayAlong(false);
    send({ type: "join-viewer", name });
  }, [connected, joined, state, myId, name, send]);

  const startPlayAlong = () => {
    // Promote this viewer to an unscored participant. connection.id is
    // unchanged, so myId stays valid and LiveQuizPlayer finds "me".
    send({ type: "join-participant", name: name ?? "Viewer", scoring: false });
    setPlayAlong(true);
  };

  // Prime audio with one tap so the synced question voice-over plays from the
  // first question (browsers block autoplay until a gesture). Skipped if audio
  // is already unlocked. The socket connects behind this gate via the effect.
  if (!audioUnlocked && !soundReady) {
    return <LiveAudioGate onReady={() => setSoundReady(true)} />;
  }

  if (!connected || !state) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-foreground/70">
        Connecting to room <span className="ml-2 font-mono">{roomCode}</span>…
      </main>
    );
  }

  // Opted into unscored play-along — LiveQuizPlayer self-detects scoring:false.
  if (playAlong && (state.phase === "running" || state.phase === "ended")) {
    return <LiveQuizPlayer roomCode={roomCode} state={state} send={send} name={name ?? "Viewer"} myId={myId} />;
  }

  if (state.phase === "running") {
    return <SpectatorView state={state} name={name} onPlayAlong={startPlayAlong} />;
  }

  if (state.phase === "ended") {
    return <FinalStandings state={state} />;
  }

  // Lobby.
  return (
    <main className="min-h-screen bg-black text-foreground">
      {/* Theme starts right after the audio gate, same as the player flow;
          SpectatorView takes over the audio singleton once the quiz runs. */}
      <GameShowAudio playBgm suppressForVideo={false} slowMode={false} />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <header className="border-b border-brass/15 pb-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brass/70">Spectating</p>
          <h1 className="mt-1 text-2xl font-semibold">
            Room <span className="font-mono text-brass">{roomCode}</span>
          </h1>
          <p className="mt-2 text-sm text-foreground/55">
            Lobby — waiting for the host to start. You can jump in to play along once it begins.
          </p>
        </header>

        <section className="mt-6 rounded-xl border border-brass/20 bg-neutral-950/80 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">In the lobby</h2>
            <span className="text-xs font-mono text-foreground/55">
              {state.participants.length} player{state.participants.length === 1 ? "" : "s"} ·{" "}
              {state.viewers.length} watching
            </span>
          </div>
          {state.participants.length === 0 ? (
            <p className="mt-3 text-sm text-foreground/55">No players yet.</p>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-2">
              {state.participants.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-full border border-brass/25 bg-brass/5 px-3 py-1.5 text-sm"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-b from-[#f9e89a] to-[#b28622] text-xs font-semibold text-[#1b140a]">
                    {(p.name.trim()[0] ?? "?").toUpperCase()}
                  </span>
                  {p.name}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

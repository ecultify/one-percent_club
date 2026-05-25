"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Six-char A-Z 0-9 code (omitting visually-confusable chars). */
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

interface JoinLandingProps {
  /** Role this landing is for — drives the heading + redirect target. */
  role: "host" | "play" | "watch";
}

/**
 * Shared lobby landing rendered at /host, /play and /watch. Host gets a
 * "Create room" CTA that mints a fresh code and redirects to
 * /host/[code]. Participants + viewers enter an existing code (and a
 * name on /play) and get redirected to /play/[code] or /watch/[code].
 *
 * No PartyKit connection happens on the landing itself — the actual
 * socket is opened on the [code] page once we have a code in hand.
 */
export default function JoinLanding({ role }: JoinLandingProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  const handleHostCreate = () => {
    const c = generateRoomCode();
    const hostKey = process.env.NEXT_PUBLIC_HOST_KEY || "DEV";
    router.push(`/host/${c}?hostKey=${encodeURIComponent(hostKey)}`);
  };

  const handleJoin = () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    if (role === "play") {
      const n = name.trim();
      if (!n) return;
      router.push(`/play/${c}?name=${encodeURIComponent(n)}`);
    } else {
      router.push(`/watch/${c}${name.trim() ? `?name=${encodeURIComponent(name.trim())}` : ""}`);
    }
  };

  const titleByRole: Record<JoinLandingProps["role"], string> = {
    host: "Host a 1% Club Quiz",
    play: "Join the Quiz",
    watch: "Watch a Live Quiz",
  };

  const subtitleByRole: Record<JoinLandingProps["role"], string> = {
    host: "Spin up a new room and share the code with your players.",
    play: "Enter the host's room code and your name to join.",
    watch: "Enter a room code to spectate in real time.",
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-black px-6">
      <div className="w-full max-w-md rounded-2xl border border-brass/25 bg-neutral-950/80 p-8 shadow-2xl backdrop-blur">
        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brass/70">
          {role === "host" ? "Host" : role === "play" ? "Participant" : "Viewer"}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{titleByRole[role]}</h1>
        <p className="mt-2 text-sm text-foreground/65">{subtitleByRole[role]}</p>

        {role === "host" ? (
          <button
            onClick={handleHostCreate}
            className="mt-8 w-full rounded-lg bg-brass px-5 py-3 text-sm font-medium uppercase tracking-[0.2em] text-black hover:bg-brass/85 transition-colors"
          >
            Create new room
          </button>
        ) : (
          <div className="mt-8 space-y-4">
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-foreground/55">Room code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABCDEF"
                maxLength={8}
                className="mt-1 w-full rounded-md border border-brass/25 bg-black/60 px-4 py-2 text-lg tracking-[0.4em] font-mono text-foreground placeholder:text-foreground/30 focus:border-brass focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-foreground/55">
                {role === "play" ? "Your name" : "Display name (optional)"}
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={role === "play" ? "Required" : "Anonymous"}
                maxLength={32}
                className="mt-1 w-full rounded-md border border-brass/25 bg-black/60 px-4 py-2 text-base text-foreground placeholder:text-foreground/30 focus:border-brass focus:outline-none"
              />
            </label>
            <button
              onClick={handleJoin}
              disabled={!code.trim() || (role === "play" && !name.trim())}
              className="mt-2 w-full rounded-lg bg-brass px-5 py-3 text-sm font-medium uppercase tracking-[0.2em] text-black hover:bg-brass/85 transition-colors disabled:cursor-not-allowed disabled:bg-brass/25 disabled:text-foreground/40"
            >
              {role === "play" ? "Join quiz" : "Watch quiz"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

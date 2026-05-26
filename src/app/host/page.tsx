"use client";

import { useCallback, useEffect, useState } from "react";
import HostRoomCard from "@/components/live/HostRoomCard";

/** Six-char A-Z 0-9 code (omitting visually-confusable chars). */
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const STORAGE_KEY = "1pc-host-rooms";

/**
 * Multi-room host dashboard. The host can spin up arbitrarily many
 * rooms — each becomes its own card with an independent WebSocket
 * subscription to the PartyKit server. The list of rooms is persisted
 * in localStorage so the host can refresh the page without losing
 * their dashboard layout. Removing a room from the dashboard only
 * deletes the local pointer — the PartyKit room itself keeps running
 * until all sockets close.
 *
 * Each room is independent: 100+ players can join one room while a
 * different room sits in the lobby; the host controls Start / End for
 * each room separately.
 */
export default function HostDashboardPage() {
  const [rooms, setRooms] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const hostKey = process.env.NEXT_PUBLIC_HOST_KEY || "DEV";

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed)) setRooms(parsed.filter((s) => typeof s === "string"));
      }
    } catch {
      // ignore corrupt localStorage
    }
    setHydrated(true);
  }, []);

  // Persist on change (only after hydration so we don't overwrite with []).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
    } catch {
      // ignore quota errors
    }
  }, [rooms, hydrated]);

  const addRoom = useCallback(() => {
    const code = generateRoomCode();
    setRooms((prev) => (prev.includes(code) ? prev : [...prev, code]));
  }, []);

  const removeRoom = useCallback((code: string) => {
    setRooms((prev) => prev.filter((c) => c !== code));
  }, []);

  return (
    <main className="min-h-screen bg-black text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-brass/15 pb-6">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-brass/70">Host dashboard</p>
            <h1 className="mt-1 text-3xl font-semibold">The 1% Club — live quiz rooms</h1>
            <p className="mt-2 text-sm text-foreground/55">
              Each card is an independent room. Start or end them individually.
            </p>
          </div>
          <button
            onClick={addRoom}
            className="rounded-lg bg-brass px-5 py-3 text-sm font-medium uppercase tracking-[0.2em] text-black hover:bg-brass/85"
          >
            + Create new room
          </button>
        </header>

        {!hydrated ? (
          <p className="mt-12 text-center text-foreground/50">Loading…</p>
        ) : rooms.length === 0 ? (
          <div className="mt-12 rounded-xl border border-dashed border-brass/30 px-6 py-16 text-center">
            <p className="text-foreground/65">
              No rooms yet. Click <span className="font-mono text-brass">+ Create new room</span> to spin up your first room.
            </p>
            <p className="mt-3 text-xs font-mono text-foreground/40">
              Each room can hold ~100 players. Open as many as you need.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rooms.map((code) => (
              <HostRoomCard
                key={code}
                code={code}
                hostKey={hostKey}
                onRemove={() => removeRoom(code)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

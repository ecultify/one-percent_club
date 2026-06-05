"use client";

import { useCallback, useEffect, useState } from "react";
import HostRoomCard from "@/components/live/HostRoomCard";
import type { RoomPhase } from "@/lib/quizProtocol";

type RoomFilter = "all" | "lobby" | "running" | "ended";

const FILTERS: { id: RoomFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "lobby", label: "Open" },
  { id: "running", label: "Running" },
  { id: "ended", label: "Finished" },
];

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
  /** Phase reported by each room card's socket, used for the filter chips. */
  const [phaseByCode, setPhaseByCode] = useState<Record<string, RoomPhase>>({});
  const [filter, setFilter] = useState<RoomFilter>("all");
  const hostKey = process.env.NEXT_PUBLIC_HOST_KEY || "DEV";

  const handlePhaseChange = useCallback((code: string, phase: RoomPhase) => {
    setPhaseByCode((prev) => (prev[code] === phase ? prev : { ...prev, [code]: phase }));
  }, []);

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
            <h1 className="mt-1 text-3xl font-semibold">The 1% Club - live quiz rooms</h1>
            <p className="mt-2 text-sm text-foreground/55">
              Each card is an independent room. Start or end them individually.
            </p>
          </div>
          <button onClick={addRoom} className="lq-btn game-show-btn relative z-0 px-7">
            + Create new room
          </button>
        </header>

        {/* Filter chips — segregate rooms by lifecycle. */}
        {hydrated && rooms.length > 0 && (
          <div className="mt-6 inline-flex gap-1.5 rounded-xl border border-brass/25 bg-black/45 p-1">
            {FILTERS.map((f) => {
              const count =
                f.id === "all"
                  ? rooms.length
                  : rooms.filter((c) => phaseByCode[c] === f.id).length;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`cursor-pointer rounded-lg px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors duration-200 ${
                    filter === f.id ? "bg-brass text-[#14110a]" : "text-muted hover:text-foreground"
                  }`}
                >
                  {f.label} <span className="opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        )}

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
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rooms.map((code) => {
                // Keep every card mounted so its socket stays live and its
                // phase keeps reporting; just hide the ones that don't match
                // the active filter.
                const visible = filter === "all" || phaseByCode[code] === filter;
                return (
                  <div key={code} className={visible ? undefined : "hidden"}>
                    <HostRoomCard
                      code={code}
                      hostKey={hostKey}
                      onRemove={() => removeRoom(code)}
                      onPhaseChange={handlePhaseChange}
                    />
                  </div>
                );
              })}
            </div>
            {rooms.every((code) => !(filter === "all" || phaseByCode[code] === filter)) && (
              <p className="mt-12 text-center text-foreground/50">
                No {FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} rooms right now.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}

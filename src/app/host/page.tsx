"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import HostRoomCard from "@/components/live/HostRoomCard";
import type { RoomPhase } from "@/lib/quizProtocol";
import type { RoomRecord } from "@/lib/roomsDb";

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
  /** Server-side lobby registry (survives across devices & days). Empty when
   *  no database is configured — the dashboard still works off localStorage. */
  const [history, setHistory] = useState<RoomRecord[]>([]);
  const [dbOn, setDbOn] = useState(false);
  const hostKey = process.env.NEXT_PUBLIC_HOST_KEY || "DEV";

  const handlePhaseChange = useCallback((code: string, phase: RoomPhase) => {
    setPhaseByCode((prev) => (prev[code] === phase ? prev : { ...prev, [code]: phase }));
  }, []);

  // Poll the lobby registry so the host sees every room (incl. old/closed
  // ones) from any device. Fails silently — purely additive to the cards.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/rooms", { cache: "no-store" });
        const data = (await res.json()) as { db?: boolean; rooms?: RoomRecord[] };
        if (!alive) return;
        setDbOn(Boolean(data.db));
        setHistory(Array.isArray(data.rooms) ? data.rooms : []);
      } catch {
        /* ignore — registry is optional */
      }
    };
    void load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const addRoomCode = useCallback((code: string) => {
    setRooms((prev) => (prev.includes(code) ? prev : [...prev, code]));
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

        {/* ── Saved lobby registry (cross-device, survives days) ── */}
        {dbOn && history.length > 0 && (
          <section className="mt-12 border-t border-brass/15 pt-6">
            <h2 className="text-lg font-semibold">
              All lobbies <span className="text-sm font-normal text-foreground/45">· saved history</span>
            </h2>
            <p className="mt-1 text-xs text-foreground/45">
              Every room ever created, from any device. Open one to view it (closed rooms show their final standings).
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-mono uppercase tracking-[0.2em] text-foreground/40">
                    <th className="py-1.5">Code</th>
                    <th className="py-1.5">Status</th>
                    <th className="py-1.5">Players</th>
                    <th className="py-1.5">Created</th>
                    <th className="py-1.5">Ended</th>
                    <th className="py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {history
                    .filter((r) => filter === "all" || r.status === filter)
                    .map((r) => (
                      <tr key={r.code} className="border-t border-brass/10">
                        <td className="py-2 font-mono tracking-widest text-brass">{r.code}</td>
                        <td className="py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.15em] ${
                              r.status === "running"
                                ? "bg-emerald-950/40 text-emerald-300"
                                : r.status === "ended"
                                  ? "bg-neutral-800 text-foreground/55"
                                  : "bg-brass/10 text-brass"
                            }`}
                          >
                            {r.status === "lobby" ? "open" : r.status === "ended" ? "finished" : "running"}
                          </span>
                        </td>
                        <td className="py-2 font-mono text-foreground/70">{r.playerCount}</td>
                        <td className="py-2 text-foreground/55">{formatWhen(r.createdAt)}</td>
                        <td className="py-2 text-foreground/55">{r.endedAt ? formatWhen(r.endedAt) : "—"}</td>
                        <td className="py-2 text-right">
                          <div className="flex justify-end gap-3">
                            {!rooms.includes(r.code) && (
                              <button
                                onClick={() => addRoomCode(r.code)}
                                className="text-[10px] font-mono uppercase tracking-[0.2em] text-foreground/40 hover:text-brass"
                              >
                                + Dashboard
                              </button>
                            )}
                            <Link
                              href={`/host/${r.code}?hostKey=${encodeURIComponent(hostKey)}`}
                              className="text-[10px] font-mono uppercase tracking-[0.2em] text-brass/80 hover:text-brass"
                            >
                              Open ›
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

/** Compact local date-time for the history table. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

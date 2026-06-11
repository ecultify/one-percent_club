"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import HostRoomCard from "@/components/live/HostRoomCard";
import AdminUsersPanel from "@/components/live/AdminUsersPanel";
import { authClient } from "@/lib/auth-client";
import { isAdminEmail } from "@/lib/adminConfig";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RoomPhase } from "@/lib/quizProtocol";
import type { HostRoomRow } from "@/lib/roomsDb";
import { QUESTION_SET_IDS, SET_LABELS, type QuestionSetId } from "@/lib/questionSetMeta";

type DashRoom = HostRoomRow & { cohosts?: string[] };
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

/**
 * Per-host dashboard. Each signed-in host sees the rooms THEY created plus any
 * they co-host — server-backed (rooms.created_by + room_cohosts), not browser
 * localStorage, so the list follows them across devices.
 */
export default function HostDashboardPage() {
  const { data: session } = authClient.useSession();
  const isAdmin = isAdminEmail(session?.user?.email);
  const [rooms, setRooms] = useState<DashRoom[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  /** Which question set the next created room will play. */
  const [newRoomSet, setNewRoomSet] = useState<QuestionSetId>("A");
  const [filter, setFilter] = useState<RoomFilter>("all");
  /** Live phase from each card's socket (overrides the stored status). */
  const [phaseByCode, setPhaseByCode] = useState<Record<string, RoomPhase>>({});
  const hostKey = process.env.NEXT_PUBLIC_HOST_KEY || "DEV";

  const handlePhaseChange = useCallback((code: string, phase: RoomPhase) => {
    setPhaseByCode((prev) => (prev[code] === phase ? prev : { ...prev, [code]: phase }));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/host/rooms", { cache: "no-store" });
      const data = (await res.json()) as { authed?: boolean; rooms?: DashRoom[] };
      setRooms(Array.isArray(data.rooms) ? data.rooms : []);
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const createRoom = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      await fetch("/api/host/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: generateRoomCode(), set: newRoomSet }),
      });
      await load();
    } finally {
      setCreating(false);
    }
  }, [creating, newRoomSet, load]);

  const removeRoom = useCallback(
    async (code: string) => {
      await fetch(`/api/host/rooms?code=${encodeURIComponent(code)}`, { method: "DELETE" });
      await load();
    },
    [load],
  );

  const effectivePhase = (r: DashRoom): RoomPhase => phaseByCode[r.code] ?? (r.status as RoomPhase);
  const matches = (r: DashRoom) => filter === "all" || effectivePhase(r) === filter;

  const owned = rooms.filter((r) => r.isOwner);
  const cohosting = rooms.filter((r) => !r.isOwner);

  const renderCard = (r: DashRoom) => (
    <div key={r.code} className={matches(r) ? undefined : "hidden"}>
      {!r.isOwner && r.ownerEmail && (
        <p className="mb-1 text-[10px] font-mono uppercase tracking-[0.2em] text-white/35">
          owned by {r.ownerEmail}
        </p>
      )}
      <HostRoomCard
        code={r.code}
        hostKey={hostKey}
        questionSet={r.questionSet}
        canRemove={r.isOwner}
        onRemove={() => removeRoom(r.code)}
        onPhaseChange={handlePhaseChange}
      />
    </div>
  );

  return (
    <main className="bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Host dashboard</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">The 1% Club — your lobbies</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Rooms you created, plus ones you co-host. Start or end them individually.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Question set
              </span>
              <div className="flex rounded-md border border-white/15 p-0.5">
                {QUESTION_SET_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setNewRoomSet(id)}
                    className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                      newRoomSet === id
                        ? "bg-white text-black"
                        : "text-white/55 hover:text-white"
                    }`}
                    aria-pressed={newRoomSet === id}
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>
            <Button variant="gold" size="lg" onClick={createRoom} disabled={creating}>
              <Plus className="size-4" /> {creating ? "Creating…" : `Create room · ${SET_LABELS[newRoomSet]}`}
            </Button>
          </div>
        </header>

        {rooms.length > 0 && (
          <Tabs value={filter} onValueChange={(v) => setFilter(v as RoomFilter)} className="mt-6">
            <TabsList>
              {FILTERS.map((f) => {
                const count = f.id === "all" ? rooms.length : rooms.filter((r) => effectivePhase(r) === f.id).length;
                return (
                  <TabsTrigger key={f.id} value={f.id}>
                    {f.label} <span className="ml-1.5 opacity-50">{count}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        )}

        {!loaded ? (
          <p className="mt-12 text-center text-white/50">Loading…</p>
        ) : rooms.length === 0 ? (
          <Card className="mt-12 border-dashed bg-transparent px-6 py-16 text-center">
            <p className="text-white/65">
              No rooms yet. Click <span className="font-mono text-white">Create new room</span> to spin up your first.
            </p>
            <p className="mt-3 text-xs font-mono text-white/40">Each room can hold ~100 players.</p>
          </Card>
        ) : (
          <>
            {owned.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-3 text-sm font-medium text-muted-foreground">My rooms</h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{owned.map(renderCard)}</div>
              </section>
            )}
            {cohosting.length > 0 && (
              <section className="mt-10">
                <h2 className="mb-3 text-sm font-medium text-muted-foreground">Co-hosting</h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cohosting.map(renderCard)}</div>
              </section>
            )}
            {rooms.every((r) => !matches(r)) && (
              <p className="mt-12 text-center text-white/50">
                No {FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} rooms right now.
              </p>
            )}
          </>
        )}

        {isAdmin && <AdminUsersPanel />}
      </div>
    </main>
  );
}

/**
 * GET /api/rooms
 *
 * Returns the lobby registry — every room and its lifecycle status — so the
 * host dashboard can show past/closed lobbies across devices and days.
 *
 * The query is run inline here (rather than via roomsDb.listRooms) and the
 * route is force-dynamic + no-store, so every request reflects the live DB.
 * Degrades gracefully: no DATABASE_URL → db:false with an empty list, and the
 * dashboard's localStorage view still works.
 */
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import type { RoomRecord } from "@/lib/roomsDb";
import { DEFAULT_QUESTION_SET, isQuestionSetId } from "@/lib/questionSetMeta";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({ db: false, rooms: [] });
  }
  try {
    const sql = neon(url);
    await sql`
      CREATE TABLE IF NOT EXISTS rooms (
        code TEXT PRIMARY KEY, status TEXT NOT NULL, player_count INTEGER NOT NULL DEFAULT 0,
        host_name TEXT, final_standings JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), started_at TIMESTAMPTZ,
        ended_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS question_set TEXT NOT NULL DEFAULT 'A'`;
    const rows = (await sql`
      SELECT code, status, question_set, player_count, host_name, final_standings,
             created_at, started_at, ended_at, updated_at
      FROM rooms ORDER BY updated_at DESC LIMIT 500
    `) as Record<string, unknown>[];
    const rooms: RoomRecord[] = rows.map((r) => ({
      code: String(r.code),
      status: r.status as RoomRecord["status"],
      questionSet: isQuestionSetId(r.question_set) ? r.question_set : DEFAULT_QUESTION_SET,
      playerCount: Number(r.player_count ?? 0),
      hostName: (r.host_name as string | null) ?? null,
      finalStandings: r.final_standings ?? null,
      createdAt: String(r.created_at),
      startedAt: r.started_at ? String(r.started_at) : null,
      endedAt: r.ended_at ? String(r.ended_at) : null,
      updatedAt: String(r.updated_at),
    }));
    return NextResponse.json({ db: true, rooms });
  } catch (err) {
    console.error("[/api/rooms] query failed:", err);
    return NextResponse.json({ db: true, rooms: [], error: "query-failed" });
  }
}

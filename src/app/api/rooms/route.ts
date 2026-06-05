/**
 * GET /api/rooms
 *
 * Returns the lobby registry — every room and its lifecycle status — so the
 * host dashboard can show past/closed lobbies across devices and days.
 * Reads from Postgres (Neon now / MySQL on Hostinger later) via roomsDb.
 *
 * Degrades gracefully: if no DATABASE_URL is configured it returns an empty
 * list with db:false, so the dashboard's localStorage view still works.
 */
import { NextResponse } from "next/server";
import { isDbConfigured, listRooms } from "@/lib/roomsDb";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ db: false, rooms: [] });
  }
  try {
    const rooms = await listRooms();
    return NextResponse.json({ db: true, rooms });
  } catch (err) {
    console.error("[/api/rooms] list failed:", err);
    return NextResponse.json({ db: true, rooms: [], error: "query-failed" }, { status: 200 });
  }
}

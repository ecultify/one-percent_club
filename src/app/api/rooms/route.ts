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
import { neon } from "@neondatabase/serverless";
import { isDbConfigured, listRooms } from "@/lib/roomsDb";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // TEMP debug: reveal what the deployed function actually connects to.
  if (new URL(req.url).searchParams.get("debug") === "1") {
    const url = process.env.DATABASE_URL || "";
    const host = url ? (url.split("@")[1] || "").split("/")[0] : "(none)";
    let count = -1;
    let selectLen = -1;
    let viaListRooms = -1;
    let derr: string | null = null;
    try {
      const sql = neon(url);
      const r = (await sql`SELECT count(*)::int AS n FROM rooms`) as { n: number }[];
      count = r[0]?.n ?? -1;
      const sel = (await sql`SELECT code FROM rooms ORDER BY updated_at DESC LIMIT 500`) as unknown[];
      selectLen = sel.length;
      viaListRooms = (await listRooms()).length;
    } catch (e) {
      derr = e instanceof Error ? e.message : String(e);
    }
    return NextResponse.json({ host, urlLen: url.length, count, selectLen, viaListRooms, derr });
  }

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

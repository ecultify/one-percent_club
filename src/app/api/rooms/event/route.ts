/**
 * POST /api/rooms/event
 *
 * Records a room lifecycle event into the registry. Called server-to-server
 * by the PartyKit quiz server when a room is created / started / ended, so
 * the lobby history is authoritative regardless of which host browser is
 * connected.
 *
 * Auth: if ROOMS_EVENT_SECRET is set, the caller must send a matching
 * `x-rooms-secret` header (set the same value as a PartyKit secret). If the
 * env var is unset (local dev), the check is skipped.
 *
 * Body: { code, status, playerCount?, hostName?, finalStandings? }
 */
import { NextResponse } from "next/server";
import { isDbConfigured, recordRoomEvent, type RoomStatus } from "@/lib/roomsDb";

export const dynamic = "force-dynamic";

const VALID_STATUS: RoomStatus[] = ["lobby", "running", "ended"];

export async function POST(req: Request) {
  const secret = process.env.ROOMS_EVENT_SECRET;
  if (secret && req.headers.get("x-rooms-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, error: "no-db" }, { status: 200 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const status = body.status as RoomStatus;
  if (!code || !VALID_STATUS.includes(status)) {
    return NextResponse.json({ ok: false, error: "bad-input" }, { status: 400 });
  }

  try {
    await recordRoomEvent({
      code,
      status,
      playerCount: typeof body.playerCount === "number" ? body.playerCount : 0,
      hostName: typeof body.hostName === "string" ? body.hostName : null,
      finalStandings: body.finalStandings ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/rooms/event] write failed:", err);
    return NextResponse.json({ ok: false, error: "write-failed" }, { status: 200 });
  }
}

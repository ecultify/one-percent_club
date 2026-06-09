/**
 * POST /api/host/cohost {code, email} → owner invites a co-host by email.
 *
 * Only the room's owner may add co-hosts. The invitee must already have a host
 * account (they sign up at /host first). Adds a row to room_cohosts so the room
 * shows up in their dashboard.
 */
import { NextResponse } from "next/server";
import { getHostUserId } from "@/lib/hostSession";
import { addCohost, findUserIdByEmail, getRoomOwner } from "@/lib/roomsDb";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const uid = await getHostUserId();
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!code || !email) return NextResponse.json({ ok: false, error: "bad-input" }, { status: 400 });

  const owner = await getRoomOwner(code);
  if (!owner) return NextResponse.json({ ok: false, error: "no-such-room" }, { status: 404 });
  if (owner !== uid) return NextResponse.json({ ok: false, error: "not-owner" }, { status: 403 });

  const targetId = await findUserIdByEmail(email);
  if (!targetId) {
    return NextResponse.json({ ok: false, error: "no-such-user" });
  }
  if (targetId === uid) {
    return NextResponse.json({ ok: false, error: "already-owner" });
  }
  await addCohost(code, targetId);
  return NextResponse.json({ ok: true });
}

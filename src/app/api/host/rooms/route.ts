/**
 * GET  /api/host/rooms        → rooms the signed-in host owns or co-hosts
 * POST /api/host/rooms {code}  → create/claim a room owned by the host
 * DELETE /api/host/rooms?code= → remove a room the host owns
 *
 * Auth via better-auth session (host-only). The dashboard is per-user: each
 * host sees their own lobbies.
 */
import { NextResponse } from "next/server";
import { getHostUserId } from "@/lib/hostSession";
import { createOwnedRoom, deleteOwnedRoom, listCohostEmails, listRoomsForUser } from "@/lib/roomsDb";

export const dynamic = "force-dynamic";

export async function GET() {
  const uid = await getHostUserId();
  if (!uid) return NextResponse.json({ authed: false, rooms: [] });
  try {
    const rooms = await listRoomsForUser(uid);
    const withCohosts = await Promise.all(
      rooms.map(async (r) => ({ ...r, cohosts: r.isOwner ? await listCohostEmails(r.code) : [] })),
    );
    return NextResponse.json({ authed: true, rooms: withCohosts });
  } catch (err) {
    console.error("[/api/host/rooms GET]", err);
    return NextResponse.json({ authed: true, rooms: [], error: "query-failed" });
  }
}

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
  if (!/^[A-Z0-9]{4,8}$/.test(code)) {
    return NextResponse.json({ ok: false, error: "bad-code" }, { status: 400 });
  }
  try {
    await createOwnedRoom(code, uid);
    return NextResponse.json({ ok: true, code });
  } catch (err) {
    console.error("[/api/host/rooms POST]", err);
    return NextResponse.json({ ok: false, error: "write-failed" }, { status: 200 });
  }
}

export async function DELETE(req: Request) {
  const uid = await getHostUserId();
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const code = new URL(req.url).searchParams.get("code")?.trim().toUpperCase() ?? "";
  if (!code) return NextResponse.json({ ok: false, error: "bad-code" }, { status: 400 });
  const ok = await deleteOwnedRoom(code, uid);
  return NextResponse.json({ ok });
}

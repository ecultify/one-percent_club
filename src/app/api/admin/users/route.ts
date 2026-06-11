/**
 * Admin-only host-account management.
 *
 *   GET    → list all host logins (id, email, name, createdAt)
 *   POST   → create a host login   body: { email, password, name? }
 *   DELETE → remove a host login   ?id=<userId>
 *   DELETE → remove EVERY non-admin login   ?purge=others
 *
 * Only emails on the ADMIN_EMAILS allow-list may call any of these. Account
 * creation goes through better-auth's server API (auth.api.signUpEmail) so
 * password hashing matches normal sign-ins; the public HTTP sign-up route is
 * blocked in /api/auth/[...all].
 */
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { auth } from "@/lib/auth";
import { getHostSessionUser } from "@/lib/hostSession";
import { isAdminEmail, ADMIN_EMAILS } from "@/lib/adminConfig";

export const dynamic = "force-dynamic";

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

async function requireAdmin() {
  const user = await getHostSessionUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

export interface HostUserRow {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  isAdmin: boolean;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const sql = getSql();
  if (!sql) return NextResponse.json({ ok: false, error: "no-db" }, { status: 200 });
  const rows = (await sql`
    SELECT id, email, name, "createdAt" FROM "user" ORDER BY "createdAt" ASC
  `) as Record<string, unknown>[];
  const users: HostUserRow[] = rows.map((r) => ({
    id: String(r.id),
    email: String(r.email),
    name: (r.name as string | null) ?? null,
    createdAt: String(r.createdAt),
    isAdmin: isAdminEmail(String(r.email)),
  }));
  return NextResponse.json({ ok: true, users });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name =
    typeof body.name === "string" && body.name.trim() ? body.name.trim() : email.split("@")[0];
  if (!email || !email.includes("@") || password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "Email and a password of at least 8 characters are required." },
      { status: 400 },
    );
  }

  try {
    await auth.api.signUpEmail({ body: { email, password, name } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "Could not create the account.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const sql = getSql();
  if (!sql) return NextResponse.json({ ok: false, error: "no-db" }, { status: 200 });

  const params = new URL(req.url).searchParams;

  // One-shot cleanup: wipe every login that isn't on the admin allow-list
  // (sessions and credential rows included). Admins keep their access.
  if (params.get("purge") === "others") {
    const adminList = ADMIN_EMAILS.map((e) => e.toLowerCase());
    const doomed = (await sql`
      SELECT id, email FROM "user" WHERE lower(email) != ALL(${adminList})
    `) as Record<string, unknown>[];
    for (const row of doomed) {
      const uid = String(row.id);
      await sql`DELETE FROM "session" WHERE "userId" = ${uid}`;
      await sql`DELETE FROM "account" WHERE "userId" = ${uid}`;
      await sql`DELETE FROM "user" WHERE id = ${uid}`;
    }
    return NextResponse.json({ ok: true, removed: doomed.map((r) => String(r.email)) });
  }

  const id = params.get("id")?.trim();
  if (!id) return NextResponse.json({ ok: false, error: "missing-id" }, { status: 400 });

  const rows = (await sql`SELECT email FROM "user" WHERE id = ${id}`) as Record<string, unknown>[];
  if (rows.length === 0) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  const email = String(rows[0].email);
  if (isAdminEmail(email)) {
    return NextResponse.json(
      { ok: false, error: `Admin accounts (${ADMIN_EMAILS.join(", ")}) cannot be removed.` },
      { status: 400 },
    );
  }

  await sql`DELETE FROM "session" WHERE "userId" = ${id}`;
  await sql`DELETE FROM "account" WHERE "userId" = ${id}`;
  await sql`DELETE FROM "user" WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

/**
 * Lobby-history persistence — a thin, portable data layer for the `rooms`
 * registry. Records every quiz room and its lifecycle so the host can see
 * past/closed lobbies across devices and days.
 *
 * PORTABILITY (Postgres now → MySQL on Hostinger later)
 * ─────────────────────────────────────────────────────
 * Today this uses @neondatabase/serverless (Postgres over HTTP) so it runs
 * on Vercel serverless against Neon. To move to Hostinger MySQL later, the
 * ONLY file that changes is this one:
 *   1. swap the driver (neon → mysql2/promise pool),
 *   2. apply the small dialect tweaks flagged with `DIALECT:` comments below
 *      (JSONB→JSON, TIMESTAMPTZ→DATETIME, now()→CURRENT_TIMESTAMP,
 *       ON CONFLICT→ON DUPLICATE KEY UPDATE, $1→?).
 * Everything else (API routes, dashboard, PartyKit) stays the same.
 *
 * All functions degrade gracefully: if DATABASE_URL is unset (e.g. local dev
 * without a DB) they no-op / return empty so the app keeps working.
 */
import { neon } from "@neondatabase/serverless";
import { type QuestionSetId, DEFAULT_QUESTION_SET, isQuestionSetId } from "@/lib/questionSetMeta";

export type RoomStatus = "lobby" | "running" | "ended";

export interface RoomRecord {
  code: string;
  status: RoomStatus;
  /** Which question set (A/B/C) this lobby plays. Picked at creation. */
  questionSet: QuestionSetId;
  playerCount: number;
  hostName: string | null;
  finalStandings: unknown | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  updatedAt: string;
}

export interface RoomEventInput {
  code: string;
  status: RoomStatus;
  playerCount?: number;
  hostName?: string | null;
  /** Final leaderboard JSON, set when a quiz ends. */
  finalStandings?: unknown | null;
}

/** Lazily build the SQL client; null when no DATABASE_URL is configured. */
function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

let tableReady = false;

/** Create the table on first use (idempotent). Cheaper than a migration step
 *  for a single table. DIALECT: MySQL → JSONB→JSON, TIMESTAMPTZ→DATETIME,
 *  now()→CURRENT_TIMESTAMP. */
async function ensureTable(sql: NonNullable<ReturnType<typeof getSql>>) {
  if (tableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS rooms (
      code             TEXT PRIMARY KEY,
      status           TEXT NOT NULL,
      player_count     INTEGER NOT NULL DEFAULT 0,
      host_name        TEXT,
      final_standings  JSONB,
      created_by       TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      started_at       TIMESTAMPTZ,
      ended_at         TIMESTAMPTZ,
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // For pre-existing tables created before ownership was added.
  await sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS created_by TEXT`;
  // Question set (A/B/C) — added June 2026 for the set-based live quiz.
  await sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS question_set TEXT NOT NULL DEFAULT 'A'`;
  await sql`
    CREATE TABLE IF NOT EXISTS room_cohosts (
      room_code  TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (room_code, user_id)
    )
  `;
  tableReady = true;
}

/** Map a DB row to the RoomRecord shape. */
function mapRoomRow(r: Record<string, unknown>): RoomRecord {
  return {
    code: String(r.code),
    status: r.status as RoomStatus,
    questionSet: isQuestionSetId(r.question_set) ? r.question_set : DEFAULT_QUESTION_SET,
    playerCount: Number(r.player_count ?? 0),
    hostName: (r.host_name as string | null) ?? null,
    finalStandings: r.final_standings ?? null,
    createdAt: String(r.created_at),
    startedAt: r.started_at ? String(r.started_at) : null,
    endedAt: r.ended_at ? String(r.ended_at) : null,
    updatedAt: String(r.updated_at),
  };
}

/**
 * Upsert a room's lifecycle event. Sets started_at when it first goes
 * "running" and ended_at + final_standings when it goes "ended".
 * DIALECT: MySQL → replace `ON CONFLICT (code) DO UPDATE SET … EXCLUDED.x`
 * with `ON DUPLICATE KEY UPDATE x = VALUES(x)` and `$1`→`?`.
 */
export async function recordRoomEvent(input: RoomEventInput): Promise<void> {
  const sql = getSql();
  if (!sql) return; // no DB configured — silently skip
  await ensureTable(sql);
  const { code, status, playerCount = 0, hostName = null } = input;
  const standings =
    input.finalStandings == null ? null : JSON.stringify(input.finalStandings);
  await sql`
    INSERT INTO rooms (code, status, player_count, host_name, final_standings, started_at, ended_at, updated_at)
    VALUES (
      ${code},
      ${status},
      ${playerCount},
      ${hostName},
      ${standings},
      ${status === "running" ? new Date().toISOString() : null},
      ${status === "ended" ? new Date().toISOString() : null},
      now()
    )
    ON CONFLICT (code) DO UPDATE SET
      status          = EXCLUDED.status,
      player_count    = GREATEST(rooms.player_count, EXCLUDED.player_count),
      host_name       = COALESCE(EXCLUDED.host_name, rooms.host_name),
      final_standings = COALESCE(EXCLUDED.final_standings, rooms.final_standings),
      started_at      = COALESCE(rooms.started_at, EXCLUDED.started_at),
      ended_at        = COALESCE(EXCLUDED.ended_at, rooms.ended_at),
      updated_at      = now()
  `;
}

/** All rooms, newest activity first. */
export async function listRooms(): Promise<RoomRecord[]> {
  const sql = getSql();
  if (!sql) return [];
  await ensureTable(sql);
  const rows = (await sql`
    SELECT code, status, question_set, player_count, host_name, final_standings,
           created_at, started_at, ended_at, updated_at
    FROM rooms
    ORDER BY updated_at DESC
    LIMIT 500
  `) as Record<string, unknown>[];
  return rows.map(mapRoomRow);
}

// ─── Per-host ownership (named logins) ───────────────────────────────────────

export interface HostRoomRow extends RoomRecord {
  /** True when the signed-in user owns this room (vs. co-hosting it). */
  isOwner: boolean;
  /** Email of the room's owner, for display. */
  ownerEmail: string | null;
}

/** Create (or claim) a room owned by the given user. Idempotent: if the row
 *  already exists from the registry, only fills created_by when it's empty. */
export async function createOwnedRoom(
  code: string,
  userId: string,
  questionSet: QuestionSetId = DEFAULT_QUESTION_SET,
): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  await ensureTable(sql);
  await sql`
    INSERT INTO rooms (code, status, question_set, created_by, updated_at)
    VALUES (${code}, 'lobby', ${questionSet}, ${userId}, now())
    ON CONFLICT (code) DO UPDATE SET
      question_set = EXCLUDED.question_set,
      created_by   = COALESCE(rooms.created_by, EXCLUDED.created_by),
      updated_at   = now()
  `;
}

/** Rooms the user owns or co-hosts, newest first, with owner email. */
export async function listRoomsForUser(userId: string): Promise<HostRoomRow[]> {
  const sql = getSql();
  if (!sql) return [];
  await ensureTable(sql);
  const rows = (await sql`
    SELECT r.code, r.status, r.question_set, r.player_count, r.host_name, r.final_standings,
           r.created_at, r.started_at, r.ended_at, r.updated_at, r.created_by,
           u.email AS owner_email
    FROM rooms r
    LEFT JOIN "user" u ON u.id = r.created_by
    WHERE r.created_by = ${userId}
       OR r.code IN (SELECT room_code FROM room_cohosts WHERE user_id = ${userId})
    ORDER BY r.updated_at DESC
    LIMIT 200
  `) as Record<string, unknown>[];
  return rows.map((r) => ({
    ...mapRoomRow(r),
    isOwner: r.created_by === userId,
    ownerEmail: (r.owner_email as string | null) ?? null,
  }));
}

/** Who owns a room (for authorizing co-host invites / removal). */
export async function getRoomOwner(code: string): Promise<string | null> {
  const sql = getSql();
  if (!sql) return null;
  await ensureTable(sql);
  const rows = (await sql`SELECT created_by FROM rooms WHERE code = ${code}`) as Record<string, unknown>[];
  return rows[0] ? ((rows[0].created_by as string | null) ?? null) : null;
}

/** Resolve a user id from an email (for inviting a co-host). */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const sql = getSql();
  if (!sql) return null;
  const rows = (await sql`SELECT id FROM "user" WHERE lower(email) = lower(${email}) LIMIT 1`) as Record<
    string,
    unknown
  >[];
  return rows[0] ? String(rows[0].id) : null;
}

/** Add a co-host to a room (idempotent). */
export async function addCohost(code: string, userId: string): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  await ensureTable(sql);
  await sql`
    INSERT INTO room_cohosts (room_code, user_id)
    VALUES (${code}, ${userId})
    ON CONFLICT (room_code, user_id) DO NOTHING
  `;
}

/** Emails of a room's co-hosts, for display. */
export async function listCohostEmails(code: string): Promise<string[]> {
  const sql = getSql();
  if (!sql) return [];
  await ensureTable(sql);
  const rows = (await sql`
    SELECT u.email FROM room_cohosts c JOIN "user" u ON u.id = c.user_id WHERE c.room_code = ${code}
  `) as Record<string, unknown>[];
  return rows.map((r) => String(r.email));
}

/** Remove a room the user owns (from the registry + its co-host rows). */
export async function deleteOwnedRoom(code: string, userId: string): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;
  await ensureTable(sql);
  const res = (await sql`DELETE FROM rooms WHERE code = ${code} AND created_by = ${userId} RETURNING code`) as unknown[];
  if (res.length > 0) {
    await sql`DELETE FROM room_cohosts WHERE room_code = ${code}`;
    return true;
  }
  return false;
}

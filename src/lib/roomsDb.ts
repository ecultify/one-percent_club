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

export type RoomStatus = "lobby" | "running" | "ended";

export interface RoomRecord {
  code: string;
  status: RoomStatus;
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
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      started_at       TIMESTAMPTZ,
      ended_at         TIMESTAMPTZ,
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  tableReady = true;
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
    SELECT code, status, player_count, host_name, final_standings,
           created_at, started_at, ended_at, updated_at
    FROM rooms
    ORDER BY updated_at DESC
    LIMIT 500
  `) as Record<string, unknown>[];
  return rows.map((r) => ({
    code: String(r.code),
    status: r.status as RoomStatus,
    playerCount: Number(r.player_count ?? 0),
    hostName: (r.host_name as string | null) ?? null,
    finalStandings: r.final_standings ?? null,
    createdAt: String(r.created_at),
    startedAt: r.started_at ? String(r.started_at) : null,
    endedAt: r.ended_at ? String(r.ended_at) : null,
    updatedAt: String(r.updated_at),
  }));
}

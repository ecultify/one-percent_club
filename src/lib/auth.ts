import { betterAuth } from "better-auth";
import { Pool } from "pg";

/**
 * better-auth server instance — named host/co-host logins, stored in the same
 * Neon Postgres as the lobby registry. Scoped in the app to /host only (the
 * main quiz, /play and /watch never touch auth).
 *
 * node-postgres doesn't speak Neon's `channel_binding=require`, so we strip it
 * (sslmode=require is kept for TLS).
 */
const connectionString = (process.env.DATABASE_URL || "").replace(/[?&]channel_binding=require/g, "");

export const auth = betterAuth({
  database: new Pool({ connectionString }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || undefined,
  emailAndPassword: {
    enabled: true,
    // Trusted operators — no email round-trip needed to start hosting.
    requireEmailVerification: false,
  },
});

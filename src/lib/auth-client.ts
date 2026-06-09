"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Client-side better-auth. Defaults to the same-origin /api/auth handler, so
 * no base URL config is needed. Exposes signIn / signUp / signOut / useSession.
 */
export const authClient = createAuthClient();

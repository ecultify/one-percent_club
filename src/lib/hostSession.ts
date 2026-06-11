import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/** Resolve the signed-in host's user id (or null) in a route handler. */
export async function getHostUserId(): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: (await headers()) as unknown as Headers });
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Resolve the signed-in host's id + email (or null) in a route handler.
 *  Used by the admin-only endpoints to check the allow-list. */
export async function getHostSessionUser(): Promise<{ id: string; email: string } | null> {
  try {
    const session = await auth.api.getSession({ headers: (await headers()) as unknown as Headers });
    if (!session?.user?.id || !session.user.email) return null;
    return { id: session.user.id, email: session.user.email };
  } catch {
    return null;
  }
}

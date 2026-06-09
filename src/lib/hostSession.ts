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

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { isAdminEmail } from "@/lib/adminConfig";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

/**
 * Public sign-up is DISABLED: host accounts are provisioned by an admin from
 * the dashboard (which calls auth.api.signUpEmail directly server-side via
 * /api/admin/users, bypassing this HTTP gate). Everything else (sign-in,
 * sign-out, session) passes straight through to better-auth.
 */
export async function POST(req: Request) {
  const { pathname } = new URL(req.url);
  if (pathname.includes("/sign-up")) {
    const session = await auth.api.getSession({ headers: req.headers });
    let allowed = isAdminEmail(session?.user?.email);
    if (!allowed) {
      // Bootstrap path: an ADMIN email may create its own account (first
      // sign-in ever, or after a DB wipe). Everyone else is provisioned by
      // the admin from the dashboard.
      try {
        const body = (await req.clone().json()) as { email?: unknown };
        allowed = typeof body.email === "string" && isAdminEmail(body.email);
      } catch {
        /* unreadable body → stays disallowed */
      }
    }
    if (!allowed) {
      return NextResponse.json(
        { message: "Sign-up is disabled. Ask an admin to create your host account." },
        { status: 403 },
      );
    }
  }
  return handlers.POST(req);
}

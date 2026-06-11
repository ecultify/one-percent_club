/**
 * Admin allow-list for the host area.
 *
 * Admins are the only accounts that can CREATE new host logins (public
 * sign-up is disabled — see /api/auth/[...all] and /api/admin/users) and the
 * only ones who see the "Host accounts" panel on the dashboard. Regular host
 * accounts (created by an admin) can sign in and run lobbies as before.
 *
 * Shared by server routes and client components — keep it dependency-free.
 */
export const ADMIN_EMAILS = ["abhinav.rai@ecultify.com"];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

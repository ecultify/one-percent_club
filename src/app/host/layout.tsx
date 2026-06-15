"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { isAdminEmail } from "@/lib/adminConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * Auth gate for the host area only. The main quiz (/), /play and /watch are
 * separate route trees and never see this — auth is exclusively for hosts.
 * Named logins are stored in Neon (better-auth). PartyKit control still uses
 * the shared host key; this just identifies WHO is hosting.
 */
export default function HostLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <main className="min-h-screen flex items-center justify-center bg-black text-white/60">Loading…</main>;
  }
  

  if (!session) {
    return <HostAuthGate />;
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="flex items-center justify-between border-b border-border px-6 py-2.5">
        <span className="text-xs font-medium text-muted-foreground">The 1% Club · Host</span>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="hidden sm:inline">{session.user.email}</span>
          <button onClick={() => authClient.signOut()} className="text-muted-foreground hover:text-foreground">
            Sign out
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

/** Sign-in only. Public account creation was removed — host logins are
 *  provisioned by an admin from the dashboard's "Host accounts" panel
 *  (and the sign-up endpoint is blocked server-side for non-admins). */
function HostAuthGate() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [offerAdminBootstrap, setOfferAdminBootstrap] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    const res = await authClient.signIn.email({ email: email.trim(), password });
    setBusy(false);
    if (res.error) {
      setErr(res.error.message || "Something went wrong. Check your details and try again.");
      // First-run / post-wipe escape hatch: the allow-listed admin may
      // create their own account (the server only permits admin emails).
      if (isAdminEmail(email)) setOfferAdminBootstrap(true);
    }
    // On success the session store updates and the layout re-renders to children.
  };

  const bootstrapAdmin = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const res = await authClient.signUp.email({
      email: email.trim(),
      password,
      name: email.trim().split("@")[0],
    });
    setBusy(false);
    if (res.error) setErr(res.error.message || "Could not create the admin account.");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-black px-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="text-xs font-medium text-muted-foreground">The 1% Club · Host</p>
          <CardTitle className="text-2xl">Host sign in</CardTitle>
          <CardDescription>Sign in to manage your lobbies.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              placeholder="Email"
              autoComplete="email"
            />
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              minLength={8}
              placeholder="Password (min 8 chars)"
              autoComplete="current-password"
            />

            {err && <p className="text-sm text-red-300">{err}</p>}

            <Button type="submit" variant="gold" size="full" disabled={busy} className="mt-2">
              {busy ? "Please wait…" : "Sign in"}
            </Button>
          </form>

          {offerAdminBootstrap && (
            <Button
              type="button"
              variant="outline"
              size="full"
              disabled={busy}
              className="mt-3"
              onClick={() => void bootstrapAdmin()}
            >
              First time? Create the admin account
            </Button>
          )}

          <p className="mt-4 text-center text-xs text-white/45">
            Accounts are created by the event admin — ask them for your login.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

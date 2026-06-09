"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

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
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-2.5">
        <span className="text-[10px] font-mono uppercase tracking-[0.35em] text-white/45">The 1% Club · Host</span>
        <div className="flex items-center gap-3 text-xs text-white/55">
          <span className="hidden sm:inline">{session.user.email}</span>
          <button
            onClick={() => authClient.signOut()}
            className="font-mono uppercase tracking-[0.15em] text-white/50 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function HostAuthGate() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    const res =
      mode === "sign-in"
        ? await authClient.signIn.email({ email: email.trim(), password })
        : await authClient.signUp.email({
            email: email.trim(),
            password,
            name: name.trim() || email.trim().split("@")[0],
          });
    setBusy(false);
    if (res.error) {
      setErr(res.error.message || "Something went wrong. Check your details and try again.");
    }
    // On success the session store updates and the layout re-renders to children.
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-black px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-950 p-7"
      >
        <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/45">The 1% Club · Host</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          {mode === "sign-in" ? "Host sign in" : "Create host account"}
        </h1>
        <p className="mt-1 text-sm text-white/55">
          {mode === "sign-in"
            ? "Sign in to manage your lobbies."
            : "Make an account to host and manage lobbies."}
        </p>

        <div className="mt-6 space-y-3">
          {mode === "sign-up" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              autoComplete="name"
              className="w-full rounded-lg border border-white/15 bg-black/60 px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-white/35"
            />
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            placeholder="Email"
            autoComplete="email"
            className="w-full rounded-lg border border-white/15 bg-black/60 px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-white/35"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            minLength={8}
            placeholder="Password (min 8 chars)"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            className="w-full rounded-lg border border-white/15 bg-black/60 px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-white/35"
          />
        </div>

        {err && <p className="mt-3 text-sm text-red-300">{err}</p>}

        <Button type="submit" variant="gold" size="full" disabled={busy} className="mt-5">
          {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "sign-in" ? "sign-up" : "sign-in"));
            setErr(null);
          }}
          className="mt-4 w-full text-center text-xs text-white/50 hover:text-white"
        >
          {mode === "sign-in" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
      </form>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

/**
 * Admin-only "Host accounts" panel on the host dashboard. Lists every host
 * login and lets the admin create new credentials (email + password) or
 * remove a login. Backed by /api/admin/users, which enforces the
 * ADMIN_EMAILS allow-list server-side — rendering this for a non-admin
 * would just show errors, so the dashboard only mounts it for admins.
 */
interface HostUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  isAdmin: boolean;
}

export default function AdminUsersPanel() {
  const [users, setUsers] = useState<HostUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; users?: HostUser[] };
      if (data.ok && Array.isArray(data.users)) setUsers(data.users);
    } catch {
      /* ignore — panel just stays empty */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createUser = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, name: name.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!data.ok) {
        setErr(data.error || "Could not create the account.");
      } else {
        setNotice(`Login created for ${email.trim()}. Share the email + password with them.`);
        setEmail("");
        setPassword("");
        setName("");
        await load();
      }
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (u: HostUser) => {
    if (!window.confirm(`Remove the host login for ${u.email}? They will no longer be able to sign in.`)) return;
    setErr(null);
    setNotice(null);
    const res = await fetch(`/api/admin/users?id=${encodeURIComponent(u.id)}`, { method: "DELETE" });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!data.ok) setErr(data.error || "Could not remove the account.");
    await load();
  };

  const purgeOthers = async () => {
    if (
      !window.confirm(
        "Remove ALL host logins except the admin account(s)? Everyone else will need a new login created here before they can sign in again.",
      )
    )
      return;
    setErr(null);
    setNotice(null);
    const res = await fetch("/api/admin/users?purge=others", { method: "DELETE" });
    const data = (await res.json()) as { ok?: boolean; error?: string; removed?: string[] };
    if (!data.ok) setErr(data.error || "Could not purge accounts.");
    else setNotice(data.removed?.length ? `Removed: ${data.removed.join(", ")}` : "No non-admin logins to remove.");
    await load();
  };

  return (
    <section className="mt-12">
      <Card>
        <CardHeader>
          <p className="text-xs font-medium text-muted-foreground">Admin</p>
          <CardTitle>Host accounts</CardTitle>
          <CardDescription>
            Create login credentials for people who need to host lobbies. Public sign-up is disabled —
            this panel is the only way new hosts get access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createUser} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              placeholder="email@company.com"
              autoComplete="off"
              className="sm:flex-1"
            />
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="text"
              required
              minLength={8}
              placeholder="Password (min 8 chars)"
              autoComplete="off"
              className="sm:flex-1"
            />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (optional)"
              autoComplete="off"
              className="sm:w-44"
            />
            <Button type="submit" variant="gold" disabled={busy}>
              {busy ? "Creating…" : "Create login"}
            </Button>
          </form>

          {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
          {notice && <p className="mt-3 text-sm text-emerald-300">{notice}</p>}

          <div className="mt-6">
            {users.some((u) => !u.isAdmin) && (
              <div className="mb-3 flex justify-end">
                <Button variant="destructive" size="sm" onClick={() => void purgeOthers()}>
                  Remove all non-admin logins
                </Button>
              </div>
            )}
            {!loaded ? (
              <p className="text-sm text-muted-foreground">Loading accounts…</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No host accounts found.</p>
            ) : (
              <ul className="divide-y divide-white/10">
                {users.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">
                        {u.email}
                        {u.isAdmin && <Badge className="ml-2 align-middle">admin</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {u.name || "—"} · added {new Date(u.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {!u.isAdmin && (
                      <Button variant="outline" size="sm" onClick={() => void removeUser(u)}>
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { signOut, useSession } from "@/hooks/use-session";
import { createLogger } from "@/lib/logger";

const log = createLogger("auth");

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Sports Recruit IQ360™" },
      { name: "description", content: "Sign in to your Sports Recruit IQ360 account." },
      { property: "og:title", content: "Sign in — Sports Recruit IQ360™" },
      { property: "og:description", content: "Secure sign-in for athletes and guardians." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { supabase } = await import("@/lib/supabase");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) {
      log.warn("sign_in_failed", { code: err.code ?? null, status: err.status ?? null });
      setError(err.message);
    } else {
      log.info("sign_in_succeeded");
      void navigate({ to: "/record" });
    }
  }

  return (
    <AppShell eyebrow="Account" title="Sign in">
      {session ? (
        <div className="max-w-sm space-y-4 text-sm">
          <p>Signed in as {session.user.email}.</p>
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="max-w-sm space-y-4">
          <label className="block text-sm">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      )}
    </AppShell>
  );
}

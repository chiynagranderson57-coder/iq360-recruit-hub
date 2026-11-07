import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

/** Public recovery surface. Supabase verifies the session before any password change. */
export function PasswordRecovery({ mode }: { mode: "forgot" | "recovery" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "recovery") return;
    let cancelled = false;
    void (async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        // getUser waits for URL-session initialization and validates with the Auth server.
        const { data, error: authError } = await supabase.auth.getUser();
        // Remove recovery credentials/errors from the address bar; never log them.
        window.history.replaceState(null, "", "/auth?mode=recovery");
        if (cancelled) return;
        if (authError || !data.user) {
          setError(
            "This reset link has expired or has already been used. Request a new link below.",
          );
        } else {
          setReady(true);
        }
      } catch {
        if (!cancelled) setError("Unable to verify this reset link. Please request a new link.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || done) return;
    setError(null);
    if (mode === "recovery" && (!ready || password !== confirmation)) {
      setError("Enter the same new password in both fields.");
      return;
    }
    setBusy(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      if (mode === "forgot") {
        const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth?mode=recovery`,
        });
        if (requestError) throw requestError;
      } else {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setPassword("");
        setConfirmation("");
        await supabase.auth.signOut({ scope: "local" });
      }
      setDone(true);
    } catch {
      setError(
        mode === "forgot"
          ? "Unable to send the reset email. Please try again shortly."
          : "Unable to update the password. Use a strong password of at least 12 characters, or request a new link.",
      );
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2";
  return (
    <AppShell eyebrow="Account recovery" title="Reset your password">
      <div className="max-w-sm space-y-4">
        {done ? (
          <p role="status">
            {mode === "forgot"
              ? "If this account exists, a reset email has been sent. Open the newest email and choose Reset password."
              : "Your password has been updated. You can now sign in with your new password."}
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {mode === "forgot" ? (
              <label className="block text-sm">
                Account email
                <input
                  className={inputClass}
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            ) : ready ? (
              <>
                <label className="block text-sm">
                  New password
                  <input
                    className={inputClass}
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Confirm new password
                  <input
                    className={inputClass}
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    required
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                  />
                </label>
              </>
            ) : !error ? (
              <p role="status">Verifying your reset link…</p>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {(mode === "forgot" || ready) && (
              <Button type="submit" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : mode === "forgot"
                    ? "Send reset email"
                    : "Save new password"}
              </Button>
            )}
          </form>
        )}
        <p className="text-sm">
          <a href="/auth?mode=forgot" className="underline">
            Request a new reset link
          </a>
        </p>
        <p className="text-sm">
          <a href="/auth" className="underline">
            Return to sign in
          </a>
        </p>
      </div>
    </AppShell>
  );
}

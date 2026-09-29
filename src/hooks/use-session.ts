import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

/** Client-only session state. `undefined` while loading, `null` when signed out. */
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    void import("@/lib/supabase").then(({ supabase }) => {
      if (cancelled) return;
      const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
      unsub = () => data.subscription.unsubscribe();
      void supabase.auth.getSession().then(({ data: d }) => {
        if (!cancelled) setSession(d.session);
      });
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  return session;
}

export async function signOut() {
  const { supabase } = await import("@/lib/supabase");
  await supabase.auth.signOut();
}

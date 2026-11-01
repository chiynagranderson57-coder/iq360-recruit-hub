import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";

import { synchronizeSessionCache } from "@/lib/session-cache";

/** Client-only session state. `undefined` while loading, `null` when signed out. */
export function useSession() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    let authVersion = 0;
    const publishSession = (nextSession: Session | null) => {
      if (cancelled) return;
      synchronizeSessionCache(queryClient, nextSession?.user.id ?? null);
      setSession(nextSession);
    };
    void import("@/lib/supabase").then(({ supabase }) => {
      if (cancelled) return;
      const { data } = supabase.auth.onAuthStateChange((_event, s) => {
        authVersion += 1;
        publishSession(s);
      });
      unsub = () => data.subscription.unsubscribe();
      const requestedAtVersion = authVersion;
      void supabase.auth.getSession().then(({ data: d }) => {
        // An auth event is newer than an outstanding initial session snapshot.
        if (authVersion === requestedAtVersion) publishSession(d.session);
      });
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [queryClient]);

  return session;
}

export async function signOut() {
  const { supabase } = await import("@/lib/supabase");
  await supabase.auth.signOut();
}

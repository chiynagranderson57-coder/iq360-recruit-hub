/**
 * Browser-safe Supabase client for the canonical external project
 * (ref lqthjvzjkbwtggrhgpts). Uses the publishable key only; RLS applies.
 * Never import a service-role/secret key into this module.
 */
import { createClient } from "@supabase/supabase-js";
import { resolveAppBackend } from "./environment";

const backend = resolveAppBackend(import.meta.env);
export const SUPABASE_URL = backend.url;
export const SUPABASE_PUBLISHABLE_KEY = backend.publishableKey;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: {
    fetch: (input, init) => {
      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
      // Opaque publishable keys are API keys, not user bearer tokens.
      if (headers.get("Authorization") === `Bearer ${SUPABASE_PUBLISHABLE_KEY}`) {
        headers.delete("Authorization");
      }
      headers.set("apikey", SUPABASE_PUBLISHABLE_KEY);
      return fetch(input, { ...init, headers });
    },
  },
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: typeof window !== "undefined",
  },
});

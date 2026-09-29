/**
 * Browser-safe Supabase client for the canonical external project
 * (ref lqthjvzjkbwtggrhgpts). Uses the publishable key only; RLS applies.
 * Never import a service-role/secret key into this module.
 */
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] as string;
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: typeof window !== "undefined",
  },
});

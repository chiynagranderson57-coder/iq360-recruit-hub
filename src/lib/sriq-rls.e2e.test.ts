/**
 * SRIQ-26 end-to-end RLS evidence against lqthjvzjkbwtggrhgpts.
 * Synthetic accounts only. Skipped unless all env vars below are set:
 *   SRIQ_E2E_ATHLETE_A_EMAIL / _PASSWORD, SRIQ_E2E_ATHLETE_A_ID
 *   SRIQ_E2E_ATHLETE_B_ID
 *   SRIQ_E2E_GUARDIAN_ACTIVE_EMAIL / _PASSWORD
 *   SRIQ_E2E_GUARDIAN_REVOKED_EMAIL / _PASSWORD
 * Read-only: signs in with the publishable key and SELECTs; never writes.
 */
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const env = (k: string) => process.env[k] ?? "";
const URL = env("VITE_SUPABASE_URL") || "https://lqthjvzjkbwtggrhgpts.supabase.co";
const KEY = env("VITE_SUPABASE_PUBLISHABLE_KEY");
const REQUIRED = [
  "SRIQ_E2E_ATHLETE_A_EMAIL",
  "SRIQ_E2E_ATHLETE_A_PASSWORD",
  "SRIQ_E2E_ATHLETE_A_ID",
  "SRIQ_E2E_ATHLETE_B_ID",
  "SRIQ_E2E_GUARDIAN_ACTIVE_EMAIL",
  "SRIQ_E2E_GUARDIAN_ACTIVE_PASSWORD",
  "SRIQ_E2E_GUARDIAN_REVOKED_EMAIL",
  "SRIQ_E2E_GUARDIAN_REVOKED_PASSWORD",
];
const ready = !!KEY && REQUIRED.every((k) => env(k));

async function visibleAthletes(email: string, password: string, athleteId: string) {
  const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInErr } = await sb.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  const { data, error } = await sb.from("athletes").select("id").eq("id", athleteId);
  await sb.auth.signOut();
  if (error) throw error;
  return data ?? [];
}

describe.skipIf(!ready)("SRIQ-26 RLS end-to-end (synthetic users)", () => {
  const A = env("SRIQ_E2E_ATHLETE_A_ID");
  const B = env("SRIQ_E2E_ATHLETE_B_ID");

  it("athlete can read own record", async () => {
    const rows = await visibleAthletes(
      env("SRIQ_E2E_ATHLETE_A_EMAIL"),
      env("SRIQ_E2E_ATHLETE_A_PASSWORD"),
      A,
    );
    expect(rows).toHaveLength(1);
  });

  it("athlete cannot read another athlete record", async () => {
    const rows = await visibleAthletes(
      env("SRIQ_E2E_ATHLETE_A_EMAIL"),
      env("SRIQ_E2E_ATHLETE_A_PASSWORD"),
      B,
    );
    expect(rows).toHaveLength(0);
  });

  it("active guardian can read linked athlete", async () => {
    const rows = await visibleAthletes(
      env("SRIQ_E2E_GUARDIAN_ACTIVE_EMAIL"),
      env("SRIQ_E2E_GUARDIAN_ACTIVE_PASSWORD"),
      A,
    );
    expect(rows).toHaveLength(1);
  });

  it("revoked guardian cannot read linked athlete", async () => {
    const rows = await visibleAthletes(
      env("SRIQ_E2E_GUARDIAN_REVOKED_EMAIL"),
      env("SRIQ_E2E_GUARDIAN_REVOKED_PASSWORD"),
      A,
    );
    expect(rows).toHaveLength(0);
  });
});

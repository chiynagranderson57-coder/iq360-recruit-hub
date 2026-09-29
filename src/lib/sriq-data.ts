/**
 * SRIQ-26 vertical slice data access against the canonical external project.
 *
 * All reads use the publishable-key client with the signed-in user's session,
 * so Postgres RLS (private.has_athlete_access + scoped SELECT policies from
 * migration sriq26_guardian_consent_readiness_rls) is the authoritative
 * boundary. The pure helpers below mirror those expectations for app-level
 * decisions and tests; they never widen access beyond what RLS returns.
 */
import type { AudienceRole } from "./capabilities";
import type { Principal } from "./authorization";

export interface AthleteAccessRow {
  athlete_id: string;
  user_id: string;
  access_role: string;
  status: string;
}

export interface GuardianConsentRow {
  id: string;
  athlete_id: string;
  guardian_user_id: string;
  status: string;
  granted_at: string | null;
  revoked_at: string | null;
}

export interface AthleteRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  sport: string | null;
  graduation_year: number | null;
  status: string | null;
}

export interface ReadinessRow {
  id: string;
  athlete_id: string;
  readiness_score: number | null;
  updated_at: string | null;
}

export type ConsentState = "active" | "revoked" | "inactive";

export function consentState(row: Pick<GuardianConsentRow, "status" | "revoked_at">): ConsentState {
  if (row.revoked_at || row.status === "revoked") return "revoked";
  if (row.status === "active") return "active";
  return "inactive";
}

const ROLE_MAP: Record<string, AudienceRole> = {
  athlete: "athlete",
  parent_guardian: "guardian",
};

/**
 * Builds a Principal from the caller's own access and consent rows. Unknown
 * roles and inactive links contribute nothing (deny-by-default).
 */
export function buildPrincipal(
  userId: string,
  accessRows: AthleteAccessRow[],
  consentRows: GuardianConsentRow[],
): Principal | null {
  const active = accessRows.filter(
    (r) => r.user_id === userId && r.status === "active" && ROLE_MAP[r.access_role],
  );
  const role = active[0] ? ROLE_MAP[active[0].access_role] : undefined;
  if (!role) return null;
  const linked = active.filter((r) => ROLE_MAP[r.access_role] === role).map((r) => r.athlete_id);
  const consented = consentRows
    .filter((c) => c.guardian_user_id === userId && consentState(c) === "active")
    .map((c) => c.athlete_id);
  return {
    userId,
    role,
    linkedAthleteIds: linked,
    isMinorContext: false,
    activeConsentAthleteIds: consented,
  };
}

async function client() {
  const { supabase } = await import("./supabase");
  return supabase;
}

export async function fetchMyAccess(userId: string): Promise<AthleteAccessRow[]> {
  const sb = await client();
  const { data, error } = await sb
    .from("athlete_access")
    .select("athlete_id, user_id, access_role, status")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []) as AthleteAccessRow[];
}

export async function fetchAthletes(ids: string[]): Promise<AthleteRow[]> {
  if (ids.length === 0) return [];
  const sb = await client();
  const { data, error } = await sb
    .from("athletes")
    .select("id, first_name, last_name, sport, graduation_year, status")
    .in("id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []) as AthleteRow[];
}

export async function fetchConsents(): Promise<GuardianConsentRow[]> {
  const sb = await client();
  const { data, error } = await sb
    .from("guardian_consents")
    .select("id, athlete_id, guardian_user_id, status, granted_at, revoked_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as GuardianConsentRow[];
}

export async function fetchReadiness(ids: string[]): Promise<ReadinessRow[]> {
  if (ids.length === 0) return [];
  const sb = await client();
  const { data, error } = await sb
    .from("athlete_readiness")
    .select("id, athlete_id, readiness_score, updated_at")
    .in("athlete_id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []) as ReadinessRow[];
}

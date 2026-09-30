/**
 * Environment model. Maps the configured Supabase URL to a known backend and
 * checks it against the declared VITE_APP_ENV so staging can never silently
 * point at production (or vice versa). Contains public project refs only.
 */
export const SUPABASE_REFS = {
  production: "lqthjvzjkbwtggrhgpts",
  staging: "kpatqovdotkkgvpvgccg",
} as const;

export type AppEnvironment = keyof typeof SUPABASE_REFS | "development";

export function supabaseRefFromUrl(url: string | undefined): string | null {
  const m = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(url ?? "");
  return m?.[1] ?? null;
}

export type EnvironmentCheck =
  | { ok: true; declared: AppEnvironment; ref: string; backend: keyof typeof SUPABASE_REFS }
  | { ok: false; declared: AppEnvironment; ref: string | null; reason: string };

/**
 * Declared env defaults to "development" (which is allowed to use either
 * backend, matching today's production-backed preview). "staging" and
 * "production" must match their exact ref.
 */
export function checkEnvironment(
  env: Record<string, string | boolean | undefined> = import.meta.env ?? {},
): EnvironmentCheck {
  const rawDeclared = String(env["VITE_APP_ENV"] ?? "") || "development";
  const ref = supabaseRefFromUrl(env["VITE_SUPABASE_URL"] as string | undefined);
  if (!["development", "staging", "production"].includes(rawDeclared)) {
    return { ok: false, declared: "development", ref, reason: `unknown_app_env:${rawDeclared}` };
  }
  const declared = rawDeclared as AppEnvironment;
  const backend = (Object.keys(SUPABASE_REFS) as (keyof typeof SUPABASE_REFS)[]).find(
    (k) => SUPABASE_REFS[k] === ref,
  );
  if (!ref || !backend) return { ok: false, declared, ref, reason: "unknown_supabase_project" };
  if (declared !== "development" && declared !== backend) {
    return { ok: false, declared, ref, reason: `env_backend_mismatch:${declared}->${backend}` };
  }
  return { ok: true, declared, ref, backend };
}

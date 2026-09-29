/**
 * Typed feature-flag registry. Every flag defaults OFF (conservative).
 * A flag can be enabled per environment only via a public VITE_FLAG_<NAME>=true
 * value; flags must never gate authorization (that stays in authorization.ts).
 */
export const FEATURE_FLAGS = {
  athlete_slice: {
    description: "SRIQ-26 athlete/guardian/readiness read-only panels.",
    default: false,
  },
  ask_navaria_live: {
    description: "Live AI answers in AskNavaria360 (not approved yet).",
    default: false,
  },
  agent_integrations: {
    description: "MCP agent integrations (blocked on Supabase OAuth server).",
    default: false,
  },
} as const satisfies Record<string, { description: string; default: boolean }>;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

type EnvSource = Record<string, string | boolean | undefined>;

export function isFlagEnabled(flag: FeatureFlag, env: EnvSource = import.meta.env ?? {}): boolean {
  const raw = env[`VITE_FLAG_${flag.toUpperCase()}`];
  if (raw === true || raw === "true") return true;
  if (raw === false || raw === "false") return false;
  return FEATURE_FLAGS[flag].default;
}

/**
 * Deny-by-default authorization model for SRIQ360.
 *
 * These are pure, dependency-free policy helpers so the same rules can be
 * enforced inside server functions once the external Supabase project is bound.
 * UI may call them to hide surfaces, but the authoritative check MUST run
 * server-side on every read and write.
 */

import type { AudienceRole } from "./capabilities";

export interface Principal {
  /** Authenticated subject id (Supabase auth user id). */
  userId: string;
  role: AudienceRole;
  /** Athlete records this principal is linked to. Empty means none. */
  linkedAthleteIds: string[];
  /** True when the subject athlete is a minor and requires guardian consent. */
  isMinorContext: boolean;
  /** Active, non-revoked consent grants keyed by athlete id. */
  activeConsentAthleteIds: string[];
}

export interface AccessRequest {
  athleteId: string;
  action: "read" | "write" | "export";
  /** Capability key from the registry. */
  capability: string;
}

export type AccessDecision =
  | { allowed: true; reason: string }
  | { allowed: false; reason: string };

const deny = (reason: string): AccessDecision => ({ allowed: false, reason });
const allow = (reason: string): AccessDecision => ({ allowed: true, reason });

/**
 * Single choke point for athlete-scoped access. Defaults to deny; every
 * allowance must be explicit. No cross-athlete access is ever granted.
 */
export function decideAthleteAccess(
  principal: Principal | null,
  request: AccessRequest,
): AccessDecision {
  if (!principal) return deny("unauthenticated");

  if (!principal.linkedAthleteIds.includes(request.athleteId)) {
    return deny("principal_not_linked_to_athlete");
  }

  if (principal.role === "athlete") {
    if (principal.isMinorContext && !principal.activeConsentAthleteIds.includes(request.athleteId)) {
      return deny("minor_requires_active_guardian_consent");
    }
    return allow("athlete_owns_record");
  }

  if (principal.role === "guardian") {
    if (!principal.activeConsentAthleteIds.includes(request.athleteId)) {
      return deny("guardian_consent_absent_or_revoked");
    }
    return allow("guardian_with_active_consent");
  }

  if (principal.role === "bfm_ops") {
    if (request.action === "export") return deny("ops_export_requires_explicit_approval");
    return allow("bfm_ops_assigned_support_scope");
  }

  return deny("no_matching_policy");
}

/** Audit event shape written for every sensitive read, write, and consent change. */
export interface AuditEvent {
  actorUserId: string | null;
  actorRole: AudienceRole | "anonymous";
  athleteId: string | null;
  capability: string;
  action: AccessRequest["action"] | "consent_grant" | "consent_revoke" | "auth" | "help_request";
  decision: "allowed" | "denied";
  reason: string;
  occurredAt: string;
}

export function buildAuditEvent(
  principal: Principal | null,
  request: AccessRequest,
  decision: AccessDecision,
): AuditEvent {
  return {
    actorUserId: principal?.userId ?? null,
    actorRole: principal?.role ?? "anonymous",
    athleteId: request.athleteId,
    capability: request.capability,
    action: request.action,
    decision: decision.allowed ? "allowed" : "denied",
    reason: decision.reason,
    occurredAt: new Date().toISOString(),
  };
}

/** Standard disclosure appended to any AI-assisted output. */
export const AI_UNCERTAINTY_DISCLOSURE =
  "AskNavaria360 provides general guidance only. It can be incomplete or out of date, it does not predict recruiting outcomes, and it never represents an offer or commitment. Confirm details with BFM staff or the official source.";

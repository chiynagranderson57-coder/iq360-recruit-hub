/**
 * Approved SRIQ360 capability registry (locked November 4, 2026 software scope).
 *
 * This is the single source of truth for product structure. Features are added
 * here first, then implemented behind the same key. Nothing outside this list
 * is in scope.
 */

export type CapabilityStatus = "scaffolded" | "planned";

export type AudienceRole = "athlete" | "guardian" | "bfm_ops";

export interface Capability {
  key: string;
  /** App route that owns this capability. */
  path: string;
  name: string;
  summary: string;
  /** Roles that may see the surface at all. Server-side checks still decide access. */
  audiences: AudienceRole[];
  status: CapabilityStatus;
}

export const CAPABILITIES: Capability[] = [
  {
    key: "identity_intake",
    path: "/intake",
    name: "Identity & Guided Intake",
    summary:
      "Step-by-step onboarding that establishes who the athlete is, age band, sport, and guardian requirement.",
    audiences: ["athlete", "guardian", "bfm_ops"],
    status: "scaffolded",
  },
  {
    key: "athlete_intelligence_record",
    path: "/record",
    name: "Athlete Intelligence Record",
    summary:
      "The durable, permission-scoped record of verified athlete information. No inferred or fabricated recruiting claims.",
    audiences: ["athlete", "guardian", "bfm_ops"],
    status: "scaffolded",
  },
  {
    key: "guardian_consent",
    path: "/guardian",
    name: "Guardian & Consent",
    summary:
      "Guardian linkage, consent capture, scope of delegated access, and revocation with immediate effect.",
    audiences: ["guardian", "bfm_ops"],
    status: "scaffolded",
  },
  {
    key: "readiness_snapshot",
    path: "/readiness",
    name: "Readiness Snapshot",
    summary:
      "A point-in-time view of recruiting readiness derived only from information the athlete supplied or that was verified.",
    audiences: ["athlete", "guardian", "bfm_ops"],
    status: "scaffolded",
  },
  {
    key: "my_plan",
    path: "/plan",
    name: "My Plan & Next Best Action",
    summary:
      "Prioritized actions with reasons, plus returning-user continuity so an athlete resumes exactly where they left off.",
    audiences: ["athlete", "guardian", "bfm_ops"],
    status: "scaffolded",
  },
  {
    key: "curated_discovery",
    path: "/discovery",
    name: "Curated Discovery",
    summary:
      "Opportunity discovery limited to curated, attributable sources. No implied offers or guaranteed outcomes.",
    audiences: ["athlete", "guardian", "bfm_ops"],
    status: "scaffolded",
  },
  {
    key: "opportunity_comparison",
    path: "/compare",
    name: "Opportunity Comparison",
    summary: "Side-by-side comparison of saved opportunities on consistent, factual criteria.",
    audiences: ["athlete", "guardian", "bfm_ops"],
    status: "scaffolded",
  },
  {
    key: "ask_navaria360",
    path: "/ask",
    name: "AskNavaria360",
    summary:
      "Guided assistant for recruiting questions. Always discloses uncertainty and never asserts recruiting outcomes.",
    audiences: ["athlete", "guardian", "bfm_ops"],
    status: "scaffolded",
  },
  {
    key: "resource_library",
    path: "/library",
    name: "Resource & Pathway Library",
    summary: "Educational pathways and reference material, versioned and attributable.",
    audiences: ["athlete", "guardian", "bfm_ops"],
    status: "scaffolded",
  },
  {
    key: "human_help",
    path: "/help",
    name: "Human Help Request",
    summary: "Escalation to BFM operations staff with an auditable request trail.",
    audiences: ["athlete", "guardian", "bfm_ops"],
    status: "scaffolded",
  },
  {
    key: "returning_continuity",
    path: "/plan",
    name: "Returning-User Continuity",
    summary:
      "Persistent progress state so intake, plan, and saved opportunities survive across sessions and devices.",
    audiences: ["athlete", "guardian", "bfm_ops"],
    status: "planned",
  },
];

export const NAV_CAPABILITIES = CAPABILITIES.filter(
  (capability, index, all) => all.findIndex((c) => c.path === capability.path) === index,
);

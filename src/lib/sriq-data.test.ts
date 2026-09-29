import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { decideAthleteAccess } from "./authorization";
import { buildPrincipal, consentState, type AthleteAccessRow, type GuardianConsentRow } from "./sriq-data";

// Synthetic, in-memory fixtures only. No production users or rows.
const ATHLETE_A = "athlete-a";
const ATHLETE_B = "athlete-b";
const USER_A = "user-athlete-a";
const GUARDIAN_OK = "user-guardian-active";
const GUARDIAN_REVOKED = "user-guardian-revoked";

const access: AthleteAccessRow[] = [
  { athlete_id: ATHLETE_A, user_id: USER_A, access_role: "athlete", status: "active" },
  { athlete_id: ATHLETE_A, user_id: GUARDIAN_OK, access_role: "parent_guardian", status: "active" },
  { athlete_id: ATHLETE_A, user_id: GUARDIAN_REVOKED, access_role: "parent_guardian", status: "active" },
];

const consents: GuardianConsentRow[] = [
  {
    id: "c1",
    athlete_id: ATHLETE_A,
    guardian_user_id: GUARDIAN_OK,
    status: "active",
    granted_at: "2026-09-01T00:00:00Z",
    revoked_at: null,
  },
  {
    id: "c2",
    athlete_id: ATHLETE_A,
    guardian_user_id: GUARDIAN_REVOKED,
    status: "revoked",
    granted_at: "2026-09-01T00:00:00Z",
    revoked_at: "2026-09-20T00:00:00Z",
  },
];

const read = (athleteId: string) => ({ athleteId, action: "read" as const, capability: "readiness_snapshot" });

describe("SRIQ-26 authorization expectations", () => {
  it("allows authorized athlete self-access", () => {
    const p = buildPrincipal(USER_A, access, consents);
    expect(decideAthleteAccess(p, read(ATHLETE_A)).allowed).toBe(true);
  });

  it("allows guardian with active consent", () => {
    const p = buildPrincipal(GUARDIAN_OK, access, consents);
    expect(decideAthleteAccess(p, read(ATHLETE_A))).toEqual({
      allowed: true,
      reason: "guardian_with_active_consent",
    });
  });

  it("denies cross-athlete access (Athlete A cannot read Athlete B)", () => {
    const p = buildPrincipal(USER_A, access, consents);
    expect(decideAthleteAccess(p, read(ATHLETE_B))).toEqual({
      allowed: false,
      reason: "principal_not_linked_to_athlete",
    });
  });

  it("denies revoked guardian even with a remaining access link", () => {
    const p = buildPrincipal(GUARDIAN_REVOKED, access, consents);
    expect(decideAthleteAccess(p, read(ATHLETE_A))).toEqual({
      allowed: false,
      reason: "guardian_consent_absent_or_revoked",
    });
  });

  it("treats revoked_at as revoked regardless of status", () => {
    expect(consentState({ status: "active", revoked_at: "2026-09-20T00:00:00Z" })).toBe("revoked");
    expect(consentState({ status: "pending", revoked_at: null })).toBe("inactive");
  });

  it("denies unauthenticated and unknown roles", () => {
    expect(decideAthleteAccess(null, read(ATHLETE_A)).allowed).toBe(false);
    const staff = buildPrincipal("x", [{ athlete_id: ATHLETE_A, user_id: "x", access_role: "unknown", status: "active" }], []);
    expect(staff).toBeNull();
  });
});

describe("client secret hygiene", () => {
  it("no service-role or secret key appears in src/ or .env", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts")) files.push(p);
      }
    };
    walk("src");
    files.push(".env");
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      expect(text, f).not.toMatch(/sb_secret_|SERVICE_ROLE/);
    }
  });
});

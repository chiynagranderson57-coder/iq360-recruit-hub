import { describe, expect, it } from "vitest";

import { checkEnvironment, SUPABASE_REFS } from "./environment";

const url = (ref: string) => `https://${ref}.supabase.co`;

describe("environment model", () => {
  it("production must use the production ref", () => {
    expect(
      checkEnvironment({
        VITE_APP_ENV: "production",
        VITE_SUPABASE_URL: url(SUPABASE_REFS.production),
      }),
    ).toMatchObject({ ok: true, backend: "production" });
    expect(
      checkEnvironment({
        VITE_APP_ENV: "production",
        VITE_SUPABASE_URL: url(SUPABASE_REFS.staging),
      }),
    ).toMatchObject({ ok: false, reason: "env_backend_mismatch:production->staging" });
  });
  it("staging must use the staging ref", () => {
    expect(
      checkEnvironment({ VITE_APP_ENV: "staging", VITE_SUPABASE_URL: url(SUPABASE_REFS.staging) }),
    ).toMatchObject({ ok: true, backend: "staging" });
    expect(
      checkEnvironment({
        VITE_APP_ENV: "staging",
        VITE_SUPABASE_URL: url(SUPABASE_REFS.production),
      }),
    ).toMatchObject({ ok: false });
  });
  it("defaults to development and rejects unknown projects", () => {
    expect(checkEnvironment({ VITE_SUPABASE_URL: url(SUPABASE_REFS.production) })).toMatchObject({
      ok: true,
      declared: "development",
    });
    expect(checkEnvironment({ VITE_SUPABASE_URL: url("a".repeat(20)) })).toMatchObject({
      ok: false,
      reason: "unknown_supabase_project",
    });
  });
});

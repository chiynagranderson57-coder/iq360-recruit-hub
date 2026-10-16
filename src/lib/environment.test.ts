import { describe, expect, it } from "vitest";

import { checkEnvironment, resolveAppBackend, SUPABASE_REFS } from "./environment";

const url = (ref: string) => `https://${ref}.supabase.co`;

describe("environment model", () => {
  it("keeps canonical athlete data on the original backend when Cloud manages env", () => {
    expect(
      resolveAppBackend({
        VITE_SUPABASE_URL: url("lawauyvwyqvprtzrejbl"),
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_cloud",
      }),
    ).toMatchObject({
      url: "https://lqthjvzjkbwtggrhgpts.supabase.co",
      publishableKey: "sb_publishable_zsjgiZnFjRizHmBKTe71yA_e8egvFnj",
    });
  });
  it("preserves explicit staging and never silently routes staging to production", () => {
    expect(
      resolveAppBackend({
        VITE_APP_ENV: "staging",
        VITE_SUPABASE_URL: url(SUPABASE_REFS.staging),
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_staging",
      }).url,
    ).toBe("https://kpatqovdotkkgvpvgccg.supabase.co");
    expect(() =>
      resolveAppBackend({
        VITE_APP_ENV: "staging",
        VITE_SUPABASE_URL: url("lawauyvwyqvprtzrejbl"),
      }),
    ).toThrow("env_backend_mismatch:staging->production");
  });
  it("rejects privileged keys", () => {
    expect(() =>
      resolveAppBackend({
        VITE_SUPABASE_URL: url(SUPABASE_REFS.production),
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_forbidden",
      }),
    ).toThrow("requires a public publishable key");
  });
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

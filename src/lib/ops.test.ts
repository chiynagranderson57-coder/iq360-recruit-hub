import { describe, expect, it } from "vitest";

import { FEATURE_FLAGS, isFlagEnabled, type FeatureFlag } from "./feature-flags";
import { createLogger, REDACTED, redact } from "./logger";

describe("feature flags", () => {
  it("every flag defaults off", () => {
    for (const f of Object.keys(FEATURE_FLAGS) as FeatureFlag[]) {
      expect(isFlagEnabled(f, {})).toBe(false);
    }
  });
  it("enables only on explicit 'true'", () => {
    expect(isFlagEnabled("athlete_slice", { VITE_FLAG_ATHLETE_SLICE: "true" })).toBe(true);
    expect(isFlagEnabled("athlete_slice", { VITE_FLAG_ATHLETE_SLICE: "yes" })).toBe(false);
  });
});

describe("logger", () => {
  it("redacts sensitive keys and secret-looking values", () => {
    expect(redact({ email: "a@b.c", password: "x", nested: { access_token: "t" }, ok: 1 })).toEqual({
      email: REDACTED,
      password: REDACTED,
      nested: { access_token: REDACTED },
      ok: 1,
    });
    expect(redact("sb_secret_abc")).toBe(REDACTED);
  });
  it("emits one JSON line with scope and event", () => {
    const lines: string[] = [];
    createLogger("test", (_l, line) => lines.push(line)).error("boom", { email: "x@y.z" });
    const rec = JSON.parse(lines[0] ?? "{}");
    expect(rec).toMatchObject({ level: "error", scope: "test", event: "boom", email: REDACTED });
  });
});

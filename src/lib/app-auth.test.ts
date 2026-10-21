import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appSessionHeaders, verifyAppBearerToken } from "./app-auth";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getClaims: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock("./supabase", () => ({ supabase: { auth: { getSession: mocks.getSession } } }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

const productionUrl = "https://lqthjvzjkbwtggrhgpts.supabase.co";
const cloudUrl = "https://lawauyvwyqvprtzrejbl.supabase.co";
const env = {
  VITE_SUPABASE_URL: cloudUrl,
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_cloud",
  SUPABASE_URL: cloudUrl,
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_cloud",
};
const token = "synthetic.payload.signature";
const headers = new Headers({ Authorization: `Bearer ${token}` });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createClient.mockReturnValue({ auth: { getClaims: mocks.getClaims } });
  mocks.getClaims.mockResolvedValue({
    data: { claims: { sub: "synthetic-user", iss: `${productionUrl}/auth/v1` } },
    error: null,
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("canonical app authentication (mocked, no live accounts)", () => {
  it("attaches the original browser login session token", async () => {
    vi.stubGlobal("window", {});
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: token } } });
    expect(await appSessionHeaders()).toEqual({ Authorization: `Bearer ${token}` });
    expect(mocks.getSession).toHaveBeenCalledOnce();
  });

  it("does not read browser session storage during SSR", async () => {
    vi.stubGlobal("window", undefined);
    expect(await appSessionHeaders()).toEqual({});
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("attaches no bearer when signed out", async () => {
    vi.stubGlobal("window", {});
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    expect(await appSessionHeaders()).toEqual({});
  });

  it("verifies with original production config and scopes RLS to the supplied user bearer", async () => {
    const context = await verifyAppBearerToken(headers, env);
    expect(context.userId).toBe("synthetic-user");
    expect(mocks.getClaims).toHaveBeenCalledWith(token);
    expect(mocks.createClient).toHaveBeenCalledWith(
      productionUrl,
      "sb_publishable_zsjgiZnFjRizHmBKTe71yA_e8egvFnj",
      expect.objectContaining({
        global: expect.objectContaining({ headers: { Authorization: `Bearer ${token}` } }),
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      }),
    );
  });

  it.each(["", "Basic synthetic", "Bearer ", "Bearer invalid"])(
    "rejects absent or malformed bearer %s without contacting auth",
    async (authorization) => {
      await expect(
        verifyAppBearerToken(new Headers({ authorization }), env),
      ).rejects.toThrow("Unauthorized");
      expect(mocks.createClient).not.toHaveBeenCalled();
    },
  );

  it("rejects a failed signature verification", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: { message: "invalid signature" } });
    await expect(verifyAppBearerToken(headers, env)).rejects.toThrow("Invalid token");
  });

  it("rejects managed Cloud token issuers even if claims are returned", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: "synthetic-user", iss: `${cloudUrl}/auth/v1` } },
      error: null,
    });
    await expect(verifyAppBearerToken(headers, env)).rejects.toThrow("Invalid token issuer");
  });

  it("rejects verified claims without a user ID", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { iss: `${productionUrl}/auth/v1` } },
      error: null,
    });
    await expect(verifyAppBearerToken(headers, env)).rejects.toThrow("No user ID");
  });

  it("sends the public key as apikey, never as a bearer, preserving the user bearer", async () => {
    await verifyAppBearerToken(headers, env);
    const options = mocks.createClient.mock.calls[0]?.[2];
    const fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetchMock);
    const key = "sb_publishable_zsjgiZnFjRizHmBKTe71yA_e8egvFnj";
    await options.global.fetch(productionUrl, { headers: { Authorization: `Bearer ${key}` } });
    expect(fetchMock.mock.calls[0]?.[1].headers.get("Authorization")).toBeNull();
    expect(fetchMock.mock.calls[0]?.[1].headers.get("apikey")).toBe(key);
    await options.global.fetch(productionUrl, { headers: { Authorization: `Bearer ${token}` } });
    expect(fetchMock.mock.calls[1]?.[1].headers.get("Authorization")).toBe(`Bearer ${token}`);
  });
});
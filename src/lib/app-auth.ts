import { createClient } from "@supabase/supabase-js";
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { resolveAppBackend } from "./environment";

/** Uses exactly the session used by the app's browser sign-in; SSR has no browser session. */
export async function appSessionHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  const { supabase } = await import("./supabase");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Called only by the server middleware. No admin client or managed Cloud configuration. */
export async function verifyAppBearerToken(
  headers: Headers,
  env: Record<string, string | boolean | undefined> = import.meta.env,
) {
  const authHeader = headers.get("authorization");
  if (!authHeader) throw new Error("Unauthorized: No authorization header provided");
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Only Bearer tokens are supported");
  }
  const token = authHeader.slice("Bearer ".length);
  if (!token) throw new Error("Unauthorized: No token provided");
  if (token.split(".").length !== 3) throw new Error("Unauthorized: Invalid token");

  // Same resolver and build-time public settings as src/lib/supabase.ts. Never
  // fall back to the managed Cloud runtime URL/key, which belong to another issuer.
  const backend = resolveAppBackend(env);
  const supabase = createClient(backend.url, backend.publishableKey, {
    global: {
      fetch: (input, init) => {
        const requestHeaders = new Headers(input instanceof Request ? input.headers : undefined);
        new Headers(init?.headers).forEach((value, key) => requestHeaders.set(key, value));
        if (requestHeaders.get("Authorization") === `Bearer ${backend.publishableKey}`) {
          requestHeaders.delete("Authorization");
        }
        requestHeaders.set("apikey", backend.publishableKey);
        return fetch(input, { ...init, headers: requestHeaders });
      },
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  // getClaims verifies the JWT, not just its shape. Pin the issuer as well so
  // even a differently signed project token cannot become an app principal.
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("Unauthorized: Invalid token");
  if (data.claims.iss !== `${backend.url}/auth/v1`) {
    throw new Error("Unauthorized: Invalid token issuer");
  }
  if (!data.claims.sub) throw new Error("Unauthorized: No user ID found in token");
  return { supabase, userId: data.claims.sub, claims: data.claims };
}

export const attachAppAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  return next({ headers: await appSessionHeaders() });
});

/** Apply to protected server functions only; public SSR must remain unauthenticated. */
export const requireAppAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  if (!request?.headers) throw new Error("Unauthorized: No request headers available");
  return next({ context: await verifyAppBearerToken(request.headers) });
});
import type { QueryClient } from "@tanstack/react-query";

const cacheOwners = new WeakMap<QueryClient, string | null>();

/** Clear private data and cancel old requests before publishing a different session. */
export function synchronizeSessionCache(client: QueryClient, userId: string | null) {
  if (!cacheOwners.has(client) || cacheOwners.get(client) !== userId) {
    client.clear();
    cacheOwners.set(client, userId);
  }
}

export const accountQueryKeys = {
  access: (userId: string | undefined) => ["athlete_access", userId] as const,
  athletes: (userId: string, ids: string[]) => ["athletes", userId, ids] as const,
  consents: (userId: string) => ["guardian_consents", userId] as const,
  readiness: (userId: string, ids: string[]) => ["athlete_readiness", userId, ids] as const,
};

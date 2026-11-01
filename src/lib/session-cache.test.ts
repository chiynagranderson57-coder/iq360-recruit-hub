import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { accountQueryKeys, synchronizeSessionCache } from "./session-cache";

describe("account cache privacy", () => {
  it("never gives another account cached records while its request is pending", () => {
    const client = new QueryClient();
    const ids = ["shared-athlete"];
    const keys = (user: string) => [
      accountQueryKeys.access(user),
      accountQueryKeys.athletes(user, ids),
      accountQueryKeys.consents(user),
      accountQueryKeys.readiness(user, ids),
    ];
    for (const key of keys("account-A")) client.setQueryData(key, ["private-A"]);
    for (const key of keys("account-B")) {
      const observer = new QueryObserver(client, { queryKey: key, enabled: false });
      expect(observer.getCurrentResult().data).toBeUndefined();
      observer.destroy();
    }
    client.clear();
  });

  it("clears private queries and mutations on sign-out and direct account changes", () => {
    const client = new QueryClient();
    synchronizeSessionCache(client, "account-A");
    client.setQueryData(accountQueryKeys.consents("account-A"), ["private-A"]);
    client.getMutationCache().build(client, { mutationKey: ["private-A"] });
    synchronizeSessionCache(client, null);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    synchronizeSessionCache(client, "account-A");
    client.setQueryData(accountQueryKeys.consents("account-A"), ["private-A"]);
    synchronizeSessionCache(client, "account-B");
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it("preserves same-account data during token refresh and repeated subscriptions", () => {
    const client = new QueryClient();
    synchronizeSessionCache(client, "account-A");
    const key = accountQueryKeys.consents("account-A");
    client.setQueryData(key, ["private-A"]);
    synchronizeSessionCache(client, "account-A");
    expect(client.getQueryData(key)).toEqual(["private-A"]);
    client.clear();
  });

  it("discards requests that finish after the account changes", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    synchronizeSessionCache(client, "account-A");
    let finish!: (value: string[]) => void;
    let signal!: AbortSignal;
    const pending = client.fetchQuery({
      queryKey: accountQueryKeys.consents("account-A"),
      queryFn: (context) => {
        signal = context.signal;
        return new Promise<string[]>((resolve) => (finish = resolve));
      },
    });
    const settled = pending.catch(() => undefined);
    synchronizeSessionCache(client, "account-B");
    expect(signal.aborted).toBe(true);
    finish(["late-private-A"]);
    await settled;
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it("keeps separate router caches independent", () => {
    const a = new QueryClient();
    const b = new QueryClient();
    synchronizeSessionCache(a, "account-A");
    synchronizeSessionCache(b, "account-B");
    const key = accountQueryKeys.consents("account-A");
    a.setQueryData(key, ["private-A"]);
    synchronizeSessionCache(b, null);
    expect(a.getQueryData(key)).toEqual(["private-A"]);
    a.clear();
  });
});

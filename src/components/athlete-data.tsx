import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/hooks/use-session";
import {
  consentState,
  fetchAthletes,
  fetchConsents,
  fetchMyAccess,
  fetchReadiness,
} from "@/lib/sriq-data";

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="mb-6 border-border bg-surface">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">{children}</CardContent>
    </Card>
  );
}

function useAccess() {
  const session = useSession();
  const userId = session?.user.id;
  const access = useQuery({
    queryKey: ["athlete_access", userId],
    queryFn: () => fetchMyAccess(userId!),
    enabled: !!userId,
  });
  return { session, userId, access };
}

function Gate({ title, children }: { title: string; children: (userId: string) => ReactNode }) {
  const { session, userId } = useAccess();
  if (session === undefined) return <Frame title={title}>Checking your session…</Frame>;
  if (!userId)
    return (
      <Frame title={title}>
        <p className="text-muted-foreground">Sign in to view records you are authorized to see.</p>
        <Link to="/auth" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </Frame>
    );
  return <>{children(userId)}</>;
}

function Empty() {
  return <p className="text-muted-foreground">No records are available to your account.</p>;
}

function Err({ e }: { e: unknown }) {
  return <p className="text-destructive">Access check failed: {(e as Error).message}</p>;
}

export function AthleteProfilePanel() {
  return <Gate title="Athlete profile">{(uid) => <AthleteProfileInner userId={uid} />}</Gate>;
}

function AthleteProfileInner({ userId }: { userId: string }) {
  const access = useQuery({
    queryKey: ["athlete_access", userId],
    queryFn: () => fetchMyAccess(userId),
  });
  const ids = (access.data ?? []).filter((r) => r.status === "active").map((r) => r.athlete_id);
  const athletes = useQuery({
    queryKey: ["athletes", ids],
    queryFn: () => fetchAthletes(ids),
    enabled: access.isSuccess,
  });
  return (
    <Frame title="Athlete profile">
      {access.error ? <Err e={access.error} /> : athletes.error ? <Err e={athletes.error} /> : null}
      {athletes.isSuccess && athletes.data.length === 0 ? <Empty /> : null}
      {athletes.data?.map((a) => (
        <div key={a.id} className="rounded-md border border-border p-3">
          <p className="font-medium">
            {[a.first_name, a.last_name].filter(Boolean).join(" ") || "Unnamed athlete"}
          </p>
          <p className="text-muted-foreground">
            {a.sport ?? "Sport not set"} · Class of {a.graduation_year ?? "—"}
          </p>
          <Badge variant="outline" className="mt-2">
            {access.data?.find((r) => r.athlete_id === a.id)?.access_role ?? "linked"}
          </Badge>
        </div>
      ))}
    </Frame>
  );
}

export function GuardianConsentPanel() {
  return <Gate title="Guardian consent">{() => <GuardianConsentInner />}</Gate>;
}

function GuardianConsentInner() {
  const consents = useQuery({ queryKey: ["guardian_consents"], queryFn: fetchConsents });
  return (
    <Frame title="Guardian consent">
      {consents.error ? <Err e={consents.error} /> : null}
      {consents.isSuccess && consents.data.length === 0 ? <Empty /> : null}
      {consents.data?.map((c) => {
        const state = consentState(c);
        return (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-md border border-border p-3"
          >
            <div>
              <p className="font-medium">Athlete {c.athlete_id.slice(0, 8)}</p>
              <p className="text-muted-foreground">
                {state === "revoked"
                  ? `Revoked ${c.revoked_at ? new Date(c.revoked_at).toLocaleDateString() : ""}`
                  : c.granted_at
                    ? `Granted ${new Date(c.granted_at).toLocaleDateString()}`
                    : "Not granted"}
              </p>
            </div>
            <Badge variant={state === "active" ? "secondary" : "outline"}>{state}</Badge>
          </div>
        );
      })}
    </Frame>
  );
}

export function ReadinessPanel() {
  return <Gate title="Readiness">{(uid) => <ReadinessInner userId={uid} />}</Gate>;
}

function ReadinessInner({ userId }: { userId: string }) {
  const access = useQuery({
    queryKey: ["athlete_access", userId],
    queryFn: () => fetchMyAccess(userId),
  });
  const ids = (access.data ?? []).filter((r) => r.status === "active").map((r) => r.athlete_id);
  const readiness = useQuery({
    queryKey: ["athlete_readiness", ids],
    queryFn: () => fetchReadiness(ids),
    enabled: access.isSuccess,
  });
  return (
    <Frame title="Readiness">
      {access.error ? (
        <Err e={access.error} />
      ) : readiness.error ? (
        <Err e={readiness.error} />
      ) : null}
      {readiness.isSuccess && readiness.data.length === 0 ? <Empty /> : null}
      {readiness.data?.map((r) => (
        <div key={r.id} className="rounded-md border border-border p-3">
          <p className="font-medium">Athlete {r.athlete_id.slice(0, 8)}</p>
          <p className="text-muted-foreground">
            Preparation score: {r.readiness_score ?? "not calculated"}
            {r.updated_at ? ` · updated ${new Date(r.updated_at).toLocaleDateString()}` : ""}
          </p>
        </div>
      ))}
    </Frame>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { GuardrailNote } from "@/components/scope-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CAPABILITIES } from "@/lib/capabilities";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sports Recruit IQ360™ — Athlete Intelligence Platform" },
      {
        name: "description",
        content:
          "Secure athlete intelligence platform for athletes, authorized guardians, and BFM operations staff.",
      },
      { property: "og:title", content: "Sports Recruit IQ360™ — Athlete Intelligence Platform" },
      {
        property: "og:description",
        content:
          "Guided intake, readiness, curated discovery, and permission-aware athlete records.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <AppShell
      eyebrow="Locked scope — November 4, 2026"
      title="Athlete intelligence, under the athlete's control"
      description="Sports Recruit IQ360 is the canonical BFM application for guided intake, readiness, and curated recruiting discovery. Every surface below is scoped, permission-aware, and free of recruiting guarantees."
    >
      <div className="space-y-10">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Athletes", body: "Own their record, plan, and saved opportunities." },
            { label: "Authorized guardians", body: "Act only within active, revocable consent." },
            { label: "BFM operations", body: "Support assigned athletes with a full audit trail." },
          ].map((audience) => (
            <Card key={audience.label} className="bg-surface">
              <CardHeader>
                <CardTitle className="text-base">{audience.label}</CardTitle>
                <CardDescription>{audience.body}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        <section>
          <h2 className="text-2xl font-semibold">Approved capabilities</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            The product structure is fixed to this list. Each capability has a route and will be
            implemented behind its own server-side authorization check.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {CAPABILITIES.map((capability) => (
              <Link key={capability.key} to={capability.path} className="group">
                <Card className="h-full bg-surface transition-colors group-hover:border-primary/60">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-base">{capability.name}</CardTitle>
                      <Badge variant={capability.status === "scaffolded" ? "secondary" : "outline"}>
                        {capability.status}
                      </Badge>
                    </div>
                    <CardDescription>{capability.summary}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Visible to: {capability.audiences.join(", ")}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <GuardrailNote>
          Foundation stage: no canonical athlete data is stored yet. Sign-in, persistent records,
          row-level authorization, private storage, and audit events activate once the external
          canonical database project is explicitly bound.
        </GuardrailNote>
      </div>
    </AppShell>
  );
}

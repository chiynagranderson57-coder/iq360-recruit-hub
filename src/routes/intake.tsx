import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { GuardrailNote, ScopePanel } from "@/components/scope-panel";

export const Route = createFileRoute("/intake")({
  head: () => ({
    meta: [
      { title: "Guided Intake — Sports Recruit IQ360™" },
      {
        name: "description",
        content:
          "Step-by-step athlete identity and guided intake with age-band and guardian requirements.",
      },
      { property: "og:title", content: "Guided Intake — Sports Recruit IQ360™" },
      {
        property: "og:description",
        content: "Establish athlete identity, sport, age band, and guardian requirements.",
      },
    ],
  }),
  component: IntakePage,
});

function IntakePage() {
  return (
    <AppShell
      eyebrow="Capability 01"
      title="Identity & guided intake"
      description="A short, resumable sequence that establishes who the athlete is and which protections apply before any record is created."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <ScopePanel
          title="Intake sequence"
          description="Each step saves independently so progress is never lost."
          items={[
            "Account identity confirmed through Supabase Auth before any athlete data is collected.",
            "Athlete profile basics: name, sport, position, graduation year, school.",
            "Age band determination that decides whether the guardian pathway is mandatory.",
            "Consent capture step for minors, blocking further intake until consent is active.",
            "Resume point written on every step for returning-user continuity.",
          ]}
        />
        <ScopePanel
          title="Rules this surface enforces"
          items={[
            "No athlete record is created for a minor without an active guardian consent grant.",
            "Intake writes are scoped to the authenticated athlete only; no cross-athlete writes.",
            "Every create and update emits an audit event with actor, action, and decision reason.",
            "Collected fields are limited to what the locked scope requires.",
          ]}
          footer={
            <GuardrailNote>
              Intake never asks for or infers recruiting interest from colleges. Only athlete-supplied
              or verified information enters the record.
            </GuardrailNote>
          }
        />
      </div>
    </AppShell>
  );
}

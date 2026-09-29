import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { GuardrailNote, ScopePanel } from "@/components/scope-panel";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "My Plan & Next Best Action — Sports Recruit IQ360™" },
      {
        name: "description",
        content:
          "Prioritized next actions with clear reasons, plus continuity so returning users resume instantly.",
      },
      { property: "og:title", content: "My Plan & Next Best Action — Sports Recruit IQ360™" },
      {
        property: "og:description",
        content: "One prioritized plan with reasons, progress, and a saved resume point.",
      },
    ],
  }),
  component: PlanPage,
});

function PlanPage() {
  return (
    <AppShell
      eyebrow="Capabilities 05 & 11"
      title="My plan & next best action"
      description="A short, ordered list of what to do next, why it matters, and where the athlete left off."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <ScopePanel
          title="Plan mechanics"
          items={[
            "Next Best Action is derived from readiness gaps and the athlete's stated goals.",
            "Every action states its reason and what completing it unlocks.",
            "Actions are completed, snoozed, or dismissed, and the plan recalculates.",
            "Guardians and ops staff may view the plan within their authorized scope.",
          ]}
        />
        <ScopePanel
          title="Returning-user continuity"
          items={[
            "A persistent resume point records the last meaningful step per athlete.",
            "Draft intake answers, saved opportunities, and comparisons survive sign-out.",
            "Continuity state is keyed to the athlete record, not the device or browser.",
            "Restoring a session re-runs authorization before any data is returned.",
          ]}
          footer={
            <GuardrailNote>
              Plan actions describe preparation steps only. They never claim that completing a step
              will produce recruiting interest or an offer.
            </GuardrailNote>
          }
        />
      </div>
    </AppShell>
  );
}

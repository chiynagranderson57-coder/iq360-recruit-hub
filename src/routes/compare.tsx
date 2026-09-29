import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { GuardrailNote, ScopePanel } from "@/components/scope-panel";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Opportunity Comparison — Sports Recruit IQ360™" },
      {
        name: "description",
        content:
          "Compare saved opportunities side by side on consistent, factual criteria before deciding.",
      },
      { property: "og:title", content: "Opportunity Comparison — Sports Recruit IQ360™" },
      {
        property: "og:description",
        content: "Side-by-side comparison of saved opportunities on the same factual criteria.",
      },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  return (
    <AppShell
      eyebrow="Capability 07"
      title="Opportunity comparison"
      description="Put saved opportunities beside each other on the same criteria so decisions are made on facts, not marketing."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <ScopePanel
          title="Comparison design"
          items={[
            "Compare saved opportunities across identical, factual columns.",
            "Missing data is shown as unknown rather than estimated or filled in.",
            "Athletes can add personal notes and a preference order.",
            "Comparisons are shareable only with linked guardians and assigned ops staff.",
          ]}
        />
        <ScopePanel
          title="Guardrails"
          items={[
            "No single best pick is declared on the athlete's behalf.",
            "No fit score that implies likelihood of being recruited.",
            "Cost and requirement fields link back to the original source.",
          ]}
          footer={
            <GuardrailNote>
              Comparison supports the athlete's own decision. The platform does not rank programs by
              predicted recruiting success.
            </GuardrailNote>
          }
        />
      </div>
    </AppShell>
  );
}

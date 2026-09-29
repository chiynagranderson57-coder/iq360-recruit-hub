import { createFileRoute } from "@tanstack/react-router";

import { ReadinessPanel } from "@/components/athlete-data";
import { AppShell } from "@/components/app-shell";
import { GuardrailNote, ScopePanel } from "@/components/scope-panel";

export const Route = createFileRoute("/readiness")({
  head: () => ({
    meta: [
      { title: "Readiness Snapshot — Sports Recruit IQ360™" },
      {
        name: "description",
        content:
          "A point-in-time readiness view built only from athlete-supplied or verified information.",
      },
      { property: "og:title", content: "Readiness Snapshot — Sports Recruit IQ360™" },
      {
        property: "og:description",
        content: "See what is complete, what is missing, and what to strengthen next.",
      },
    ],
  }),
  component: ReadinessPage,
});

function ReadinessPage() {
  return (
    <AppShell
      eyebrow="Capability 04"
      title="Readiness snapshot"
      description="A transparent completeness and preparation view, recalculated as the record changes and always explainable."
    >
      <ReadinessPanel />
      <div className="grid gap-4 lg:grid-cols-2">
        <ScopePanel
          title="What the snapshot shows"
          items={[
            "Completeness by record section, with the exact missing items named.",
            "Preparation signals limited to factual inputs the athlete supplied or that were verified.",
            "Change over time so progress is visible across sessions.",
            "A plain-language explanation for every element of the snapshot.",
          ]}
        />
        <ScopePanel
          title="What it will never do"
          items={[
            "No predicted scholarship level, division placement, or recruiting outcome.",
            "No comparison ranking against other athletes in the platform.",
            "No score presented without the inputs and reasoning behind it.",
          ]}
          footer={
            <GuardrailNote>
              A readiness snapshot measures preparation only. It is not an evaluation of athletic
              ability and carries no recruiting promise.
            </GuardrailNote>
          }
        />
      </div>
    </AppShell>
  );
}

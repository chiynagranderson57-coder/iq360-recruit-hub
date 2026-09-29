import { createFileRoute } from "@tanstack/react-router";

import { AthleteProfilePanel } from "@/components/athlete-data";
import { AppShell } from "@/components/app-shell";
import { GuardrailNote, ScopePanel } from "@/components/scope-panel";

export const Route = createFileRoute("/record")({
  head: () => ({
    meta: [
      { title: "Athlete Intelligence Record — Sports Recruit IQ360™" },
      {
        name: "description",
        content:
          "The durable, permission-scoped record of verified athlete information and supporting documents.",
      },
      { property: "og:title", content: "Athlete Intelligence Record — Sports Recruit IQ360™" },
      {
        property: "og:description",
        content:
          "Verified athlete information, documents, and provenance in one permissioned record.",
      },
    ],
  }),
  component: RecordPage,
});

function RecordPage() {
  return (
    <AppShell
      eyebrow="Capability 02"
      title="Athlete Intelligence Record"
      description="One durable record per athlete: identity, academics, athletic profile, media, and documents, each with provenance."
    >
      <AthleteProfilePanel />
      <div className="grid gap-4 lg:grid-cols-2">
        <ScopePanel
          title="Record sections"
          items={[
            "Identity and eligibility basics carried forward from intake.",
            "Academic profile with athlete-entered values and verification state.",
            "Athletic profile: measurables, team history, and competition history.",
            "Media and documents stored in private storage with time-limited signed access.",
            "Change history so every field shows who changed it and when.",
          ]}
        />
        <ScopePanel
          title="Access model"
          items={[
            "Row-level authorization restricts every row to the owning athlete's linkage graph.",
            "Guardians read and edit only the sections their active consent covers.",
            "BFM operations staff access assigned athletes only, and exports require approval.",
            "Document downloads are signed per request and logged as audit events.",
          ]}
          footer={
            <GuardrailNote>
              Verification state is displayed honestly. Unverified values are labeled unverified and
              are never presented as confirmed accomplishments.
            </GuardrailNote>
          }
        />
      </div>
    </AppShell>
  );
}

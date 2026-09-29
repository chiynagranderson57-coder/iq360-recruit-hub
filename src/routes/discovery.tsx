import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { GuardrailNote, ScopePanel } from "@/components/scope-panel";

export const Route = createFileRoute("/discovery")({
  head: () => ({
    meta: [
      { title: "Curated Discovery — Sports Recruit IQ360™" },
      {
        name: "description",
        content:
          "Find programs, camps, and pathways from curated, attributable sources with no implied offers.",
      },
      { property: "og:title", content: "Curated Discovery — Sports Recruit IQ360™" },
      {
        property: "og:description",
        content: "Curated recruiting opportunities with sources and last-reviewed dates.",
      },
    ],
  }),
  component: DiscoveryPage,
});

function DiscoveryPage() {
  return (
    <AppShell
      eyebrow="Capability 06"
      title="Curated discovery"
      description="A filtered, sourced catalog of opportunities relevant to the athlete's sport, level, and goals."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <ScopePanel
          title="Catalog behavior"
          items={[
            "Entries come from a curated, reviewed dataset, each with a source and last-reviewed date.",
            "Filtering by sport, level, region, timing, and cost considerations.",
            "Saving an opportunity attaches it to the athlete record for later comparison.",
            "Relevance reasoning is shown so the athlete understands why something appeared.",
          ]}
        />
        <ScopePanel
          title="Integrity rules"
          items={[
            "No opportunity is described as interest in, or an offer to, the athlete.",
            "No scraped or unattributed listings enter the catalog.",
            "Stale entries are marked, not quietly presented as current.",
            "Athlete data is never shared with third parties as part of discovery.",
          ]}
          footer={
            <GuardrailNote>
              Appearing in discovery means an opportunity exists publicly. It does not mean a
              program is recruiting this athlete.
            </GuardrailNote>
          }
        />
      </div>
    </AppShell>
  );
}
